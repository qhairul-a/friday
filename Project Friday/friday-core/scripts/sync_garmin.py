#!/usr/bin/env python3
"""
Standalone Garmin sync script — called by systemd timer every 4 hours.
Usage: python scripts/sync_garmin.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from integrations.garmin_health import sync_today

user_id = os.environ.get("FRIDAY_USER_ID", "default")
try:
    result = sync_today(user_id)
    print(result)
except Exception as e:
    print(f"Garmin sync failed: {e}", file=sys.stderr)
    sys.exit(1)
