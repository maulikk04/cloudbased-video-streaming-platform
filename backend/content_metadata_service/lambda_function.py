import json
import os
import subprocess
import boto3
import uuid
import logging
from decimal import Decimal
import sys
import csv
from io import StringIO
import math

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Configuration (Set as Lambda Environment Variables) ---
DYNAMODB_TABLE_NAME = os.environ.get('VIDEO_METADATA_TABLE_NAME') 
SQS_SEGMENTATION_QUEUE_URL = os.environ.get('SQS_SEGMENTATION_QUEUE_URL') 
FFPROBE_PATH = '/opt/bin/ffprobe' # Path to ffprobe in the Lambda Layer
CHUNK_SIZE_SECONDS = 60.0 # Standard chunk size for parallel processing

# --- Clients ---
S3 = boto3.client('s3')
DYNAMODB = boto3.resource('dynamodb')
SQS = boto3.client('sqs')

# --- Helper Functions ---

def get_descriptive_metadata(bucket, csv_key):
    """
    Downloads and parses the user-provided CSV file.
    Filters out redundant/risky fields like 'id', 'videokey', etc.
    """
    logger.info(f"Attempting to download descriptive CSV from: s3://{bucket}/{csv_key}")
    
    # Fields to exclude from the final DynamoDB item
    EXCLUDED_FIELDS = ['id', 'videokey', 'thumbnailkey', 'raws3key', 'encodingresolution', 'totalchunks'] 
    
    try:
        csv_object = S3.get_object(Bucket=bucket, Key=csv_key)
        csv_content = csv_object['Body'].read().decode('utf-8')
        
        reader = csv.DictReader(StringIO(csv_content))
        data = next(reader)
        
        descriptive_data = {}
        for k, v in data.items():
            normalized_key = k.strip().replace(' ', '').lower()
            if normalized_key not in EXCLUDED_FIELDS:
                descriptive_data[normalized_key] = v.strip()
        
        return descriptive_data
    
    except Exception as e:
        logger.warning(f"Could not retrieve/parse descriptive CSV metadata from {csv_key}. Error: {e}. Returning empty metadata.")
        return {}


def run_ffprobe(filepath):
    """Executes the ffprobe command to extract detailed technical metadata."""
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
        return json.loads(result.stdout)
    except Exception as e:
        logger.error(f"FFprobe failure: {e}")
        raise


def update_metadata_in_dynamodb(video_id, technical_metadata, descriptive_metadata, bucket, raw_key, thumbnail_key, video_size_bytes):
    """Merges technical and dynamic descriptive metadata and saves the final record."""
    
    if not DYNAMODB_TABLE_NAME:
        raise EnvironmentError("DYNAMODB_TABLE_NAME environment variable is missing.")
        
    table = DYNAMODB.Table(DYNAMODB_TABLE_NAME)
    
    # Extracting core technical stream info
    video_stream = next((s for s in technical_metadata.get('streams', []) if s.get('codec_type') == 'video'), None)
    
    # 1. TECHNICAL METADATA GENERATION
    duration_float = float(technical_metadata.get('format', {}).get('duration', 0))
    bit_rate = int(technical_metadata.get('format', {}).get('bit_rate', 0))
    
    # Calculate TotalChunks (CRITICAL for the Finalizer Service)
    total_chunks = math.ceil(duration_float / CHUNK_SIZE_SECONDS)
    
    # Define base structure with mandatory keys
    item = {
        'VideoID': video_id,
        'Status': 'PROCESSING',
        
        # --- GENERATED TECHNICAL METADATA (Fixed Fields) ---
        'DurationSec': Decimal(str(duration_float)),
        'DurationMinutes': Decimal(str(round(duration_float / 60.0, 2))),
        'TotalChunks': total_chunks,
        'TargetResolution': video_stream.get('height') if video_stream else 0,
        'SourceCodec': video_stream.get('codec_name', 'unknown'),
        'SourceBitRateKbps': Decimal(str(round(bit_rate / 1000.0, 2))),
        'VideoSizeMB': Decimal(str(round(video_size_bytes / (1024 * 1024), 2))), # NEW: Video Size in MB
        
        # --- STORAGE PATHS ---
        'RawS3Key': raw_key,
        'RawS3Bucket': bucket, 
        'ThumbnailKey': thumbnail_key, 
        'ProcessedCDNPath': '', 
    }

    # 2. DYNAMICALLY MERGE DESCRIPTIVE METADATA
    item.update(descriptive_metadata)
    
    # Final check: Ensure the item has a title for the catalog
    if 'title' not in item:
        item['Title'] = os.path.basename(raw_key) 
    
    table.put_item(Item=item)
    logger.info(f"Successfully wrote merged metadata for {video_id} (Chunks: {total_chunks}) to DynamoDB.")
    return item

def send_segmentation_job(video_id, bucket, key):
    """Sends the job payload to the Segmentation Queue (SQS)."""
    
    if not SQS_SEGMENTATION_QUEUE_URL:
        raise EnvironmentError("SQS_SEGMENTATION_QUEUE_URL is not configured.")

    job_message = {
        "VideoID": video_id, 
        "RawS3Key": key,
        "RawS3Bucket": bucket
    }

    SQS.send_message(
        QueueUrl=SQS_SEGMENTATION_QUEUE_URL,
        MessageBody=json.dumps(job_message)
    )
    logger.info(f"Enqueued segmentation job for VideoID: {video_id} to SQS.")


def lambda_handler(event, context):
    """
    Main Lambda entry point, triggered by S3 ObjectCreated event on the 'raw/' prefix.
    """
    
    # 1. Extract S3 Bucket, Key, and Generate Unique Video ID
    try:
        record = event['Records'][0]
        bucket = record['s3']['bucket']['name']
        raw_key = record['s3']['object']['key']
        video_size_bytes = record['s3']['object']['size'] # Extract size from S3 event record
        
        # Derive Video ID from the filename base
        filename_base = os.path.splitext(os.path.basename(raw_key))[0]
        video_id = str(uuid.uuid4()) 

        # Derive paths for other assets based on the filename_base
        csv_key = f"csv/{filename_base}.csv"
        thumbnail_key = f"thumbnails/{filename_base}.jpeg"
        
    except Exception as e:
        logger.error(f"Error parsing S3 event: {e}")
        return {'statusCode': 400, 'body': 'Invalid S3 event format.'}

    local_path = f"/tmp/{os.path.basename(raw_key)}"
    
    try:
        # 2. Retrieve Technical Metadata (Download header for FFprobe)
        s3_object = S3.get_object(
            Bucket=bucket,
            Key=raw_key,
            Range='bytes=0-5242880'
        )
        with open(local_path, 'wb') as f:
            f.write(s3_object['Body'].read())
        
        ffprobe_output = run_ffprobe(local_path)
        
        # 3. Retrieve Descriptive Metadata (Fetch CSV data dynamically)
        descriptive_metadata = get_descriptive_metadata(bucket, csv_key)
        
        # 4. Save, Link, and Trigger
        dynamo_item = update_metadata_in_dynamodb(video_id, ffprobe_output, descriptive_metadata, bucket, raw_key, thumbnail_key, video_size_bytes)
        
        send_segmentation_job(video_id, bucket, raw_key)
        
        # 5. Clean up
        os.remove(local_path)

        logger.info(f"Workflow initiated successfully for VideoID: {video_id}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({'VideoID': video_id, 'Status': dynamo_item['Status']})
        }

    except Exception as e:
        logger.error(f"CRITICAL Failure for VideoID: {video_id}. Error: {e}", exc_info=True)
        
        # Check if the failure was due to a missing CSV file (NoSuchKey)
        if 'NoSuchKey' in str(e) or 'AccessDenied' in str(e):
             logger.warning(f"Associated asset (CSV or Thumbnail) may be missing or inaccessible. Allowing retry.")
        
        # Global error handling: log the failure and return 500
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e), 'message': 'Failed to process video metadata.'})
        }