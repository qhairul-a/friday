import io
import os
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes
from voice.stt import transcribe_bytes
from voice.tts import synthesize
from profile.updater import handle_capture
from profile.storage import load_profile
from brain.claude import chat
from integrations.sheets import get_finance_context, extract_sheet_id
from integrations import obsidian

logging.basicConfig(level=logging.INFO)

USER_ID = os.environ.get("FRIDAY_USER_ID", "default")
ALLOWED_TELEGRAM_USER_ID = int(os.environ.get("TELEGRAM_USER_ID", "0"))


def _is_authorized(update: Update) -> bool:
    return update.effective_user.id == ALLOWED_TELEGRAM_USER_ID


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_authorized(update):
        return
    voice_file = await update.message.voice.get_file()
    audio_bytes = await voice_file.download_as_bytearray()
    text = transcribe_bytes(bytes(audio_bytes), suffix=".ogg")
    await update.message.reply_text(f'Heard: "{text}"')
    await _process_text(update, text, voice_reply=True)


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_authorized(update):
        return
    text = update.message.text.strip()
    await _process_text(update, text, voice_reply=False)


async def _process_text(update: Update, text: str, voice_reply: bool = False) -> None:
    result = handle_capture(USER_ID, text)
    profile = load_profile(USER_ID)

    if result["needs_followup"]:
        reply = result["followup_question"]
        await update.message.reply_text(reply)
    elif result["intent"] == "finance_question":
        sheet_id = extract_sheet_id(profile.finance.google_sheet_id)
        finance_ctx = get_finance_context(sheet_id) if sheet_id else "No Google Sheet configured."
        augmented = f"{text}\n\n[Expense data for your reference:\n{finance_ctx}]"
        reply = chat(profile, augmented)
        await update.message.reply_text(reply)
    elif result["intent"] == "notes_query":
        query = result.get("data", {}).get("query", text)
        notes_ctx = obsidian.search_notes(query)
        augmented = f"{text}\n\n[Notes search results for '{query}':\n{notes_ctx}]"
        reply = chat(profile, augmented)
        await update.message.reply_text(reply)
    elif result["intent"] == "question":
        reply = chat(profile, text)
        await update.message.reply_text(reply)
    elif result["intent"] == "task_add":
        reply = f"Got it — task added: {result['summary'].replace('Task added: ', '')}"
        await update.message.reply_text(reply)
    elif result["intent"] == "task_update":
        reply = result["summary"]
        await update.message.reply_text(reply)
    elif result["intent"] == "note_obsidian":
        title = result["summary"].replace("Note saved: ", "")
        reply = f"Noted — saved to Obsidian: {title}"
        await update.message.reply_text(reply)
    else:
        reply = f"Got it. Logged to {result['routed_to']}. {result['summary']}"
        await update.message.reply_text(reply)

    if voice_reply:
        try:
            audio_bytes = synthesize(reply)
            await update.message.reply_voice(voice=io.BytesIO(audio_bytes))
        except Exception as e:
            logging.warning(f"TTS failed: {e}")


def run_bot() -> None:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    app = ApplicationBuilder().token(token).build()
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.run_polling()
