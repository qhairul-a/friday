"""
Telegram interface for FridayV2.
Accepts text and voice messages, routes both to the Friday master agent.
Only responds to the configured TELEGRAM_USER_ID.
"""

import asyncio
import logging
import tempfile
import os
import requests
from datetime import time as dtime
from zoneinfo import ZoneInfo

from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from core.config import settings
from agents.friday import run_friday
from agents.fitness_agent import run_fitness_agent
from integrations.memory import extract_and_save

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Per-user conversation history — keyed by Telegram user ID
_sessions: dict[int, list[dict]] = {}


def _get_history(user_id: int) -> list[dict]:
    return _sessions.get(user_id, [])


def _set_history(user_id: int, history: list[dict]) -> None:
    # Keep last 20 turns to bound memory and token cost
    _sessions[user_id] = history[-40:]


def _is_authorized(update: Update) -> bool:
    return update.effective_user.id == settings.TELEGRAM_USER_ID


def _transcribe_voice(file_path: str) -> str:
    """Transcribe a voice file using Deepgram REST API."""
    url = "https://api.deepgram.com/v1/listen?model=nova-2&language=en"
    headers = {
        "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
        "Content-Type": "audio/ogg",
    }
    with open(file_path, "rb") as f:
        response = requests.post(url, headers=headers, data=f, timeout=30)
    response.raise_for_status()
    data = response.json()
    transcript = (
        data.get("results", {})
        .get("channels", [{}])[0]
        .get("alternatives", [{}])[0]
        .get("transcript", "")
    )
    return transcript.strip()


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_authorized(update):
        return
    await update.message.reply_text("Hey, I'm Friday. What do you need?")


async def clear(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_authorized(update):
        return
    _sessions.pop(update.effective_user.id, None)
    await update.message.reply_text("Conversation cleared.")


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_authorized(update):
        return

    user_input = update.message.text.strip()
    if not user_input:
        return

    history = _get_history(update.effective_user.id)
    try:
        response, updated_history = await asyncio.to_thread(run_friday, user_input, history)
        _set_history(update.effective_user.id, updated_history)
        await update.message.reply_text(response)
        asyncio.create_task(asyncio.to_thread(extract_and_save, user_input, response))
    except Exception as e:
        logger.error("handle_text failed: %s", e, exc_info=True)
        await update.message.reply_text("Sorry, something went wrong. Try again.")


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_authorized(update):
        return

    await update.message.reply_text("Transcribing…")

    voice_file = await update.message.voice.get_file()
    with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        await voice_file.download_to_drive(tmp_path)
        transcript = await asyncio.to_thread(_transcribe_voice, tmp_path)
    finally:
        os.unlink(tmp_path)

    if not transcript:
        await update.message.reply_text("Sorry, I couldn't make out that voice message.")
        return

    history = _get_history(update.effective_user.id)
    try:
        response, updated_history = await asyncio.to_thread(run_friday, transcript, history)
        _set_history(update.effective_user.id, updated_history)
        await update.message.reply_text(f'_"{transcript}"_\n\n{response}', parse_mode="Markdown")
        asyncio.create_task(asyncio.to_thread(extract_and_save, transcript, response))
    except Exception as e:
        logger.error("handle_voice run_friday failed: %s", e, exc_info=True)
        await update.message.reply_text("Sorry, something went wrong processing your voice message.")


async def send_daily_health_push(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Scheduled job: sync Garmin data and send a morning health brief to the user."""
    try:
        summary = run_fitness_agent(
            "Sync today's fitness data, then give me a morning health brief — "
            "key metrics, sleep quality, recovery state, and one actionable tip for the day."
        )
        await context.bot.send_message(chat_id=settings.TELEGRAM_USER_ID, text=summary)
    except Exception as e:
        logger.error("Daily health push failed: %s", e)


def build_app():
    app = ApplicationBuilder().token(settings.TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("clear", clear))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))

    # Daily health push from Garmin
    h, m = map(int, settings.GARMIN_DAILY_PUSH_TIME.split(":"))
    push_time = dtime(h, m, tzinfo=ZoneInfo(settings.TIMEZONE))
    app.job_queue.run_daily(send_daily_health_push, time=push_time)

    return app
