from datetime import date

from core.supabase_client import get_supabase


def _today() -> str:
    return date.today().isoformat()


def _reset_stale(routines: list) -> list:
    today = date.today()
    supabase = get_supabase()
    for r in routines:
        if r.get("is_done") and r.get("done_date"):
            if date.fromisoformat(r["done_date"]) < today:
                supabase.table("routines").update(
                    {"is_done": False, "done_date": None}
                ).eq("id", r["id"]).execute()
                r["is_done"] = False
                r["done_date"] = None
    return routines


def _find_routine(query: str) -> list:
    supabase = get_supabase()
    result = supabase.table("routines").select("*").execute()
    return [r for r in result.data if query.lower() in r["name"].lower()]


def list_routines() -> str:
    supabase = get_supabase()
    result = supabase.table("routines").select("*").order("scheduled_time").execute()
    routines = _reset_stale(result.data)

    if not routines:
        return "No routines found."

    lines = [f"Routines ({len(routines)}):"]
    for r in routines:
        status = "✓" if r["is_done"] else "○"
        time_str = f" at {r['scheduled_time'][:5]}" if r.get("scheduled_time") else ""
        days = r.get("days_of_week")
        days_str = f" ({', '.join(days)})" if days else " (every day)"
        lines.append(f"{status} {r['name']}{time_str}{days_str}")
    return "\n".join(lines)


def add_routine(name: str, scheduled_time: str = None, days_of_week: list = None) -> str:
    supabase = get_supabase()
    data = {"name": name}
    if scheduled_time:
        data["scheduled_time"] = scheduled_time
    if days_of_week:
        data["days_of_week"] = days_of_week
    supabase.table("routines").insert(data).execute()
    time_str = f" at {scheduled_time}" if scheduled_time else ""
    days_str = f" ({', '.join(days_of_week)})" if days_of_week else " (every day)"
    return f"Added routine: {name}{time_str}{days_str}"


def edit_routine(
    query: str,
    name: str = None,
    scheduled_time: str = None,
    days_of_week: list = None,
) -> str:
    matches = _find_routine(query)
    if not matches:
        return f"No routine found matching '{query}'."
    if len(matches) > 1:
        names = ", ".join(r["name"] for r in matches[:3])
        return f"Multiple routines match '{query}': {names}. Be more specific."

    routine = matches[0]
    updates = {}
    if name:
        updates["name"] = name
    if scheduled_time is not None:
        updates["scheduled_time"] = scheduled_time
    if days_of_week is not None:
        updates["days_of_week"] = days_of_week

    if not updates:
        return "No changes specified."

    supabase = get_supabase()
    supabase.table("routines").update(updates).eq("id", routine["id"]).execute()
    return f"Updated routine: {routine['name']}"


def delete_routine(query: str) -> str:
    matches = _find_routine(query)
    if not matches:
        return f"No routine found matching '{query}'."
    if len(matches) > 1:
        names = ", ".join(r["name"] for r in matches[:3])
        return f"Multiple routines match '{query}': {names}. Be more specific."

    routine = matches[0]
    supabase = get_supabase()
    supabase.table("routines").delete().eq("id", routine["id"]).execute()
    return f"Deleted routine: {routine['name']}"


def mark_routine_done(query: str) -> str:
    matches = _find_routine(query)
    if not matches:
        return f"No routine found matching '{query}'."
    if len(matches) > 1:
        names = ", ".join(r["name"] for r in matches[:3])
        return f"Multiple routines match '{query}': {names}. Be more specific."

    routine = matches[0]
    supabase = get_supabase()
    supabase.table("routines").update({
        "is_done": True,
        "done_date": _today(),
    }).eq("id", routine["id"]).execute()
    return f"Marked done: {routine['name']}"


def mark_routine_undone(query: str) -> str:
    matches = _find_routine(query)
    if not matches:
        return f"No routine found matching '{query}'."
    if len(matches) > 1:
        names = ", ".join(r["name"] for r in matches[:3])
        return f"Multiple routines match '{query}': {names}. Be more specific."

    routine = matches[0]
    supabase = get_supabase()
    supabase.table("routines").update({
        "is_done": False,
        "done_date": None,
    }).eq("id", routine["id"]).execute()
    return f"Marked undone: {routine['name']}"
