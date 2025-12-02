import boto3
import json
import os
import subprocess
import time
import shutil
import signal
import sys

# --- Configuration (Must be set via environment variables on EC2) ---
# Ensure these variables are correctly injected via the User Data script (Bash)
SQS_QUEUE_URL = os.environ.get('SQS_QUEUE_URL') 
DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME')
PROCESSED_S3_BUCKET = os.environ.get('PROCESSED_S3_BUCKET')
CLOUDFRONT_DOMAIN = os.environ.get('CLOUDFRONT_DOMAIN')
RAW_S3_BUCKET = os.environ.get('RAW_S3_BUCKET')
FINALIZER_SQS_URL = os.environ.get('FINALIZER_SQS_URL')
AWS_REGION = os.environ.get('AWS_REGION', 'eu-north-1') 
FFMPEG_BIN = '/usr/local/bin/ffmpeg'

# Define the Master Bitrate Ladder
MASTER_BITRATE_LADDER = {
    '1080p': {'height': 1080, 'vbr': '5000k', 'abr': '192k'},
    '720p':  {'height': 720,  'vbr': '2500k', 'abr': '128k'},
    '480p':  {'height': 480,  'vbr': '1000k', 'abr': '96k'},
    '360p':  {'height': 360,  'vbr': '600k',  'abr': '64k'}
}

# --- Global Clients (Explicitly pass region and handle startup failure) ---
try:
    SQS = boto3.client('sqs', region_name=AWS_REGION)
    S3 = boto3.client('s3', region_name=AWS_REGION)
    DYNAMODB = boto3.resource('dynamodb', region_name=AWS_REGION)
    FINALIZER_SQS = boto3.client('sqs', region_name=AWS_REGION)
except Exception as e:
    print(f"FATAL BOTO3 CLIENT ERROR during startup in region {AWS_REGION}: {e}")
    sys.stdout.flush()
    sys.exit(1)

# Global flag to handle graceful exit signals
RECEIVED_SIGNAL = False

# --- Helper Functions ---
def update_dynamo_status(video_id, status, cdn_path=None):
    """Updates the video status in the DynamoDB table."""
    try:
        table = DYNAMODB.Table(DYNAMODB_TABLE_NAME)
        update_expression = "SET #S = :s"
        expression_attribute_values = {':s': status}
        
        if cdn_path:
            update_expression += ", ProcessedCDNPath = :p"
            expression_attribute_values[':p'] = cdn_path
        
        table.update_item(
            Key={'VideoID': video_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames={'#S': 'Status'},
            ExpressionAttributeValues=expression_attribute_values
        )
        print(f"DynamoDB updated for {video_id}: Status={status}")
    except Exception as e:
        # CRITICAL DEBUG: If DynamoDB fails, log the full error
        print(f"ERROR: Failed to update DynamoDB for {video_id}. Full Error: {e}")

def transcode_video(job_data):
    """Handles the time-sliced transcoding job and dynamically filters the Bitrate Ladder."""
    video_id = job_data['VideoID']
    raw_s3_key = job_data['RawS3Key']
    raw_s3_bucket = job_data['RawS3Bucket']
    start_time = job_data['Start']
    end_time = job_data['End']
    max_source_height = job_data.get('MaxResolution', 720) 
    total_chunks = job_data.get('TotalChunks')
    
    chunk_duration = end_time - start_time
    chunk_id = f"{int(start_time):04d}-{int(end_time):04d}"
    print(f"\n--- START CHUNK {chunk_id} ({chunk_duration:.2f}s) ---")
    
    # --- Local Setup ---
    job_dir = f"/tmp/{video_id}-{chunk_id}"
    os.makedirs(job_dir, exist_ok=True)
    local_raw_path = os.path.join(job_dir, os.path.basename(raw_s3_key))
    completed_qualities = [] 
    
    try:
        # 1. Download Raw File (CRITICAL BOTO3 CHECK)
        print(f"Downloading s3://{raw_s3_bucket}/{raw_s3_key}...")
        try:
            S3.download_file(raw_s3_bucket, raw_s3_key, local_raw_path)
            print(f"Download complete.")
        except Exception as e:
            # Explicitly catch S3 download failure (e.g., AccessDenied)
            print(f"CRITICAL DOWNLOAD FAILURE: Cannot read source file. Error: {e}")
            update_dynamo_status(video_id, 'FAILED_DOWNLOAD')
            return False

        # 2. Dynamic Ladder Filtering (remains the same)
        dynamic_ladder = {
            quality: settings 
            for quality, settings in MASTER_BITRATE_LADDER.items() 
            if settings['height'] <= max_source_height
        }
        
        if not dynamic_ladder:
            print(f"WARNING: Source video too small ({max_source_height}p). Skipping chunk.")
            update_dynamo_status(video_id, 'SKIPPED')
            return True 

        # --- 3. FFmpeg Transcoding Loop ---
        for quality, settings in dynamic_ladder.items():
            output_folder_q = os.path.join(job_dir, quality)
            os.makedirs(output_folder_q, exist_ok=True)
            output_manifest_name = f"chunk_{chunk_id}.m3u8"
            
            ffmpeg_command = [
                FFMPEG_BIN, 
                '-ss', str(start_time),                     
                '-i', local_raw_path, 
                '-t', str(chunk_duration),                  
                '-hls_time', '10',                          
                '-hls_list_size', '0',
                '-codec:v', 'libx264',
                '-preset', 'ultrafast',
                '-b:v', settings['vbr'],                    
                '-maxrate', settings['vbr'],                
                '-vf', f"scale=-2:{settings['height']}",    
                '-codec:a', 'aac',
                '-b:a', settings['abr'],                     
                '-f', 'hls',
                '-hls_segment_filename', os.path.join(output_folder_q, f"{quality}_chunk_{chunk_id}_%04d.ts"),
                os.path.join(output_folder_q, output_manifest_name)
            ]
            
            # --- FFmpeg Execution (CRITICAL DEBUG CAPTURE) ---
            try:
                result = subprocess.run(ffmpeg_command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                print(f"FFmpeg chunk {chunk_id} complete for {quality}.")
            except subprocess.CalledProcessError as e:
                # Log the actual FFmpeg error output (stderr)
                error_output = e.stderr.decode('utf-8', errors='ignore')
                print(f"CRITICAL FFmpeg FAILURE for {quality}. Error Log:")
                print("--- FFmpeg STDERR ---")
                print(error_output)
                print("---------------------")
                update_dynamo_status(video_id, 'FAILED_TRANSCODE')
                return False

            # 4. Upload Processed Files to S3 (CRITICAL BOTO3 CHECK)
            processed_key_prefix = f"processed/{video_id}/{quality}/" 
            
            try:
                for root, _, files in os.walk(output_folder_q):
                    for file in files:
                        local_path = os.path.join(root, file)
                        s3_key = processed_key_prefix + file
                        S3.upload_file(local_path, PROCESSED_S3_BUCKET, s3_key)
                
                print(f"Chunk {chunk_id} segments uploaded successfully for {quality}.")
                completed_qualities.append(quality) # Track only successful uploads
            except Exception as e:
                # Explicitly catch S3 upload failure (e.g., PutObject AccessDenied)
                print(f"CRITICAL UPLOAD FAILURE for {quality}: Cannot write to {PROCESSED_S3_BUCKET}. Error: {e}")
                update_dynamo_status(video_id, 'FAILED_UPLOAD')
                return False

        # 5. Final Status Hand-off (CRITICAL SQS CHECK)
        if FINALIZER_SQS_URL:
            try:
                finalizer_message = {
                    "VideoID": video_id,
                    "ChunkID": chunk_id,
                    "TotalChunks": total_chunks,
                    "CompletedQualities": completed_qualities
                }

                FINALIZER_SQS.send_message(
                    QueueUrl=FINALIZER_SQS_URL,
                    MessageBody=json.dumps(finalizer_message)
                )
                print(f"Sent completion signal for chunk {chunk_id} to Finalizer.")
            except Exception as e:
                # Explicitly catch SQS send failure
                print(f"CRITICAL SQS SEND FAILURE: Cannot send message to Finalizer. Error: {e}")
                update_dynamo_status(video_id, 'FAILED_FINALIZER_SIGNAL')
                return False # Prevent SQS message deletion for job retry

        return True

    except Exception as e:
        # Catch any remaining initialization or structural errors
        print(f"CRITICAL GENERAL FAILURE for chunk {chunk_id}: {e}")
        update_dynamo_status(video_id, 'FAILED_INIT_OR_UNKNOWN')
        return False
    finally:
        # 6. Clean up temporary directory (CRUCIAL)
        shutil.rmtree(job_dir, ignore_errors=True)
        print(f"Cleaned up {job_dir}")
        
# --- Signal Handler and Main Polling Loop (remain the same) ---
def signal_handler(signum, frame):
    global RECEIVED_SIGNAL
    print(f"Received signal {signum}. Shutting down worker gracefully...")
    RECEIVED_SIGNAL = True

def main():
    """Worker loop that continuously polls SQS."""
    if not SQS_QUEUE_URL:
        print("FATAL: SQS_QUEUE_URL environment variable is missing. Cannot start.")
        return
    
    # Initialize necessary environment check logs
    print(f"ENV CHECK: AWS Region={AWS_REGION}, SQS URL={SQS_QUEUE_URL}, DYNAMO DB={DYNAMODB_TABLE_NAME}")
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("Transcoder worker started. Polling SQS...")
    
    while not RECEIVED_SIGNAL:
        try:
            # SQS Long Polling
            response = SQS.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20, 
                VisibilityTimeout=1800 
            )

            if 'Messages' in response:
                message = response['Messages'][0]
                receipt_handle = message['ReceiptHandle']
                
                job_data = json.loads(message['Body'])
                
                if transcode_video(job_data):
                    # DELETE message ONLY after successful processing
                    SQS.delete_message(
                        QueueUrl=SQS_QUEUE_URL,
                        ReceiptHandle=receipt_handle
                    )
                    print("Job successfully completed and message deleted.")
                # If transcode_video returns False, the job message remains for retry.
            else:
                print("Queue is empty. Polling again...")
                
        except Exception as e:
            print(f"CRITICAL SQS polling error: {e}. Retrying in 5s.")
            time.sleep(5)

if __name__ == "__main__":
    main()