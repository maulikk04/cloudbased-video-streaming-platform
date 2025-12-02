import json
import boto3
import os
from botocore.config import Config

# Configuration
REGION = os.environ.get('AWS_REGION')
TABLE_NAME = os.environ.get('VIDEO_METADATA_TABLE_NAME') # Set this in Env Vars
BUCKET_NAME = os.environ.get('RAWVIDEO_BUCKET_NAME') # Set this in Env Vars

#Endpoint URL
ENDPOINT_URL = f'https://s3.{REGION}.amazonaws.com'

# Clients
dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

# S3 Config for Presigned URLs
s3_client = boto3.client('s3', region_name=REGION, config=Config(signature_version='s3v4'), endpoint_url=ENDPOINT_URL)

def lambda_handler(event, context):
    try:
        # 1. Scan DynamoDB to get all videos
        # (For production, use Query with pagination, but Scan is fine for < 1000 items)
        response = table.scan()
        items = response.get('Items', [])

        video_list = []

        for item in items:
            # 2. Generate Presigned URL for Thumbnail
            # This allows the frontend to show the image SECURELY without cookies
            thumb_key = item.get('ThumbnailKey')
            thumb_url = None
            
            if thumb_key:
                thumb_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': BUCKET_NAME, 'Key': thumb_key},
                    ExpiresIn=3600 # Valid for 1 hour
                )
            print(thumb_key)
            # 3. Build Response Object
            video_list.append({
                'id': item.get('VideoID'),
                'title': item.get('title'),
                'synopsis': item.get('synopsis'),
                'thumb_key' : thumb_key,
                'thumbnailUrl': thumb_url,
                'status': item.get('status', 'READY') # Only show READY videos?
            })

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': True
            },
            'body': json.dumps(video_list)
        }

    except Exception as e:
        print(e)
        return {'statusCode': 500, 'body': json.dumps(str(e))}