"""
Run this once to authorize Friday to read/write your Google Calendar.
It opens a browser window for you to grant permission, then saves a token file.

Usage:
    python scripts/authorize_calendar.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

client_secret = os.environ.get("GOOGLE_CLIENT_SECRET_FILE")
if not client_secret or not os.path.exists(client_secret):
    print(f"ERROR: GOOGLE_CLIENT_SECRET_FILE not found: {client_secret}")
    print("Make sure your .env has GOOGLE_CLIENT_SECRET_FILE pointing to your OAuth client secret JSON.")
    sys.exit(1)

token_file = os.environ.get(
    "GOOGLE_CALENDAR_TOKEN_FILE",
    os.path.join(os.path.dirname(client_secret), "calendar_token.json"),
)

print(f"Using client secret: {client_secret}")
print(f"Token will be saved to: {token_file}")
print()

flow = InstalledAppFlow.from_client_secrets_file(client_secret, SCOPES)
creds = flow.run_local_server(port=0)

with open(token_file, "w") as f:
    f.write(creds.to_json())

print(f"\nDone! Token saved to: {token_file}")
print("Add this to your .env:")
print(f"  GOOGLE_CALENDAR_TOKEN_FILE={token_file}")
