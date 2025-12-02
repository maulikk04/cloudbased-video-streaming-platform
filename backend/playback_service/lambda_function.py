import json
import boto3
import datetime
import rsa
import base64
import time

# CONFIGURATION
PARAMETER_NAME = "/vidstream/private_key" 
# e.g. K2JCJM... (Get this from CloudFront Console -> Key management -> Public keys)
KEY_PAIR_ID = os.environ.get('KEY_PAIR_ID_PLAYBACK')
# Your CloudFront Domain (e.g. d12345.cloudfront.net)
CLOUDFRONT_DOMAIN = os.environ.get('CLOUDFRONT_DOMAIN')

def get_private_key():
    client = boto3.client('ssm')
    response = client.get_parameter(Name=PARAMETER_NAME, WithDecryption=True)
    raw_key = response['Parameter']['Value']

    # DEFINITIONS
    header_marker = "-----BEGIN RSA PRIVATE KEY-----"
    footer_marker = "-----END RSA PRIVATE KEY-----"

    # 1. Check if we actually have the right key type
    if header_marker not in raw_key:
        # Check if the user accidentally pasted the PUBLIC key or a PKCS8 key
        if "BEGIN PUBLIC KEY" in raw_key:
            raise ValueError("Error: You pasted the PUBLIC key in SSM. You must paste the PRIVATE key.")
        raise ValueError(f"Error: Could not find the start marker '{header_marker}' in the SSM parameter.")

    # 2. Aggressive Cleanup
    # Extract just the body (the random characters) by deleting the header/footer
    body = raw_key.replace(header_marker, "").replace(footer_marker, "")
    
    # Remove ALL whitespace (spaces, tabs, newlines) from the body
    body = "".join(body.split())

    # 3. Reconstruct Perfectly
    # We manually build the string with the correct newlines (\n)
    clean_key = f"{header_marker}\n{body}\n{footer_marker}"

    # 4. Load
    return rsa.PrivateKey.load_pkcs1(clean_key.encode('utf-8'))

def sign_message(message, private_key):
    # 1. Sign using SHA-1 (Required by CloudFront)
    signature = rsa.sign(message, private_key, 'SHA-1')
    return signature

def make_safe_base64(data):
    # CloudFront requires specific character replacements for Base64
    # + becomes -
    # = becomes _
    # / becomes ~
    encoded = base64.b64encode(data).decode('utf-8')
    return encoded.replace('+', '-').replace('=', '_').replace('/', '~')

def lambda_handler(event, context):
    resource_url = f"https://{CLOUDFRONT_DOMAIN}/*"
    
    try:
        # 1. Define the Policy
        # This JSON tells CloudFront: "Allow access to everything (*) for 1 hour"
        expire_time = int(time.time()) + 3600 # 1 hour from now
        
        policy_json = {
            "Statement": [
                {
                    "Resource": resource_url,
                    "Condition": {
                        "DateLessThan": {
                            "AWS:EpochTime": expire_time
                        }
                    }
                }
            ]
        }
        # Remove whitespace from JSON (Crucial for signing)
        policy_str = json.dumps(policy_json).replace(" ", "")
        
        # 2. Sign the Policy
        private_key = get_private_key()
        signature_bytes = sign_message(policy_str.encode('utf-8'), private_key)
        
        # 3. Create Safe Strings
        policy_base64 = make_safe_base64(policy_str.encode('utf-8'))
        signature_base64 = make_safe_base64(signature_bytes)
        
        # 4. Return Cookies
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': 'http://localhost:3000', 
                'Access-Control-Allow-Credentials': 'true',
            },
            'multiValueHeaders': {
                'Set-Cookie': [
                    f"CloudFront-Policy={policy_base64}; Domain={CLOUDFRONT_DOMAIN}; Path=/; Secure; SameSite=None",
                    f"CloudFront-Signature={signature_base64}; Domain={CLOUDFRONT_DOMAIN}; Path=/; Secure; SameSite=None",
                    f"CloudFront-Key-Pair-Id={KEY_PAIR_ID}; Domain={CLOUDFRONT_DOMAIN}; Path=/; Secure; SameSite=None"
                ]
            },
            'body': json.dumps({'message': 'Stream authorized successfully'})
        }
        
    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }