import json
import os
import boto3
import subprocess
import math
import logging
import uuid
import shutil
import sys

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Configuration (Set as Lambda Environment Variables) ---
SQS_JOB_QUEUE_URL = os.environ.get('TRANSCODING_JOB_QUEUE_URL') 
FFPROBE_PATH = '/opt/bin/ffprobe' # Path of ffprobe in the Lambda Layer
CHUNK_SIZE_SECONDS = 60.0 # Duration of each parallel work chunk

# --- Clients ---
# Assumes region is configured via environment variables
S3 = boto3.client('s3')
SQS = boto3.client('sqs')

# --- Helper Functions ---

def run_ffprobe_technical_data(filepath):
    """Executes ffprobe to get both video duration and primary stream resolution (height)."""
    logger.info(f"Executing FFprobe for technical data on: {filepath}")
    
    cmd = [
        FFPROBE_PATH,
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filepath
    ]
    
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, text=True)
        data = json.loads(result.stdout)
        
        duration_sec = float(data['format']['duration'])
        
        # Find the primary video stream and extract its height
        video_stream = next((s for s in data.get('streams', []) if s.get('codec_type') == 'video'), None)
        resolution_height = int(video_stream.get('height', 0)) if video_stream else 0

        if resolution_height == 0:
            logger.warning("Could not determine video stream resolution; defaulting to 720p.")
            resolution_height = 720

        return duration_sec, resolution_height
        
    except Exception as e:
        logger.error(f"FFprobe execution failed during technical check: {e}")
        raise


def get_video_technical_data_from_s3(raw_s3_bucket, raw_s3_key):
    """
    Downloads the file header from S3 and runs ffprobe to determine total duration and resolution.
    """
    temp_filename = f"{uuid.uuid4()}-{os.path.basename(raw_s3_key)}"
    local_path = f"/tmp/{temp_filename}"
    
    try:
        # 1. Download only the file header (first 5MB)
        logger.info(f"Downloading header from s3://{raw_s3_bucket}/{raw_s3_key}")
        s3_object = S3.get_object(
            Bucket=raw_s3_bucket,
            Key=raw_s3_key,
            Range='bytes=0-5242880'
        )
        with open(local_path, 'wb') as f:
            f.write(s3_object['Body'].read())
            
        # 2. Run FFprobe on the local header file
        duration_sec, resolution_height = run_ffprobe_technical_data(local_path)
        
        return duration_sec, resolution_height
        
    except Exception as e:
        logger.error(f"Critical error during technical data calculation: {e}")
        raise
    finally:
        # ALWAYS clean up the temporary file
        if os.path.exists(local_path):
            os.remove(local_path)


def lambda_handler(event, context):
    """
    Main handler: Processes SQS messages and fans out chunk jobs.
    """
    
    if not SQS_JOB_QUEUE_URL:
        logger.error("TRANSCODING_JOB_QUEUE_URL environment variable is missing.")
        raise EnvironmentError("Job queue URL not configured.")
        
    # Lambda processes messages in batches, so iterate through all records
    for record in event['Records']:
        try:
            # 1. Parse job data from the SQS message body
            job_data = json.loads(record['body'])
            
            video_id = job_data['VideoID']
            raw_s3_key = job_data['RawS3Key']
            raw_s3_bucket = job_data['RawS3Bucket']
            
            logger.info(f"Processing job for VideoID: {video_id}. Starting technical data check.")
            
            # 2. Independent Technical Data Check (NEW CALL)
            duration_sec, max_source_height = get_video_technical_data_from_s3(raw_s3_bucket, raw_s3_key)
            logger.info(f"Resolution found: {max_source_height}p. Duration: {duration_sec}s. Fanning out jobs.")
            
            # 3. Calculate Chunks and Inject Resolution
            num_chunks = math.ceil(duration_sec / CHUNK_SIZE_SECONDS)
            messages_to_send = []
            
            for i in range(num_chunks):
                start_time = i * CHUNK_SIZE_SECONDS
                end_time = min(start_time + CHUNK_SIZE_SECONDS, duration_sec)
                
                chunk_message = {
                    "VideoID": video_id,
                    "RawS3Key": raw_s3_key,
                    "RawS3Bucket": raw_s3_bucket,
                    "Start": round(start_time, 2), 
                    "End": round(end_time, 2),     
                    "ChunkID": i + 1,
                    "TotalChunks": num_chunks,
                    "MaxResolution": max_source_height # RESOLUTION INJECTED HERE
                }
                
                messages_to_send.append({
                    'Id': f"{video_id}-{i}",
                    'MessageBody': json.dumps(chunk_message)
                })
            
            # 4. Send Messages in Batches (Fan Out)
            for i in range(0, len(messages_to_send), 10):
                batch = messages_to_send[i:i + 10]
                SQS.send_message_batch(
                    QueueUrl=SQS_JOB_QUEUE_URL,
                    Entries=batch
                )
                
            logger.info(f"Successfully fanned out {len(messages_to_send)} jobs.")
            
        except Exception as e:
            # Re-raise exception to cause SQS retry
            logger.error(f"Failed to process SQS record for {video_id}: {e}", exc_info=True)
            raise 
            
    return {'statusCode': 200, 'body': f"Fanned out {len(event['Records'])} messages."}