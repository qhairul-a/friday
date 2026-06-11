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

from api import app as fastapi_app

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)


async def main():
    config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=8001, log_level="warning")
    server = uvicorn.Server(config)
    print("Friday is online. Dashboard API on port 8001, Telegram via webhook.")
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())
