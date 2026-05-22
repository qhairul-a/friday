import os
from datetime import date, datetime
from supabase import create_client

_client = None


def _supabase():
    global _client
    if _client is None:
        _client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _client


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def list_tasks(user_id: str, status: str | None = None) -> str:
    """Return a readable list of tasks. Defaults to active (todo + in_progress)."""
    query = _supabase().table("tasks").select("title,status,priority,due_date,label").eq("user_id", user_id)
    if status:
        query = query.eq("status", status)
    else:
        query = query.in_("status", ["todo", "in_progress"])
    rows = query.order("order_index").execute().data
    if not rows:
        return "No tasks found."
    lines = []
    for r in rows:
        line = f"- [{r['status'].replace('_', ' ')}] {r['title']}"
        if r.get("priority") and r["priority"] != "normal":
            line += f" ({r['priority']} priority)"
        if r.get("due_date"):
            line += f" — due {r['due_date']}"
        if r.get("label"):
            line += f" [#{r['label']}]"
        lines.append(line)
    return "\n".join(lines)


def create_task(user_id: str, title: str, priority: str = "normal",
                due_date: str | None = None, label: str | None = None) -> str:
    """Create a new task in the To Do column."""
    priority = priority.lower() if priority.lower() in {"low", "normal", "high"} else "normal"
    rows = _supabase().table("tasks").select("order_index").eq("user_id", user_id).eq("status", "todo").execute().data
    max_idx = max((r["order_index"] for r in rows), default=-1)
    _supabase().table("tasks").insert({
        "user_id": user_id,
        "title": title.strip(),
        "status": "todo",
        "priority": priority,
        "due_date": due_date or None,
        "label": label or None,
        "notes": "",
        "order_index": max_idx + 1,
    }).execute()
    return f"Created task: {title.strip()}"


def move_task(user_id: str, title: str, status: str) -> str:
    """Move a task to a new status column by partial title match."""
    status = status.lower().replace(" ", "_")
    valid = {"todo", "in_progress", "done", "archived"}
    if status not in valid:
        return f"Invalid status '{status}'. Valid options: {', '.join(sorted(valid))}."
    rows = _supabase().table("tasks").select("id,title,status").eq("user_id", user_id).execute().data
    match = next((r for r in rows if title.lower() in r["title"].lower()), None)
    if not match:
        return f"No task found matching '{title}'."
    _supabase().table("tasks").update({
        "status": status,
        "updated_at": _now_iso(),
    }).eq("id", match["id"]).execute()
    return f"Moved '{match['title']}' to {status.replace('_', ' ')}."


def update_task(user_id: str, title: str, new_title: str | None = None,
                priority: str | None = None, due_date: str | None = None,
                label: str | None = None) -> str:
    """Update fields on an existing task by partial title match."""
    rows = _supabase().table("tasks").select("id,title").eq("user_id", user_id).execute().data
    match = next((r for r in rows if title.lower() in r["title"].lower()), None)
    if not match:
        return f"No task found matching '{title}'."
    updates: dict = {"updated_at": _now_iso()}
    if new_title:
        updates["title"] = new_title.strip()
    if priority and priority.lower() in {"low", "normal", "high"}:
        updates["priority"] = priority.lower()
    if due_date is not None:
        updates["due_date"] = due_date or None
    if label is not None:
        updates["label"] = label or None
    _supabase().table("tasks").update(updates).eq("id", match["id"]).execute()
    return f"Updated task: {match['title']}"


# --- Legacy helpers kept for briefings.py compatibility ---

def add_task(user_id: str, title: str, priority: str = "normal",
             due_date: str | None = None, notes: str = "") -> dict:
    row: dict = {
        "user_id": user_id,
        "title": title,
        "priority": priority,
        "notes": notes,
        "status": "todo",
        "order_index": 0,
    }
    if due_date:
        try:
            date.fromisoformat(due_date)
            row["due_date"] = due_date
        except ValueError:
            pass
    result = _supabase().table("tasks").insert(row).execute()
    return result.data[0] if result.data else {}


def get_open_tasks(user_id: str) -> list[dict]:
    result = (
        _supabase()
        .table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .neq("status", "done")
        .order("due_date", nullsfirst=False)
        .execute()
    )
    return result.data or []


def get_tasks_context(user_id: str) -> str:
    tasks = get_open_tasks(user_id)
    if not tasks:
        return "No open tasks."
    lines = []
    for t in tasks:
        due = f" (due {t['due_date']})" if t.get("due_date") else ""
        label = f" [#{t['label']}]" if t.get("label") else ""
        lines.append(f"[{t['status']}] {t['title']}{due}{label} — priority: {t['priority']}")
    return "\n".join(lines)
