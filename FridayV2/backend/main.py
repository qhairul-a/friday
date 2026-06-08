"""
FridayV2 backend entry point.
Starts the Telegram bot AND the dashboard REST API (port 8001) together.

Usage:
    cd FridayV2/backend
    python main.py
"""

import asyncio
import logging

import uvicorn

from integrations.telegram_bot import build_app
from api import app as fastapi_app

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)


async def run_telegram():
    app = build_app()
    print("Friday is online. Listening on Telegram...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=False)
    # Keep running until cancelled
    try:
        await asyncio.Event().wait()
    finally:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()


async def run_api():
    config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=8001, log_level="warning")
    server = uvicorn.Server(config)
    print("Dashboard API running on http://localhost:8001")
    await server.serve()


async def main():
    await asyncio.gather(run_telegram(), run_api())


if __name__ == "__main__":
    asyncio.run(main())
