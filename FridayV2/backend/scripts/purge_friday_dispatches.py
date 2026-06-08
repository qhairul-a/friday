"""
One-shot script: deletes any stale dispatches for the old 'friday' agent name
from the friday-voice-session room. Run once, then delete this file.

Usage (from FridayV2/backend/):
    python scripts/purge_friday_dispatches.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from livekit import api

ROOM = "friday-voice-session"
OLD_AGENT = "friday"


async def main() -> None:
    url = os.environ["LIVEKIT_URL"].replace("wss://", "https://").replace("ws://", "http://")
    key = os.environ["LIVEKIT_API_KEY"]
    secret = os.environ["LIVEKIT_API_SECRET"]

    lk = api.LiveKitAPI(url, key, secret)

    try:
        dispatches = await lk.agent_dispatch.list_dispatch(room_name=ROOM)
    except Exception as e:
        print(f"Could not list dispatches (room may not exist yet): {e}")
        return
    finally:
        await lk.aclose()

    stale = [d for d in dispatches if d.agent_name == OLD_AGENT]

    if not stale:
        print(f"No '{OLD_AGENT}' dispatches found in room '{ROOM}'. Nothing to do.")
        return

    lk = api.LiveKitAPI(url, key, secret)
    try:
        for d in stale:
            print(f"Deleting dispatch {d.id}  agent={d.agent_name}  state={d.state} ...")
            await lk.agent_dispatch.delete_dispatch(d.id, room_name=ROOM)
            print(f"  Deleted.")
        print(f"\nDone — removed {len(stale)} stale dispatch(es).")
    finally:
        await lk.aclose()


if __name__ == "__main__":
    asyncio.run(main())
