import os
from datetime import datetime, timezone
from supabase import create_client


def _client():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def _days_label(days: list) -> str:
    if not days or len(days) == 7:
        return "every day"
    if sorted(days) == [1, 2, 3, 4, 5]:
        return "weekdays"
    if sorted(days) == [0, 6]:
        return "weekends"
    return ", ".join(DAY_NAMES[d] for d in sorted(days))


def get_routines(user_id: str) -> str:
    """Return all routine items with their done status and schedule."""
    client = _client()
    result = client.table("routine_items").select("*").eq("user_id", user_id)\
        .order("order_index").execute()
    items = result.data or []
    if not items:
        return "No routine items found."

    tz = os.environ.get("TIMEZONE", "Asia/Singapore")
    today_dow = datetime.now(__import__("zoneinfo").ZoneInfo(tz)).weekday()
    # Python weekday: 0=Mon … 6=Sun; JS getDay: 0=Sun … 6=Sat
    # Convert to JS convention used in the DB
    today_js = (today_dow + 1) % 7

    lines = [f"You have {len(items)} routine item(s):"]
    for item in items:
        days = item.get("days") or list(range(7))
        status = "✓ done" if item["is_done"] else "○ pending"
        active_today = today_js in days
        schedule = _days_label(days)
        today_note = " [active today]" if active_today else " [not today]"
        lines.append(f"- {item['title']} — {status}, repeats {schedule}{today_note}")
    return "\n".join(lines)


def _find_item(client, user_id: str, title_query: str):
    """Find a routine item by partial title match (case-insensitive)."""
    result = client.table("routine_items").select("*").eq("user_id", user_id).execute()
    items = result.data or []
    q = title_query.lower()
    matches = [i for i in items if q in i["title"].lower()]
    return matches


def mark_routine_done(user_id: str, title_query: str, done: bool) -> str:
    """Mark a routine item as done or not done by partial title match."""
    client = _client()
    matches = _find_item(client, user_id, title_query)
    if not matches:
        return f"No routine item found matching '{title_query}'."
    if len(matches) > 1:
        names = ", ".join(f"'{m['title']}'" for m in matches)
        return f"Multiple items match '{title_query}': {names}. Please be more specific."
    item = matches[0]
    client.table("routine_items").update({"is_done": done}).eq("id", item["id"]).execute()
    state = "done" if done else "not done"
    return f"Marked '{item['title']}' as {state}."


def add_routine_item(user_id: str, title: str) -> str:
    """Add a new routine item that repeats every day."""
    client = _client()
    result = client.table("routine_items").select("order_index").eq("user_id", user_id).execute()
    order_index = len(result.data or [])
    client.table("routine_items").insert({
        "user_id": user_id,
        "title": title,
        "is_done": False,
        "order_index": order_index,
        "days": list(range(7)),
    }).execute()
    return f"Added '{title}' to your routine."


def update_routine_schedule(user_id: str, title_query: str, day_names: list[str]) -> str:
    """Change which days a routine item repeats on."""
    client = _client()
    matches = _find_item(client, user_id, title_query)
    if not matches:
        return f"No routine item found matching '{title_query}'."
    if len(matches) > 1:
        names = ", ".join(f"'{m['title']}'" for m in matches)
        return f"Multiple items match '{title_query}': {names}. Please be more specific."

    day_map = {name.lower(): i for i, name in enumerate(DAY_NAMES)}
    # also accept short forms: mon, tue, wed, thu, fri, sat, sun
    short_map = {name[:3].lower(): i for i, name in enumerate(DAY_NAMES)}
    day_map.update(short_map)

    days = []
    unknown = []
    for name in day_names:
        idx = day_map.get(name.lower().strip())
        if idx is None:
            unknown.append(name)
        elif idx not in days:
            days.append(idx)

    if unknown:
        return f"Unrecognised day(s): {', '.join(unknown)}. Use full names like Monday, Tuesday, etc."
    if not days:
        return "Please specify at least one day."

    days.sort()
    item = matches[0]
    client.table("routine_items").update({"days": days}).eq("id", item["id"]).execute()
    return f"Updated '{item['title']}' to repeat on {_days_label(days)}."


def delete_routine_item(user_id: str, title_query: str) -> str:
    """Delete a routine item by partial title match."""
    client = _client()
    matches = _find_item(client, user_id, title_query)
    if not matches:
        return f"No routine item found matching '{title_query}'."
    if len(matches) > 1:
        names = ", ".join(f"'{m['title']}'" for m in matches)
        return f"Multiple items match '{title_query}': {names}. Please be more specific."
    item = matches[0]
    client.table("routine_items").delete().eq("id", item["id"]).execute()
    return f"Deleted '{item['title']}' from your routine."
