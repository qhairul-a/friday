#!/usr/bin/env python3
"""
One-time Garmin authentication setup.

Run this script interactively via SSH to authenticate with MFA and cache OAuth tokens.
After this, the 4-hourly sync timer will use cached tokens — no more OTP emails.

Usage (from friday-core directory):
    python scripts/setup_garmin_auth.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from garminconnect import Garmin

TOKENSTORE = os.path.expanduser("~/.garmin_tokens")


def get_mfa() -> str:
    print("\nGarmin has sent a one-time code to your email.")
    code = input("Enter the code here: ").strip()
    return code


def main():
    # Try to load credentials from the user profile first, then env vars.
    email = ""
    password = ""
    try:
        from profile.storage import load_profile
        user_id = os.environ.get("FRIDAY_USER_ID", "default")
        p = load_profile(user_id)
        email    = getattr(p.integrations, "garmin_email",    "").strip()
        password = getattr(p.integrations, "garmin_password", "").strip()
    except Exception:
        pass

    email    = email    or os.environ.get("GARMIN_EMAIL",    "")
    password = password or os.environ.get("GARMIN_PASSWORD", "")

    if not email or not password:
        print("❌ No Garmin credentials found.")
        print("   Either set GARMIN_EMAIL / GARMIN_PASSWORD in .env,")
        print("   or enter them in the Friday dashboard → Settings → Health Metrics.")
        sys.exit(1)

    print(f"Logging in to Garmin Connect as {email} …")
    print("(Garmin may send a one-time code to your email — have it ready.)\n")

    gc = Garmin(email, password, prompt_mfa=get_mfa)
    try:
        gc.login(tokenstore=TOKENSTORE)
    except Exception as e:
        print(f"\n❌ Authentication failed: {e}")
        sys.exit(1)

    print(f"\n✅ OAuth tokens saved to {TOKENSTORE}")
    print("   The 4-hourly sync will now use cached tokens — no more OTP emails.")
    print("   Re-run this script if you ever see 'Garmin auth failed' in the sync logs.\n")

    # Quick sanity-check pull.
    from datetime import date
    today = date.today().isoformat()
    try:
        stats = gc.get_stats(today)
        steps = stats.get("totalSteps", "N/A")
        print(f"✅ Test pull for {today}: {steps:,} steps".replace(",", "_") if isinstance(steps, int) else f"✅ Test pull for {today}: {steps} steps")
    except Exception as e:
        print(f"⚠️  Test pull failed (auth succeeded though): {e}")


if __name__ == "__main__":
    main()
