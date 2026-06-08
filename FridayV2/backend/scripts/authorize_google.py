"""
One-time Google OAuth setup for FridayV2.
Run this script once to authorize qhairul.asmai@gmail.com and generate gdrive_token.json.

Usage:
    cd FridayV2/backend
    python scripts/authorize_google.py

Prerequisites:
    1. Go to console.cloud.google.com (signed in as qhairul.asmai@gmail.com)
    2. Create or select a project (e.g. "friday-v2")
    3. Enable the Google Drive API
    4. Create OAuth 2.0 credentials → Desktop app
    5. Download the client secret JSON → save to FridayV2/backend/secrets/google-client-secret.json
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow
from core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/spreadsheets",
]


def main():
    client_secret = settings.GOOGLE_CLIENT_SECRET_FILE
    token_out = settings.GDRIVE_TOKEN_FILE

    if not client_secret.exists():
        print(f"ERROR: Client secret not found at:\n  {client_secret}\n")
        print("Steps to fix:")
        print("  1. Go to https://console.cloud.google.com/ (as qhairul.asmai@gmail.com)")
        print("  2. Enable the Google Drive API")
        print("  3. Create OAuth 2.0 credentials → Desktop app")
        print("  4. Download JSON → save to:", client_secret)
        sys.exit(1)

    token_out.parent.mkdir(parents=True, exist_ok=True)

    print("Opening browser for Google authorization...")
    print("Sign in as: qhairul.asmai@gmail.com\n")

    flow = InstalledAppFlow.from_client_secrets_file(str(client_secret), SCOPES)
    creds = flow.run_local_server(port=0)

    with open(token_out, "w") as f:
        f.write(creds.to_json())

    print(f"\nAuthorization successful.")
    print(f"Token saved to: {token_out}")
    print("\nFriday can now access Google Drive.")


if __name__ == "__main__":
    main()
