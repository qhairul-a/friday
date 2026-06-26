"""
LiveKit voice agent for FridayV2.
Pipeline: browser mic → Deepgram STT → Claude → Deepgram TTS → browser speaker.
Run: python voice/livekit_agent.py dev   (from FridayV2/backend/)
"""

import asyncio
import http.server
import logging
import os
import re
import socketserver
import sys
import threading
import urllib.parse
from datetime import datetime
from zoneinfo import ZoneInfo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def _start_health_server() -> None:
    """Bind a minimal HTTP health server on $PORT for Cloud Run startup probe."""
    port = int(os.environ.get("PORT", 8080))

    class _H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')

        def log_message(self, *args):
            pass

    try:
        httpd = socketserver.TCPServer(("", port), _H)
        httpd.allow_reuse_address = True
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        logging.info("[friday-voice] health server started on port %d", port)
    except Exception as e:
        logging.warning("[friday-voice] could not start health server: %s", e)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))


def _materialize_secrets() -> None:
    """Write Google credential env vars to /app/secrets/ — mirrors what startup.sh does for the main service."""
    import base64
    from pathlib import Path

    secrets_dir = Path(os.environ.get("SECRETS_DIR", "/app/secrets"))
    secrets_dir.mkdir(parents=True, exist_ok=True)

    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET_JSON", "")
    if client_secret:
        (secrets_dir / "google-client-secret.json").write_text(client_secret)

    token_json = os.environ.get("GDRIVE_TOKEN_JSON", "")
    if token_json:
        (secrets_dir / "gdrive_token.json").write_text(token_json)


_materialize_secrets()

from livekit import rtc
from livekit.agents import AgentSession, Agent, function_tool, JobContext, WorkerOptions, cli, room_io
from livekit.plugins import deepgram, anthropic

import requests as _http

from core.config import settings
from integrations.gdrive_notes import (
    save_note, list_notes, search_notes, read_note, edit_note, delete_note, search_vault,
)
from integrations.gcal import (
    get_upcoming_events, create_event, find_events, delete_event as delete_cal_event,
)
from integrations.gtasks import (
    list_tasks, create_task, complete_task, update_task, delete_task,
)
from integrations.routines import (
    list_routines, add_routine, edit_routine, delete_routine,
    mark_routine_done, mark_routine_undone,
)
from integrations.tavily import search_web
from integrations.finance import (
    list_fixed_expenses, add_fixed_expense, edit_fixed_expense, delete_fixed_expense,
    list_variable_expenses, add_variable_expense, edit_variable_expense,
    delete_variable_expense, get_financial_summary,
)
from integrations.memory import load_memory


_NAV_RE = re.compile(
    r"(?:navigate|navigation|directions?)\s+to\s+(.+)"
    r"|how\s+(?:do\s+i\s+|to\s+)?(?:get|go)\s+to\s+(.+)"
    r"|(?:i\s+)?(?:need|want|wanna|trying)\s+to\s+(?:get|go|head|travel)\s+to\s+(.+)"
    r"|take\s+me\s+to\s+(.+)"
    r"|get\s+me\s+to\s+(.+)"
    r"|(?:route|way|path)\s+to\s+(.+)"
    r"|heading\s+(?:to|towards?)\s+(.+)"
    r"|(?:find|show)\s+(?:me\s+)?(?:the\s+)?(?:directions?|route|way)\s+(?:to\s+)?(.+)"
    r"|(?:maps?\s+(?:to|for))\s+(.+)"
    r"|(?:wanna|gonna)\s+(?:get|go|head)\s+to\s+(.+)",
    re.IGNORECASE,
)


def _nav_destination(text: str):
    m = _NAV_RE.search(text.strip().rstrip("?.!"))
    return next((g.strip().rstrip("?.!") for g in m.groups() if g), None) if m else None


VOICE_SYSTEM_PROMPT_BASE = """\
You are Friday, Qhairul's personal AI assistant. You are warm, upbeat, and genuinely happy to help.
You speak like a close, trusted friend who is also highly capable — not a formal assistant or a customer service bot.
Keep responses concise and natural — you're talking, not writing. No bullet points, no markdown.
When you complete a task, confirm it briefly and warmly in one sentence.

Capabilities:
- Notes: save, list, search, read, edit, delete notes in Google Drive; search entire Obsidian vault.
- Calendar: get upcoming events, search events, create events, delete events. All times are Asia/Singapore — never mention UTC.
- Tasks: list, create, complete, update, delete Google Tasks.
- Routines: list, add, edit, delete routines; mark done or undone.
- Finance: list/add/edit/delete fixed and variable expenses; get financial summary with trends.
- Web search: search the web for current events, news, facts, or any question. Always use this for anything outside your knowledge — never refuse.
- Navigation: get Google Maps directions to any destination — sends a tappable link to Telegram.

Navigation rules (never break these):
- Trigger on ANY of: "navigate to", "directions to", "how do I get to", "I want/need to get/go to", "take me to", "way to", "route to", "heading to". Call tool_get_directions immediately.
- NEVER ask for the user's starting location, current location, or GPS. You do not need it.
- NEVER say you lack location access. Just call the tool with the destination name.
- The tool sends the link to Telegram automatically — tell the user to check their Telegram.

Finance rules:
- Variable expenses come from Google Sheets (use list_variable_expenses or get_financial_summary).
- Fixed expenses are recurring monthly costs (subscriptions, rent, bills).
- When logging an expense, always confirm amount, category, and date with the user first.
- Currency is {currency}.

Web search rules:
- Always call search_web for current events, prices, news, recommendations, or anything time-sensitive.
- After searching, summarise in 2–3 spoken sentences and offer to save as a note if relevant.

Here is what I know about Qhairul:
{memory}
"""


class FridayVoiceAgent(Agent):

    def __init__(self, instructions: str) -> None:
        super().__init__(instructions=instructions)

    async def llm_node(self, chat_ctx, tools, model_settings):
        """Intercept navigation requests before Haiku sees them."""
        msgs = chat_ctx.messages()
        if msgs:
            last = msgs[-1]
            if last.role == "user" and last.text_content:
                dest = _nav_destination(last.text_content)
                if dest:
                    mode = "driving"
                    t = last.text_content
                    if re.search(r"\bwalk(ing)?\b", t, re.IGNORECASE):
                        mode = "walking"
                    elif re.search(r"\btransit\b|\bbus\b|\bMRT\b|\btrain\b", t, re.IGNORECASE):
                        mode = "transit"
                    elif re.search(r"\bcycl(e|ing)\b|\bbik(e|ing)\b", t, re.IGNORECASE):
                        mode = "bicycling"
                    encoded = urllib.parse.quote_plus(dest)
                    url = f"https://www.google.com/maps/dir/?api=1&destination={encoded}&travelmode={mode}"
                    try:
                        _http.post(
                            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                            json={"chat_id": settings.TELEGRAM_USER_ID,
                                  "text": f"📍 {mode.title()} directions to {dest}:\n{url}"},
                            timeout=5,
                        )
                    except Exception:
                        pass
                    return f"Done — I've sent the Google Maps {mode} directions for {dest} to your Telegram."
        return Agent.default.llm_node(self, chat_ctx, tools, model_settings)

    # ── Notes ──────────────────────────────────────────────────────────────────

    @function_tool
    async def tool_save_note(self, title: str, content: str) -> str:
        """Save a note to Google Drive."""
        return await asyncio.to_thread(save_note, title, content)

    @function_tool
    async def tool_list_notes(self, limit: int = 10) -> str:
        """List recent Friday notes."""
        return await asyncio.to_thread(list_notes, limit)

    @function_tool
    async def tool_search_notes(self, query: str) -> str:
        """Search Friday notes by keyword."""
        return await asyncio.to_thread(search_notes, query)

    @function_tool
    async def tool_read_note(self, title_query: str) -> str:
        """Read the full content of a note by partial title."""
        return await asyncio.to_thread(read_note, title_query)

    @function_tool
    async def tool_edit_note(self, title_query: str, new_content: str) -> str:
        """Replace the content of an existing note."""
        return await asyncio.to_thread(edit_note, title_query, new_content)

    @function_tool
    async def tool_delete_note(self, title_query: str) -> str:
        """Delete a note by partial title. Always confirm with the user first."""
        return await asyncio.to_thread(delete_note, title_query)

    @function_tool
    async def tool_search_vault(self, query: str) -> str:
        """Search the entire Obsidian vault (all folders) for a keyword."""
        return await asyncio.to_thread(search_vault, query)

    # ── Calendar ───────────────────────────────────────────────────────────────

    @function_tool
    async def tool_get_upcoming_events(self, days: int = 7) -> str:
        """Get upcoming Google Calendar events for the next N days."""
        return await asyncio.to_thread(get_upcoming_events, days)

    @function_tool
    async def tool_find_events(self, query: str) -> str:
        """Search calendar events by keyword."""
        return await asyncio.to_thread(find_events, query)

    @function_tool
    async def tool_create_event(self, title: str, start_datetime: str, end_datetime: str, description: str = "") -> str:
        """Create a Google Calendar event. start_datetime and end_datetime are ISO 8601 with timezone offset, e.g. '2026-06-05T15:00:00+08:00'."""
        return await asyncio.to_thread(create_event, title, start_datetime, end_datetime, description or None)

    @function_tool
    async def tool_delete_event(self, query: str) -> str:
        """Delete a calendar event by keyword. Always confirm with the user first."""
        return await asyncio.to_thread(delete_cal_event, query)

    # ── Tasks ──────────────────────────────────────────────────────────────────

    @function_tool
    async def tool_list_tasks(self, show_completed: bool = False) -> str:
        """List Google Tasks. Set show_completed=true to include completed tasks."""
        return await asyncio.to_thread(list_tasks, show_completed)

    @function_tool
    async def tool_create_task(self, title: str, due: str = "", notes: str = "") -> str:
        """Create a Google Task. due is RFC 3339 e.g. '2026-06-10T00:00:00.000Z'."""
        return await asyncio.to_thread(create_task, title, due or None, notes or None)

    @function_tool
    async def tool_complete_task(self, query: str) -> str:
        """Mark a task as completed by partial title match."""
        return await asyncio.to_thread(complete_task, query)

    @function_tool
    async def tool_update_task(self, query: str, title: str = "", due: str = "", notes: str = "") -> str:
        """Update a task's title, due date, or notes by partial title match."""
        return await asyncio.to_thread(update_task, query, title or None, due or None, notes or None)

    @function_tool
    async def tool_delete_task(self, query: str) -> str:
        """Delete a task by partial title match. Always confirm with the user first."""
        return await asyncio.to_thread(delete_task, query)

    # ── Routines ───────────────────────────────────────────────────────────────

    @function_tool
    async def tool_list_routines(self) -> str:
        """List all daily routines with their done/undone status."""
        return await asyncio.to_thread(list_routines)

    @function_tool
    async def tool_add_routine(self, name: str, scheduled_time: str = "", days_of_week: list = None) -> str:
        """Add a new routine. scheduled_time is HH:MM, days_of_week is a list like ['Monday', 'Wednesday']."""
        return await asyncio.to_thread(add_routine, name, scheduled_time or None, days_of_week)

    @function_tool
    async def tool_edit_routine(self, query: str, name: str = "", scheduled_time: str = "", days_of_week: list = None) -> str:
        """Edit a routine by partial name match."""
        return await asyncio.to_thread(edit_routine, query, name or None, scheduled_time or None, days_of_week)

    @function_tool
    async def tool_delete_routine(self, query: str) -> str:
        """Delete a routine by partial name match. Always confirm with the user first."""
        return await asyncio.to_thread(delete_routine, query)

    @function_tool
    async def tool_mark_routine_done(self, query: str) -> str:
        """Mark a routine as done for today."""
        return await asyncio.to_thread(mark_routine_done, query)

    @function_tool
    async def tool_mark_routine_undone(self, query: str) -> str:
        """Mark a routine as not done (undo a check-off)."""
        return await asyncio.to_thread(mark_routine_undone, query)

    # ── Web search ─────────────────────────────────────────────────────────────

    @function_tool
    async def tool_search_web(self, query: str) -> str:
        """Search the internet for current information, news, facts, or answers. Always call this for anything time-sensitive or outside your knowledge."""
        return await asyncio.to_thread(search_web, query)

    # ── Finance ────────────────────────────────────────────────────────────────

    @function_tool
    async def tool_get_financial_summary(self, month: str = "") -> str:
        """Get a full financial summary with fixed costs, variable spending by category, and monthly trends. month is YYYY-MM, empty for current month."""
        return await asyncio.to_thread(get_financial_summary, month or None)

    @function_tool
    async def tool_list_variable_expenses(self, month: str = "") -> str:
        """List individual variable (day-to-day) expense entries. month is YYYY-MM, empty for current month."""
        return await asyncio.to_thread(list_variable_expenses, month or None)

    @function_tool
    async def tool_add_variable_expense(self, date: str, category: str, description: str, amount: float) -> str:
        """Log a variable expense. date is YYYY-MM-DD."""
        return await asyncio.to_thread(add_variable_expense, date, category, description, amount)

    @function_tool
    async def tool_edit_variable_expense(self, query: str, date: str = "", category: str = "", description: str = "", amount: float = 0) -> str:
        """Edit a variable expense by description keyword."""
        return await asyncio.to_thread(
            edit_variable_expense, query,
            date or None, category or None, description or None, amount if amount else None,
        )

    @function_tool
    async def tool_delete_variable_expense(self, query: str, date: str = "") -> str:
        """Delete a variable expense by description keyword. Always confirm with the user first."""
        return await asyncio.to_thread(delete_variable_expense, query, date or None)

    @function_tool
    async def tool_list_fixed_expenses(self) -> str:
        """List all fixed monthly expenses (subscriptions, rent, bills)."""
        return await asyncio.to_thread(list_fixed_expenses)

    @function_tool
    async def tool_add_fixed_expense(self, item: str, cost: float, comments: str = "") -> str:
        """Add a new fixed monthly expense."""
        return await asyncio.to_thread(add_fixed_expense, item, cost, comments)

    @function_tool
    async def tool_edit_fixed_expense(self, query: str, cost: float = 0, comments: str = "") -> str:
        """Edit a fixed expense by partial item name."""
        return await asyncio.to_thread(edit_fixed_expense, query, cost if cost else None, comments or None)

    @function_tool
    async def tool_delete_fixed_expense(self, query: str) -> str:
        """Delete a fixed expense by partial item name. Always confirm with the user first."""
        return await asyncio.to_thread(delete_fixed_expense, query)

    # ── Navigation ─────────────────────────────────────────────────────────────

    @function_tool
    async def tool_get_directions(self, destination: str, mode: str = "driving") -> str:
        """Get Google Maps directions to a destination and send the link to Telegram.
        mode: driving | walking | transit | bicycling. No location data needed."""
        import urllib.parse
        import requests as _req
        encoded = urllib.parse.quote_plus(destination)
        url = f"https://www.google.com/maps/dir/?api=1&destination={encoded}&travelmode={mode}"
        msg = f"📍 {mode.title()} directions to {destination}:\n{url}"
        try:
            _req.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": settings.TELEGRAM_USER_ID, "text": msg},
                timeout=5,
            )
        except Exception:
            pass
        return f"Done — I've sent the Google Maps link for {destination} to your Telegram."


async def entrypoint(ctx: JobContext):
    logging.info("[friday] entrypoint started — connecting to room")
    await ctx.connect()
    logging.info("[friday] connected to LiveKit room")

    # Load user memory — 8s timeout so a slow Supabase never blocks the session.
    try:
        memory_ctx = await asyncio.wait_for(asyncio.to_thread(load_memory), timeout=8.0)
        logging.info("[friday] memory loaded")
    except Exception as e:
        logging.warning("[friday] load_memory failed or timed out (%s), continuing without memory", e)
        memory_ctx = "(Memory unavailable)"

    tz = ZoneInfo(settings.TIMEZONE)
    now = datetime.now(tz).strftime("%A, %d %B %Y, %I:%M %p")
    instructions = (
        f"Today is {now} (Asia/Singapore).\n\n"
        + VOICE_SYSTEM_PROMPT_BASE.format(
            currency=settings.CURRENCY,
            memory=memory_ctx,
        )
    )

    logging.info("[friday] building AgentSession")
    session = AgentSession(
        stt=deepgram.STT(api_key=settings.DEEPGRAM_API_KEY, model="nova-2"),
        llm=anthropic.LLM(
            model=settings.FRIDAY_MODEL,
            api_key=settings.ANTHROPIC_API_KEY,
            _strict_tool_schema=False,
        ),
        tts=deepgram.TTS(
            model="aura-2-asteria-en",
            api_key=settings.DEEPGRAM_API_KEY,
        ),
    )

    logging.info("[friday] starting session")
    await session.start(FridayVoiceAgent(instructions), room=ctx.room)
    logging.info("[friday] session started — generating greeting")

    try:
        await session.generate_reply(instructions=(
            "Greet Qhairul warmly and with genuine enthusiasm — like you've been looking forward to hearing from him. "
            "Use his name. Keep it to 1–2 sentences. Sound like a close, upbeat assistant, not a customer service bot."
        ))
        logging.info("[friday] greeting sent")
    except Exception as e:
        logging.warning("[friday] initial greeting failed (%s) — Friday is still listening", e)

    disconnected = asyncio.Event()
    ctx.room.on("disconnected", lambda *_: disconnected.set())
    await disconnected.wait()


if __name__ == "__main__":
    _start_health_server()
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name="friday-2.0",
        num_idle_processes=1,
        initialize_process_timeout=120.0,
        load_fnc=lambda: 0.0,
    ))
