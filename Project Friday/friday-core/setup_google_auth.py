"""
Run this once to authorize Friday to access your Google Sheet.
After completion, a token file is saved and the bot will use it automatically.
"""
from dotenv import load_dotenv
load_dotenv()

import os
import json
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
SECRET_FILE = os.environ.get("GOOGLE_CLIENT_SECRET_FILE", "")
TOKEN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "google_token.pickle")

if not SECRET_FILE or not os.path.exists(SECRET_FILE):
    print(f"ERROR: Could not find client secret file at: {SECRET_FILE}")
    print("Check that GOOGLE_CLIENT_SECRET_FILE is set correctly in your .env file.")
    exit(1)

print(f"Using credentials file: {SECRET_FILE}")
print("A browser window will open. Sign in and click Allow.\n")

flow = InstalledAppFlow.from_client_secrets_file(SECRET_FILE, SCOPES)
creds = flow.run_local_server(port=8080, prompt="consent", access_type="offline")

with open(TOKEN_PATH, "wb") as f:
    pickle.dump(creds, f)

print(f"\nSuccess! Token saved to: {TOKEN_PATH}")
print("You can now start Friday with: python main.py")
