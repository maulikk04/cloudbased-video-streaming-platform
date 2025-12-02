import json
import os
import boto3
import logging
import math
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Configuration (Lambda Environment Variables) ---
DYNAMODB_TABLE_NAME = os.environ.get('VIDEO_METADATA_TABLE_NAME')
PROCESSED_S3_BUCKET = os.environ.get('PROCESSED_S3_BUCKET')
CLOUDFRONT_DOMAIN = os.environ.get('CLOUDFRONT_DOMAIN')
CHUNK_DURATION_SEC = 60 # Must match the Segmentation Service setting

# --- Clients ---
DYNAMODB = boto3.resource('dynamodb')
S3 = boto3.client('s3')

# --- DUPLICATE BITRATE LADDER from job-worker.py (REQUIRED for manifest generation) ---
MASTER_BITRATE_LADDER = {
    '1080p': {'height': 1080, 'vbr': '5000k', 'abr': '192k'},
    '720p':  {'height': 720,  'vbr': '2500k', 'abr': '128k'},
    '480p':  {'height': 480,  'vbr': '1000k', 'abr': '96k'},
    '360p':  {'height': 360,  'vbr': '600k',  'abr': '64k'}
}
# ------------------------------------------------------------------------------------------------

# Master manifest format template
MASTER_MANIFEST_TEMPLATE = """#EXTM3U
#EXT-X-VERSION:3
{streams}"""

# Stream template for a single resolution in the master manifest (links to the sequential playlist)
STREAM_TEMPLATE = """#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},RESOLUTION={resolution}
{quality_folder}/sequential.m3u8"""

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
        logger.info(f"DynamoDB updated for {video_id}: Status={status}")
    except Exception as e:
        logger.error(f"ERROR: Failed to update DynamoDB for {video_id}. Full Error: {e}")

def update_chunk_counter(video_id, total_chunks, completed_qualities):
    """
    Atomically increments the ChunksCompleted counter and tracks completed qualities.
    Returns the current state.
    """
    table = DYNAMODB.Table(DYNAMODB_TABLE_NAME)
    
    # Atomically increment the count and add the completed qualities to a set
    response = table.update_item(
        Key={'VideoID': video_id},
        UpdateExpression="SET #S = :s_processing, ChunksCompleted = if_not_exists(ChunksCompleted, :start) + :inc ADD CompletedQualities :q",
        ExpressionAttributeNames={'#S': 'Status'},
        ExpressionAttributeValues={
            ':inc': Decimal(1),
            ':start': Decimal(0),
            ':s_processing': 'PROCESSING',
            # DynamoDB requires Sets for adding multiple distinct items
            ':q': set(completed_qualities)
        },
        ReturnValues="UPDATED_NEW"
    )
    return response['Attributes']


def stitch_chunk_manifests(video_id, quality, total_chunks, video_duration):
    """
    Stitches together individual chunk manifests into one seamless sequential.m3u8 playlist.
    Uses video_duration to correctly calculate the end time of the final chunk.
    """
    sequential_content = ["#EXTM3U", "#EXT-X-VERSION:3"]
    
    # Ensure video_duration is a float for accurate calculation
    video_duration = float(video_duration)
    
    # 1. Iterate through all expected chunks (0 to TotalChunks-1)
    for i in range(total_chunks):
        start_time = i * CHUNK_DURATION_SEC
        
        # CRITICAL FIX: Calculate the end time, ensuring it doesn't exceed the total video duration.
        calculated_end_time = min(start_time + CHUNK_DURATION_SEC, video_duration)
        
        # Use the same integer conversion logic as the worker for file naming consistency
        chunk_id = f"{int(start_time):04d}-{int(calculated_end_time):04d}" 
        
        # This is the exact key the worker must have uploaded
        chunk_manifest_key = f"processed/{video_id}/{quality}/chunk_{chunk_id}.m3u8"
        
        try:
            # 2. Download the individual chunk manifest content
            response = S3.get_object(Bucket=PROCESSED_S3_BUCKET, Key=chunk_manifest_key)
            manifest_data = response['Body'].read().decode('utf-8')
            
            # 3. Append the segment URLs from the chunk manifest
            for line in manifest_data.splitlines():
                # We append only the segment lines and their duration tags (#EXTINF)
                if not line.startswith('#EXTM3U') and not line.startswith('#EXT-X-VERSION'):
                    # IMPORTANT: Manifest segments are relative, we need to prefix them with the quality folder for the sequential playlist
                    if line.endswith('.ts'):
                        # Example: 720p/chunk_0000-0060_0001.ts
                        sequential_content.append(f"{quality}/{line}")
                    else:
                        sequential_content.append(line)
        except Exception as e:
            logger.error(f"Missing chunk manifest {chunk_manifest_key}. Sequence broken!")
            raise e
            
    # 4. Create the final sequential manifest
    final_manifest_key = f"processed/{video_id}/{quality}/sequential.m3u8"
    
    # Add the necessary end tag for HLS playback
    sequential_content.append("#EXT-X-ENDLIST")
    
    final_manifest_body = '\n'.join(sequential_content)
    
    S3.put_object(
        Bucket=PROCESSED_S3_BUCKET,
        Key=final_manifest_key,
        Body=final_manifest_body,
        ContentType='application/x-mpegURL'
    )
    return final_manifest_key

def generate_master_manifest(video_id, qualities):
    """
    Generates the master manifest file that links to all sequential playlists.
    Sorts streams by BANDWIDTH (descending) as per HLS best practice.
    """
    
    # 1. Collect stream data for only the successful qualities
    stream_data = []
    for quality in qualities:
        settings = MASTER_BITRATE_LADDER.get(quality)
        if not settings: continue
        
        # Calculate approximate screen width (W=H*16/9)
        # Use 854 for 480p standard 16:9 compliance
        height = settings['height']
        width = 854 if height == 480 else int(height * (16/9))
        
        stream_data.append({
            # Convert '5000k' to 5000000 integer for sorting
            'bandwidth': int(settings['vbr'].replace('k', '000')),
            'resolution': f"{width}x{height}",
            'quality_folder': quality
        })

    # 2. Sort the streams by BANDWIDTH in descending order (CRITICAL FIX)
    stream_data.sort(key=lambda x: x['bandwidth'], reverse=True)
    
    master_streams = []
    
    # 3. Format the sorted data into the final manifest strings
    for data in stream_data:
        master_streams.append(STREAM_TEMPLATE.format(
            bandwidth=data['bandwidth'], 
            resolution=data['resolution'], 
            quality_folder=data['quality_folder']
        ))

    # 4. Combine streams and create the master file
    master_key = f"processed/{video_id}/master.m3u8"
    final_manifest_body = MASTER_MANIFEST_TEMPLATE.format(streams='\n'.join(master_streams))
    
    S3.put_object(
        Bucket=PROCESSED_S3_BUCKET,
        Key=master_key,
        Body=final_manifest_body,
        ContentType='application/x-mpegURL'
    )
    
    return f"https://{CLOUDFRONT_DOMAIN}/{master_key}"


def lambda_handler(event, context):
    """Triggered by the FinalizerQueue with chunk completion messages."""
    
    dynamo_table = DYNAMODB.Table(DYNAMODB_TABLE_NAME) # Access table once
    video_id = None # Initialize for logging if parsing fails
    
    for record in event['Records']:
        try:
            job_data = json.loads(record['body'])
            
            video_id = job_data['VideoID']
            chunk_id = job_data['ChunkID']
            total_chunks = job_data['TotalChunks']
            completed_qualities = job_data['CompletedQualities']
            
            logger.info(f"Received completion signal for VideoID: {video_id}, Chunk: {chunk_id}")
            
            # 1. Increment completed chunk counter and track qualities
            updated_state = update_chunk_counter(video_id, total_chunks, completed_qualities)
            chunks_completed = int(updated_state.get('ChunksCompleted', 0))
            
            logger.info(f"Video {video_id}: Chunks completed: {chunks_completed} / {total_chunks}")
            
            # 2. Check for Full Completion
            if chunks_completed == total_chunks:
                logger.info(f"Video {video_id} is fully transcoded. Starting manifest assembly.")
                
                # Fetch video duration from DynamoDB (REQUIRED FOR STITCHING)
                video_item = dynamo_table.get_item(Key={'VideoID': video_id})['Item']
                video_duration = video_item['DurationSec'] 
                
                # Get the final set of unique qualities produced across all chunks
                final_qualities = list(updated_state.get('CompletedQualities', set()))

                # A. Stitch all chunks for EACH quality level
                for quality in final_qualities:
                    # **MODIFIED CALL: Pass video_duration**
                    stitch_chunk_manifests(video_id, quality, total_chunks, video_duration) 
                    
                # B. Generate the final Master Manifest linking all sequential playlists
                final_cdn_url = generate_master_manifest(video_id, final_qualities)
                
                # C. Set final READY status and CDN path in DynamoDB
                update_dynamo_status(video_id, 'READY', cdn_path=final_cdn_url)
                logger.info(f"Finalization complete. CDN URL: {final_cdn_url}")

        except Exception as e:
            # Use video_id if available, otherwise default to context request ID
            log_id = video_id if video_id else context.aws_request_id 
            logger.error(f"Finalizer critical failure for {log_id}: {e}", exc_info=True)
            raise # Re-raise exception to cause SQS retry

    return {'statusCode': 200}
