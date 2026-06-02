"""
One-time script to get a Google Calendar refresh token.
Reads existing Drive OAuth credentials (client_id + client_secret) so you
don't need to create a new Google Cloud app.

Run on the VM:
    python scripts/authorize_gcalendar.py

It prints a URL — open it in your browser, sign in, copy the code it gives
you, paste it back here. The refresh token is printed at the end.
"""

import json, os, sys
from pathlib import Path

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    sys.exit("Missing package. Run:  pip install google-auth-oauthlib")

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# Read credentials from the existing Drive token file
secrets_dir = Path.home() / "friday-secrets"
token_file  = secrets_dir / "gdrive_notes_token.json"

if not token_file.exists():
    sys.exit(f"Token file not found: {token_file}")

with open(token_file) as f:
    creds = json.load(f)

client_id     = creds.get("client_id")
client_secret = creds.get("client_secret")

if not client_id or not client_secret:
    sys.exit("client_id or client_secret missing from token file.")

client_config = {
    "installed": {
        "client_id":     client_id,
        "client_secret": client_secret,
        "auth_uri":      "https://accounts.google.com/o/oauth2/auth",
        "token_uri":     "https://oauth2.googleapis.com/token",
        "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob"],
    }
}

flow = InstalledAppFlow.from_client_config(client_config, scopes=SCOPES)

# Console flow: prints a URL, you paste back the code — no browser on VM needed
creds_out = flow.run_console()

print("\n" + "=" * 60)
print("SUCCESS — add this to Vercel as GOOGLE_CALENDAR_REFRESH_TOKEN:")
print("=" * 60)
print(creds_out.refresh_token)
print("=" * 60 + "\n")
