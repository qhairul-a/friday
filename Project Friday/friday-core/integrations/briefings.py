from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
import os
from supabase import create_client

_supabase = None

def _client():
    global _supabase
    if _supabase is None:
        _supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _supabase


def get_pending_briefing(user_id: str) -> dict | None:
    """Return the first enabled briefing scheduled for now that hasn't been delivered today."""
    tz = ZoneInfo(os.environ.get("TIMEZONE", "Asia/Singapore"))
    now = datetime.now(tz)
    today_js = (now.weekday() + 1) % 7  # Python Mon=0 → JS Sun=0
    today_str = date.today().isoformat()

    rows = (
        _client()
        .table("briefings")
        .select("*")
        .eq("user_id", user_id)
        .eq("enabled", True)
        .execute()
        .data
    )

    for b in rows:
        if today_js not in b["schedule_days"]:
            continue
        if b.get("last_delivered_date") == today_str:
            continue
        # schedule_time comes back as "HH:MM:SS" from Supabase time column
        h, m = map(int, b["schedule_time"].split(":")[:2])
        scheduled = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if scheduled <= now <= scheduled + timedelta(hours=3):
            return b

    return None


def mark_delivered(briefing_id: str) -> None:
    """Mark a briefing as delivered today so it won't be offered again until tomorrow."""
    _client().table("briefings").update(
        {"last_delivered_date": date.today().isoformat()}
    ).eq("id", briefing_id).execute()


def build_briefing_content(briefing: dict, user_id: str, profile) -> str:
    """Fetch data for each selected widget and return a text block for Friday to read aloud."""
    from integrations.routines import get_routines
    from integrations.expenses import get_finance_context
    from integrations.calendar import get_upcoming_events

    client = _client()
    parts = []
    widgets = briefing.get("widgets", [])

    if "tasks" in widgets:
        tasks = (
            client.table("tasks")
            .select("title,due_date,priority,status")
            .eq("user_id", user_id)
            .in_("status", ["todo", "in_progress"])
            .execute()
            .data
        )
        if tasks:
            lines = [
                f"- {t['title']}" + (f" (due {t['due_date']})" if t.get("due_date") else "")
                for t in tasks
            ]
            parts.append("TASKS:\n" + "\n".join(lines))
        else:
            parts.append("TASKS: No open tasks.")

    if "goals" in widgets:
        goals = (
            client.table("goals")
            .select("title,target_date")
            .eq("user_id", user_id)
            .execute()
            .data
        )
        if goals:
            lines = [
                f"- {g['title']}" + (f" (target: {g['target_date']})" if g.get("target_date") else "")
                for g in goals
            ]
            parts.append("GOALS:\n" + "\n".join(lines))
        else:
            parts.append("GOALS: No goals set.")

    if "routine" in widgets:
        parts.append("ROUTINE:\n" + get_routines(user_id))

    if "calendar" in widgets:
        urls = profile.preferences.calendar_urls or []
        parts.append("CALENDAR:\n" + get_upcoming_events(urls))

    if "finance" in widgets:
        parts.append("FINANCE:\n" + get_finance_context(user_id))

    return "\n\n".join(parts) if parts else "No data available for the selected widgets."
