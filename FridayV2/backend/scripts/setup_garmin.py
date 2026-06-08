"""
One-time Garmin Connect authentication setup.

Run this script once to authenticate and save tokens to secrets/garmin_tokens/.
Tokens auto-refresh after that — no re-runs needed unless you change your password.

Usage:
    cd FridayV2/backend
    python scripts/setup_garmin.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from garminconnect import Garmin
from core.config import settings


def get_mfa_code() -> str:
    return input("Enter your Garmin MFA/2FA code: ").strip()


def main():
    if not settings.GARMIN_EMAIL or not settings.GARMIN_PASSWORD:
        print("ERROR: GARMIN_EMAIL and GARMIN_PASSWORD must be set in .env")
        sys.exit(1)

    token_dir = settings.GARMIN_TOKEN_DIR
    token_dir.mkdir(parents=True, exist_ok=True)

    print(f"Authenticating as {settings.GARMIN_EMAIL}...")
    print("Enter your 2FA code when prompted.\n")

    try:
        garmin = Garmin(
            email=settings.GARMIN_EMAIL,
            password=settings.GARMIN_PASSWORD,
            is_cn=False,
            prompt_mfa=get_mfa_code,
        )
        garmin.login()
        garmin.client.dump(str(token_dir))
        print(f"\n✓ Token saved to {token_dir}/garmin_tokens.json")
        print("Garmin setup complete. Friday can now access your fitness data.")

    except Exception as e:
        print(f"\nAuthentication failed: {type(e).__name__}: {e}")
        if "429" in str(e):
            print(
                "\nGarmin is rate-limiting logins. Try:\n"
                "  • Switch to a different network (mobile hotspot)\n"
                "  • Wait 1-2 hours if account-level rate limited\n"
            )
        sys.exit(1)


if __name__ == "__main__":
    main()
