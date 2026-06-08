from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
]


def _get_service():
    if not settings.GDRIVE_TOKEN_FILE.exists():
        raise RuntimeError("Google not authorized. Run: python scripts/authorize_google.py")
    creds = Credentials.from_authorized_user_file(str(settings.GDRIVE_TOKEN_FILE), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(settings.GDRIVE_TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return build("tasks", "v1", credentials=creds)


def _find_task(service, query: str) -> list:
    result = service.tasks().list(
        tasklist="@default", showCompleted=False, maxResults=100
    ).execute()
    return [t for t in result.get("items", []) if query.lower() in t.get("title", "").lower()]


def list_tasks(show_completed: bool = False) -> str:
    service = _get_service()
    result = service.tasks().list(
        tasklist="@default", showCompleted=show_completed, maxResults=50
    ).execute()
    tasks = result.get("items", [])
    if not tasks:
        return "No tasks found."

    lines = [f"Tasks ({len(tasks)}):"]
    for task in tasks:
        status = "✓" if task.get("status") == "completed" else "○"
        due = f" — due {task['due'][:10]}" if task.get("due") else ""
        lines.append(f"{status} {task.get('title', 'Untitled')}{due}")
    return "\n".join(lines)


def create_task(title: str, due: str = None, notes: str = None) -> str:
    """due is RFC 3339 string e.g. '2026-06-10T00:00:00.000Z'"""
    service = _get_service()
    body = {"title": title, "status": "needsAction"}
    if due:
        body["due"] = due
    if notes:
        body["notes"] = notes
    service.tasks().insert(tasklist="@default", body=body).execute()
    return f"Created task: {title}"


def complete_task(query: str) -> str:
    service = _get_service()
    matches = _find_task(service, query)
    if not matches:
        return f"No task found matching '{query}'."
    if len(matches) > 1:
        titles = ", ".join(t.get("title", "Untitled") for t in matches[:3])
        return f"Multiple tasks match '{query}': {titles}. Be more specific."
    task = matches[0]
    service.tasks().update(
        tasklist="@default", task=task["id"], body={**task, "status": "completed"}
    ).execute()
    return f"Marked done: {task.get('title', 'Untitled')}"


def update_task(query: str, title: str = None, due: str = None, notes: str = None) -> str:
    service = _get_service()
    matches = _find_task(service, query)
    if not matches:
        return f"No task found matching '{query}'."
    if len(matches) > 1:
        titles = ", ".join(t.get("title", "Untitled") for t in matches[:3])
        return f"Multiple tasks match '{query}': {titles}. Be more specific."
    task = matches[0]
    if title:
        task["title"] = title
    if due:
        task["due"] = due
    if notes:
        task["notes"] = notes
    service.tasks().update(tasklist="@default", task=task["id"], body=task).execute()
    return f"Updated task: {task.get('title', 'Untitled')}"


def delete_task(query: str) -> str:
    service = _get_service()
    matches = _find_task(service, query)
    if not matches:
        return f"No task found matching '{query}'."
    if len(matches) > 1:
        titles = ", ".join(t.get("title", "Untitled") for t in matches[:3])
        return f"Multiple tasks match '{query}': {titles}. Be more specific."
    task = matches[0]
    service.tasks().delete(tasklist="@default", task=task["id"]).execute()
    return f"Deleted task: {task.get('title', 'Untitled')}"
