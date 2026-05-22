"""
Run this once to authorize Friday to read/write your Google Drive notes.
It opens a browser window for you to grant permission, then saves a token file.

Usage:
    python scripts/authorize_gdrive_notes.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/drive"]

client_secret = os.environ.get("GOOGLE_CLIENT_SECRET_FILE")
if not client_secret or not os.path.exists(client_secret):
    print(f"ERROR: GOOGLE_CLIENT_SECRET_FILE not found: {client_secret}")
    print("Make sure your .env has GOOGLE_CLIENT_SECRET_FILE pointing to your OAuth client secret JSON.")
    sys.exit(1)

token_file = os.environ.get(
    "GDRIVE_NOTES_TOKEN_FILE",
    os.path.join(os.path.dirname(client_secret), "gdrive_notes_token.json"),
)

print(f"Using client secret: {client_secret}")
print(f"Token will be saved to: {token_file}")
print()

flow = InstalledAppFlow.from_client_secrets_file(client_secret, SCOPES)
creds = flow.run_local_server(port=0)

with open(token_file, "w") as f:
    f.write(creds.to_json())

print(f"\nDone! Token saved to: {token_file}")
print("Add this to your .env if not already set:")
print(f"  GDRIVE_NOTES_TOKEN_FILE={token_file}")
print()
print("On the first note operation, Friday will print the Friday folder ID.")
print("Copy it to your .env as GDRIVE_NOTES_FOLDER_ID to skip folder discovery on future runs.")
