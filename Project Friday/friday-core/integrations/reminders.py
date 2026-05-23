import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from supabase import create_client

_supabase = None


def _client():
    global _supabase
    if _supabase is None:
        _supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _supabase


def _tz() -> ZoneInfo:
    return ZoneInfo(os.environ.get("TIMEZONE", "Asia/Singapore"))


def _fmt(dt_str: str) -> str:
    """Format an ISO timestamp to a human-readable local time string."""
    try:
        dt = datetime.fromisoformat(dt_str).astimezone(_tz())
        return dt.strftime("%a %d %b %Y, %I:%M %p")
    except Exception:
        return dt_str


def get_reminders(user_id: str, include_done: bool = False) -> str:
    """Return upcoming reminders, optionally including completed ones."""
    query = _client().table("reminders").select("id,title,note,remind_at,is_done").eq("user_id", user_id)
    if not include_done:
        query = query.eq("is_done", False)
    rows = query.order("remind_at").execute().data

    if not rows:
        label = "reminders" if include_done else "pending reminders"
        return f"No {label} found."

    lines = [f"{'All' if include_done else 'Upcoming'} reminders ({len(rows)}):"]
    for r in rows:
        status = "✓" if r["is_done"] else "○"
        note = f" — {r['note']}" if r.get("note") else ""
        lines.append(f"{status} [{r['id'][:8]}] {r['title']} · {_fmt(r['remind_at'])}{note}")
    return "\n".join(lines)


def add_reminder(user_id: str, title: str, remind_at: str, note: str = "") -> str:
    """Add a new reminder. remind_at must be an ISO 8601 datetime string."""
    try:
        # Parse and validate the datetime
        dt = datetime.fromisoformat(remind_at)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=_tz())
        remind_at_utc = dt.astimezone(timezone.utc).isoformat()
    except ValueError:
        return f"Invalid date/time '{remind_at}'. Please use ISO format like '2026-05-25T09:00' or '2026-05-25 09:00'."

    _client().table("reminders").insert({
        "user_id": user_id,
        "title": title.strip(),
        "note": note.strip(),
        "remind_at": remind_at_utc,
        "is_done": False,
    }).execute()
    return f"Reminder set: '{title}' at {_fmt(remind_at_utc)}."


def edit_reminder(user_id: str, reminder_id: str, title: str = "",
                  remind_at: str = "", note: str = "") -> str:
    """Edit a reminder by its short ID. Leave fields empty to keep them unchanged."""
    rows = _client().table("reminders").select("id,title").eq("user_id", user_id).execute().data
    match = next((r for r in rows if r["id"].startswith(reminder_id)), None)
    if not match:
        return f"No reminder found with ID '{reminder_id}'. Use get_reminders to see IDs."

    updates: dict = {"updated_at": datetime.utcnow().isoformat()}
    if title:
        updates["title"] = title.strip()
    if note:
        updates["note"] = note.strip()
    if remind_at:
        try:
            dt = datetime.fromisoformat(remind_at)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=_tz())
            updates["remind_at"] = dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            return f"Invalid date/time '{remind_at}'."

    if len(updates) == 1:
        return "Nothing to update — please provide at least one field."

    _client().table("reminders").update(updates).eq("id", match["id"]).execute()
    return f"Updated reminder: '{match['title']}'."


def mark_reminder_done(user_id: str, reminder_id: str, done: bool = True) -> str:
    """Mark a reminder as done or undone by its short ID."""
    rows = _client().table("reminders").select("id,title").eq("user_id", user_id).execute().data
    match = next((r for r in rows if r["id"].startswith(reminder_id)), None)
    if not match:
        return f"No reminder found with ID '{reminder_id}'. Use get_reminders to see IDs."

    _client().table("reminders").update({"is_done": done, "updated_at": datetime.utcnow().isoformat()}).eq("id", match["id"]).execute()
    state = "done" if done else "pending"
    return f"Marked '{match['title']}' as {state}."


def delete_reminder(user_id: str, reminder_id: str) -> str:
    """Delete a reminder by its short ID."""
    rows = _client().table("reminders").select("id,title,remind_at").eq("user_id", user_id).execute().data
    match = next((r for r in rows if r["id"].startswith(reminder_id)), None)
    if not match:
        return f"No reminder found with ID '{reminder_id}'. Use get_reminders to see IDs."

    _client().table("reminders").delete().eq("id", match["id"]).execute()
    return f"Deleted reminder: '{match['title']}' ({_fmt(match['remind_at'])})."
