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
from integrations.memory import extract_and_save
from integrations.healthcheck import check_all
from integrations.conversation_history import load_history, save_messages

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Module-level reference so api.py can trigger reschedules
_tg_app = None


def _get_history() -> list[dict]:
    return load_history()


def _persist_turn(user_input: str, response: str) -> None:
    save_messages([
        {"role": "user", "content": user_input},
        {"role": "assistant", "content": response},
    ], source="telegram")


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


async def health_check_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_authorized(update):
        return
    await update.message.reply_text("Running checks…")
    result = await asyncio.to_thread(check_all)
    await update.message.reply_text(result, parse_mode="Markdown")


async def _daily_health_check(context: ContextTypes.DEFAULT_TYPE) -> None:
    try:
        result = await asyncio.to_thread(check_all)
        await context.bot.send_message(
            chat_id=settings.TELEGRAM_USER_ID,
            text=result,
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error("Daily health check failed: %s", e)


async def _weekly_deep_check(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Sunday 09:00 SGT — deeper check including Google token age."""
    lines = ["🔍 *Weekly Deep Check — Sunday Report*\n"]

    # 1. All standard integration checks
    try:
        from integrations.healthcheck import check_all
        base = await asyncio.to_thread(check_all)
        # strip the header line, keep individual results
        for line in base.splitlines()[1:]:
            lines.append(line)
    except Exception as e:
        lines.append(f"❌ Health checks failed: {e}")

    # 2. Google token age check
    lines.append("")
    lines.append("*Google OAuth token:*")
    try:
        from integrations.gcal import _get_service
        from google.oauth2.credentials import Credentials
        from core.config import settings as _s
        SCOPES = [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/tasks",
        ]
        creds = Credentials.from_authorized_user_file(str(_s.GDRIVE_TOKEN_FILE), SCOPES)
        if creds.expired:
            lines.append("⚠️ Token expired — will auto-refresh on next use")
        elif creds.valid:
            lines.append("✅ Token valid")
        else:
            lines.append("⚠️ Token state unknown")
    except Exception as e:
        lines.append(f"❌ Token check failed: {e}")

    msg = "\n".join(lines)
    try:
        await context.bot.send_message(
            chat_id=settings.TELEGRAM_USER_ID,
            text=msg,
            parse_mode="Markdown",
        )
    except Exception as e:
        logger.error("Weekly deep check send failed: %s", e)


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

    history = await asyncio.to_thread(_get_history)
    try:
        response, _ = await asyncio.to_thread(run_friday, user_input, history)
        asyncio.create_task(asyncio.to_thread(_persist_turn, user_input, response))
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

    history = await asyncio.to_thread(_get_history)
    try:
        response, _ = await asyncio.to_thread(run_friday, transcript, history)
        asyncio.create_task(asyncio.to_thread(_persist_turn, transcript, response))
        await update.message.reply_text(f'_"{transcript}"_\n\n{response}', parse_mode="Markdown")
        asyncio.create_task(asyncio.to_thread(extract_and_save, transcript, response))
    except Exception as e:
        logger.error("handle_voice run_friday failed: %s", e, exc_info=True)
        await update.message.reply_text("Sorry, something went wrong processing your voice message.")


def _schedule_briefing(job_queue, b: dict) -> None:
    """Schedule a single enabled briefing in the job queue."""
    h, m = map(int, b["send_time"].split(":"))
    bid = b["id"]

    async def _fire(context: ContextTypes.DEFAULT_TYPE) -> None:
        from integrations.briefings import send_briefing
        await send_briefing(bid, context.bot)

    job_queue.run_daily(
        _fire,
        time=dtime(h, m, tzinfo=ZoneInfo(settings.TIMEZONE)),
        name=f"briefing_{bid}",
    )


async def reschedule_briefings() -> None:
    """Remove all briefing jobs and re-add from Supabase. Called after any briefing CRUD."""
    if _tg_app is None:
        return
    for job in _tg_app.job_queue.jobs():
        if job.name and job.name.startswith("briefing_"):
            job.schedule_removal()
    try:
        from integrations.briefings import list_briefings
        for b in list_briefings():
            if b.get("enabled"):
                _schedule_briefing(_tg_app.job_queue, b)
        logger.info("Briefings rescheduled: %d active", sum(
            1 for b in list_briefings() if b.get("enabled")
        ))
    except Exception as e:
        logger.error("reschedule_briefings failed: %s", e)


async def _task_reminder_check(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Daily 08:00 SGT — ask Friday to check for tasks due in 48 hours and push a reminder if any exist."""
    try:
        await asyncio.to_thread(
            run_friday,
            (
                "[BACKGROUND SYSTEM CHECK — do not treat this as a user message] "
                "Check my Google Tasks for any items due within the next 48 hours. "
                "If you find any, compose a concise reminder and send it to me using the send_telegram tool. "
                "If nothing is due soon, do nothing silently."
            ),
            [],  # empty history — internal trigger, not a real conversation turn
        )
    except Exception as e:
        logger.error("Task reminder check failed: %s", e)


def build_app():
    global _tg_app
    # updater(None) disables long-polling — updates arrive via webhook instead
    app = ApplicationBuilder().token(settings.TELEGRAM_BOT_TOKEN).updater(None).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("clear", clear))
    app.add_handler(CommandHandler("check", health_check_cmd))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))

    # Daily integration health check at 07:30 SGT
    app.job_queue.run_daily(_daily_health_check, time=dtime(7, 30, tzinfo=ZoneInfo(settings.TIMEZONE)))

    # Weekly deep check every Sunday at 09:00 SGT
    app.job_queue.run_daily(
        _weekly_deep_check,
        time=dtime(9, 0, tzinfo=ZoneInfo(settings.TIMEZONE)),
        days=(6,),  # 6 = Sunday
    )

    # Daily task reminder check at 08:00 SGT
    app.job_queue.run_daily(_task_reminder_check, time=dtime(8, 0, tzinfo=ZoneInfo(settings.TIMEZONE)))

    # Load all enabled briefings from Supabase
    try:
        from integrations.briefings import list_briefings
        for b in list_briefings():
            if b.get("enabled"):
                _schedule_briefing(app.job_queue, b)
        logger.info("Briefings loaded from DB on startup.")
    except Exception as e:
        logger.warning("Could not load briefings on startup: %s", e)

    _tg_app = app
    return app
