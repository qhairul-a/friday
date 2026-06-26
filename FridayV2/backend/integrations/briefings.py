"""
Briefings — DB CRUD + message builder.
Each briefing defines a time, enabled flag, and a list of content sections
(weather, calendar, tasks, routines, finance).
"""

import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo

from core.config import settings
from core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

VALID_SECTIONS = {"weather", "calendar", "tasks", "routines", "finance"}


# ── DB helpers ────────────────────────────────────────────────────────────────

def list_briefings() -> list[dict]:
    return get_supabase().table("briefings").select("*").order("send_time").execute().data


def get_briefing(briefing_id: str) -> dict | None:
    r = get_supabase().table("briefings").select("*").eq("id", briefing_id).maybe_single().execute()
    return r.data


def create_briefing(name: str, send_time: str, enabled: bool, sections: list[str]) -> dict:
    r = get_supabase().table("briefings").insert({
        "name": name,
        "send_time": send_time,
        "enabled": enabled,
        "sections": [s for s in sections if s in VALID_SECTIONS],
    }).execute()
    return r.data[0]


def update_briefing(briefing_id: str, **fields) -> dict:
    allowed = {"name", "send_time", "enabled", "sections"}
    payload = {k: v for k, v in fields.items() if k in allowed}
    if "sections" in payload:
        payload["sections"] = [s for s in payload["sections"] if s in VALID_SECTIONS]
    r = get_supabase().table("briefings").update(payload).eq("id", briefing_id).execute()
    return r.data[0]


def delete_briefing(briefing_id: str) -> None:
    get_supabase().table("briefings").delete().eq("id", briefing_id).execute()


# ── Section data fetchers ─────────────────────────────────────────────────────

def _today() -> str:
    return date.today().isoformat()


def _section_weather() -> str:
    try:
        from integrations.weather import fetch_weather
        w = fetch_weather(settings.HOME_LAT, settings.HOME_LON)
        return (
            f"🌤 *Weather* — {w['icon']} {w['temp']}°C, {w['description']}\n"
            f"  Feels like {w['feels_like']}°C · H:{w['temp_max']}° L:{w['temp_min']}°\n"
            f"  💧{w['humidity']}%  💨{w['wind_speed']} km/h {w['wind_dir']}"
        )
    except Exception as e:
        logger.warning("Weather section failed: %s", e)
        return "🌤 *Weather* — unavailable"


def _section_calendar() -> str:
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
        SCOPES = ["https://www.googleapis.com/auth/calendar"]
        creds = Credentials.from_authorized_user_file(str(settings.GDRIVE_TOKEN_FILE), SCOPES)
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
        service = build("calendar", "v3", credentials=creds)
        tz = ZoneInfo(settings.TIMEZONE)
        today = date.today()
        time_min = datetime(today.year, today.month, today.day, 0, 0, 0, tzinfo=tz)
        time_max = datetime(today.year, today.month, today.day, 23, 59, 59, tzinfo=tz)
        result = service.events().list(
            calendarId="primary",
            timeMin=time_min.isoformat(),
            timeMax=time_max.isoformat(),
            maxResults=20,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        events = result.get("items", [])
        if not events:
            return "📅 *Today's Events* — none"
        lines = [f"📅 *Today's Events* ({len(events)})"]
        for e in events:
            start_raw = e["start"].get("dateTime", e["start"].get("date", ""))
            try:
                t = datetime.fromisoformat(start_raw).astimezone(tz).strftime("%H:%M")
            except Exception:
                t = start_raw[:10]
            lines.append(f"  · {t} — {e.get('summary', 'Untitled')}")
        return "\n".join(lines)
    except Exception as e:
        logger.warning("Calendar section failed: %s", e)
        return "📅 *Today's Events* — unavailable"


def _section_tasks() -> str:
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
        SCOPES = ["https://www.googleapis.com/auth/tasks"]
        creds = Credentials.from_authorized_user_file(str(settings.GDRIVE_TOKEN_FILE), SCOPES)
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
        service = build("tasks", "v1", credentials=creds)
        today = _today()
        lists_res = service.tasklists().list(maxResults=100).execute()
        due_today = []
        for lst in lists_res.get("items", []):
            res = service.tasks().list(tasklist=lst["id"], showCompleted=False, maxResults=100).execute()
            for t in res.get("items", []):
                due = (t.get("due") or "")[:10]
                if due == today:
                    due_today.append(t.get("title", "Untitled"))
        if not due_today:
            return "✅ *Tasks Due Today* — none"
        lines = [f"✅ *Tasks Due Today* ({len(due_today)})"]
        for title in due_today:
            lines.append(f"  · {title}")
        return "\n".join(lines)
    except Exception as e:
        logger.warning("Tasks section failed: %s", e)
        return "✅ *Tasks Due Today* — unavailable"


def _section_routines() -> str:
    try:
        from integrations.routines import _reset_stale
        result = get_supabase().table("routines").select("*").order("scheduled_time").execute()
        routines = _reset_stale(result.data)
        done = [r for r in routines if r["is_done"]]
        pending = [r for r in routines if not r["is_done"]]
        if not routines:
            return "🔁 *Routines* — none configured"
        lines = [f"🔁 *Routines* — {len(done)}/{len(routines)} done"]
        for r in done:
            lines.append(f"  ✓ {r['name']}")
        for r in pending:
            lines.append(f"  ○ {r['name']}")
        return "\n".join(lines)
    except Exception as e:
        logger.warning("Routines section failed: %s", e)
        return "🔁 *Routines* — unavailable"


def _section_finance() -> str:
    try:
        from integrations.gsheets import get_all_rows
        from integrations.finance import _variable_id, _parse_amount
        today = _today()
        month = today[:7]
        rows = get_all_rows(_variable_id())
        today_rows = [
            {k.lower(): v for k, v in r.items()}
            for r in rows
            if str(r.get("Date", r.get("date", ""))).startswith(today)
        ]
        if not today_rows:
            return "💰 *Spending Today* — none recorded"
        total = sum(_parse_amount(r.get("amount", 0)) for r in today_rows)
        lines = [f"💰 *Spending Today* — {settings.CURRENCY} {total:.2f}"]
        for r in today_rows:
            amt = _parse_amount(r.get("amount", 0))
            lines.append(f"  · {r.get('category','?')}: {r.get('description','?')} ({settings.CURRENCY} {amt:.2f})")
        return "\n".join(lines)
    except Exception as e:
        logger.warning("Finance section failed: %s", e)
        return "💰 *Spending Today* — unavailable"


_SECTION_BUILDERS = {
    "weather":  _section_weather,
    "calendar": _section_calendar,
    "tasks":    _section_tasks,
    "routines": _section_routines,
    "finance":  _section_finance,
}


# ── Message sender ────────────────────────────────────────────────────────────

async def send_briefing(briefing_id: str, bot) -> None:
    """Build and send a briefing message for the given briefing ID."""
    briefing = get_briefing(briefing_id)
    if not briefing or not briefing.get("enabled"):
        return

    sections = briefing.get("sections") or []
    header = f"*{briefing['name']}*"
    blocks = [header]

    for section in sections:
        builder = _SECTION_BUILDERS.get(section)
        if builder:
            try:
                blocks.append(builder())
            except Exception as e:
                logger.error("Section %s failed: %s", section, e)

    if len(blocks) == 1:
        blocks.append("_(no sections configured)_")

    message = "\n\n".join(blocks)
    await bot.send_message(
        chat_id=settings.TELEGRAM_USER_ID,
        text=message,
        parse_mode="Markdown",
    )
