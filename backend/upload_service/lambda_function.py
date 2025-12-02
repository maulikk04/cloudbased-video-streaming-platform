import json
import boto3
import os
import csv
import io
from botocore.exceptions import ClientError
from botocore.config import Config

# --- 1. CONFIGURATION ---
# Stockholm (eu-north-1) requires explicit region and signature setup
REGION = os.environ.get('AWS_REGION')
ENDPOINT_URL = f'https://s3.{REGION}.amazonaws.com'

my_config = Config(
    region_name=REGION,
    signature_version='s3v4'
)

# Initialize S3 Client with specific config to avoid "SignatureDoesNotMatch"
s3_client = boto3.client(
    's3', 
    config=my_config, 
    endpoint_url=ENDPOINT_URL
)

BUCKET_NAME = os.environ.get('RAWVIDEO_BUCKET_NAME')

def lambda_handler(event, context):
    try:
        # --- 2. PARSE INPUT (POST METHOD) ---
        # API Gateway passes the JSON body as a string
        body_str = event.get('body')
        if not body_str:
             return {
                'statusCode': 400,
                'headers': {"Access-Control-Allow-Origin": "*"},
                'body': json.dumps({'error': 'Request body is missing. Ensure you are using POST.'})
            }
            
        body = json.loads(body_str)
        
        # Extract fields
        filename = body.get('filename')       
        thumbnail_name = body.get('thumbnail_name') 
        title = body.get('title')
        synopsis = body.get('synopsis')
        owner = body.get('owner')

        # Basic Validation
        if not filename or not title:
            return {
                'statusCode': 400,
                'headers': {"Access-Control-Allow-Origin": "*"},
                'body': json.dumps({'error': 'Missing required fields: filename and title'})
            }

        # --- 3. DEFINE S3 PATHS ---
        # We use the filename (without extension) as the ID to link CSV and Video
        file_id = os.path.splitext(filename)[0] 
        
        csv_key = f"csv/{file_id}.csv"
        video_key = f"raw/{filename}"
        # Only set thumbnail key if a name was provided
        thumb_key = f"thumbnails/{thumbnail_name}" if thumbnail_name else None

        # --- 4. CREATE CSV & SAVE TO S3 ---
        # Create CSV in memory (no temp files needed)
        csv_buffer = io.StringIO()
        csv_writer = csv.writer(csv_buffer)
        
        # Write Header and Data Row
        csv_writer.writerow(['Title', 'Synopsis', 'Owner', 'VideoKey', 'ThumbnailKey'])
        csv_writer.writerow([title, synopsis, owner, video_key, thumb_key])
        
        # Upload CSV immediately
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=csv_key,
            Body=csv_buffer.getvalue(),
            ContentType='text/csv'
        )

        # --- 5. GENERATE PRE-SIGNED URLS ---
        
        # A. Video URL (Valid for 5 minutes)
        video_upload_url = s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': BUCKET_NAME, 'Key': video_key},
            ExpiresIn=300
        )

        # B. Thumbnail URL (Optional)
        thumb_upload_url = None
        if thumb_key:
            thumb_upload_url = s3_client.generate_presigned_url(
                'put_object',
                Params={'Bucket': BUCKET_NAME, 'Key': thumb_key},
                ExpiresIn=300
            )

        # --- 6. RETURN RESPONSE ---
        return {
            'statusCode': 200,
            'headers': {
                "Access-Control-Allow-Origin": "*", # CORS for frontend
                "Access-Control-Allow-Credentials": True,
                "Content-Type": "application/json"
            },
            'body': json.dumps({
                'message': 'Metadata saved. Use these URLs to upload files.',
                'videoUploadURL': video_upload_url,
                'thumbnailUploadURL': thumb_upload_url,
                'fileId': file_id
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {"Access-Control-Allow-Origin": "*"},
            'body': json.dumps({'error': str(e)})
        }