import os
from datetime import datetime
from supabase import create_client

_client = None


def _supabase():
    global _client
    if _client is None:
        _client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _client


def get_goals(user_id: str) -> str:
    rows = (
        _supabase().table("goals")
        .select("id,title,target_date")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
        .data
    )
    if not rows:
        return "No goals found."
    lines = []
    for g in rows:
        line = f"- {g['title']}"
        if g.get("target_date"):
            line += f" (target: {g['target_date']})"
        lines.append(line)
    return "\n".join(lines)


def add_goal(user_id: str, title: str, target_date: str | None = None) -> str:
    _supabase().table("goals").insert({
        "user_id": user_id,
        "title": title.strip(),
        "target_date": target_date or None,
    }).execute()
    return f"Goal added: {title.strip()}"


def update_goal(user_id: str, title: str, new_title: str | None = None, target_date: str | None = None) -> str:
    rows = _supabase().table("goals").select("id,title").eq("user_id", user_id).execute().data
    match = next((r for r in rows if title.lower() in r["title"].lower()), None)
    if not match:
        return f"No goal found matching '{title}'."
    updates: dict = {}
    if new_title:
        updates["title"] = new_title.strip()
    if target_date is not None:
        updates["target_date"] = target_date or None
    if not updates:
        return "Nothing to update."
    _supabase().table("goals").update(updates).eq("id", match["id"]).execute()
    return f"Updated goal: {match['title']}"


def delete_goal(user_id: str, title: str) -> str:
    rows = _supabase().table("goals").select("id,title").eq("user_id", user_id).execute().data
    match = next((r for r in rows if title.lower() in r["title"].lower()), None)
    if not match:
        return f"No goal found matching '{title}'."
    _supabase().table("goals").delete().eq("id", match["id"]).execute()
    return f"Deleted goal: {match['title']}"
