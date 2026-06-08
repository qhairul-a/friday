# Productivity Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Productivity Agent to FridayV2 that gives Friday full control over Google Calendar and Google Tasks.

**Architecture:** A new `productivity_agent` tool is registered in Friday's tool list alongside `notes_agent`. When the user asks about calendar or tasks, Friday routes to it via `tool_use`. The Productivity Agent (Haiku + Claude tool_use) executes the requested Google API call and returns plain text to Friday.

**Tech Stack:** Python, Google Calendar API v3, Google Tasks API v1, `google-api-python-client`, Anthropic SDK (Haiku), existing OAuth token in `secrets/gdrive_token.json`.

---

## File Map

| Action | File |
|---|---|
| Modify | `backend/scripts/authorize_google.py` — add Calendar + Tasks scopes |
| Create | `backend/integrations/gcal.py` — Google Calendar API wrapper |
| Create | `backend/integrations/gtasks.py` — Google Tasks API wrapper |
| Create | `backend/agents/productivity_agent.py` — Claude tool_use agent wrapping both |
| Modify | `backend/agents/friday.py` — add productivity_agent tool + update system prompt |

---

## Task 1: Expand OAuth Scopes

**Files:**
- Modify: `backend/scripts/authorize_google.py`

- [ ] **Step 1: Update the SCOPES list**

Open `backend/scripts/authorize_google.py` and replace the SCOPES list with:

```python
SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
]
```

- [ ] **Step 2: Delete the old token**

In Command Prompt (from `backend/`):
```
del secrets\gdrive_token.json
```

- [ ] **Step 3: Re-run the auth script**

```
python scripts/authorize_google.py
```

Browser opens → sign in as `qhairul.asmai@gmail.com` → grant access to Drive, Calendar, and Tasks → confirm success message in terminal.

---

## Task 2: Google Calendar Integration

**Files:**
- Create: `backend/integrations/gcal.py`

- [ ] **Step 1: Create `backend/integrations/gcal.py`**

```python
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

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
    return build("calendar", "v3", credentials=creds)


def get_upcoming_events(days: int = 7) -> str:
    service = _get_service()
    tz = ZoneInfo(settings.TIMEZONE)
    now = datetime.now(tz)
    end = now + timedelta(days=days)

    result = service.events().list(
        calendarId="primary",
        timeMin=now.isoformat(),
        timeMax=end.isoformat(),
        maxResults=20,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = result.get("items", [])
    if not events:
        return f"No events in the next {days} days."

    lines = [f"Upcoming events (next {days} days):"]
    for event in events:
        start = event["start"].get("dateTime", event["start"].get("date", ""))
        title = event.get("summary", "Untitled")
        try:
            dt = datetime.fromisoformat(start).astimezone(tz)
            display = dt.strftime("%a %d %b, %H:%M")
        except Exception:
            display = start
        lines.append(f"— {display}: {title}")
    return "\n".join(lines)


def create_event(title: str, start_datetime: str, end_datetime: str, description: str = None) -> str:
    """start_datetime and end_datetime are ISO 8601 strings with timezone offset, e.g. '2026-06-05T15:00:00+08:00'."""
    service = _get_service()
    body = {
        "summary": title,
        "start": {"dateTime": start_datetime, "timeZone": settings.TIMEZONE},
        "end": {"dateTime": end_datetime, "timeZone": settings.TIMEZONE},
    }
    if description:
        body["description"] = description
    event = service.events().insert(calendarId="primary", body=body).execute()
    return f"Created event: {title}"


def find_events(query: str) -> str:
    service = _get_service()
    tz = ZoneInfo(settings.TIMEZONE)
    now = datetime.now(tz)
    end = now + timedelta(days=60)

    result = service.events().list(
        calendarId="primary",
        timeMin=now.isoformat(),
        timeMax=end.isoformat(),
        q=query,
        maxResults=10,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = result.get("items", [])
    if not events:
        return f"No events found matching '{query}'."

    lines = [f"Found {len(events)} event(s) matching '{query}':"]
    for event in events:
        start = event["start"].get("dateTime", event["start"].get("date", ""))
        try:
            dt = datetime.fromisoformat(start).astimezone(tz)
            display = dt.strftime("%a %d %b, %H:%M")
        except Exception:
            display = start
        lines.append(f"— {display}: {event.get('summary', 'Untitled')}")
    return "\n".join(lines)


def delete_event(query: str) -> str:
    service = _get_service()
    tz = ZoneInfo(settings.TIMEZONE)
    now = datetime.now(tz)
    end = now + timedelta(days=60)

    result = service.events().list(
        calendarId="primary",
        timeMin=now.isoformat(),
        timeMax=end.isoformat(),
        q=query,
        maxResults=5,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = result.get("items", [])
    if not events:
        return f"No upcoming events found matching '{query}'."
    if len(events) > 1:
        titles = ", ".join(e.get("summary", "Untitled") for e in events[:3])
        return f"Multiple events match '{query}': {titles}. Be more specific."

    event = events[0]
    title = event.get("summary", "Untitled")
    service.events().delete(calendarId="primary", eventId=event["id"]).execute()
    return f"Deleted event: {title}"
```

- [ ] **Step 2: Verify the module imports cleanly**

```
python -c "from integrations.gcal import get_upcoming_events; print('gcal OK')"
```
Expected output: `gcal OK`

---

## Task 3: Google Tasks Integration

**Files:**
- Create: `backend/integrations/gtasks.py`

- [ ] **Step 1: Create `backend/integrations/gtasks.py`**

```python
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
```

- [ ] **Step 2: Verify the module imports cleanly**

```
python -c "from integrations.gtasks import list_tasks; print('gtasks OK')"
```
Expected output: `gtasks OK`

---

## Task 4: Productivity Agent

**Files:**
- Create: `backend/agents/productivity_agent.py`

- [ ] **Step 1: Create `backend/agents/productivity_agent.py`**

```python
import anthropic

from core.config import settings
from integrations.gcal import get_upcoming_events, create_event, find_events, delete_event
from integrations.gtasks import list_tasks, create_task, complete_task, update_task, delete_task

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

TOOLS = [
    {
        "name": "get_upcoming_events",
        "description": "List upcoming Google Calendar events.",
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {"type": "integer", "description": "Number of days to look ahead (default 7).", "default": 7},
            },
        },
    },
    {
        "name": "create_event",
        "description": "Create a new Google Calendar event.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Event title."},
                "start_datetime": {"type": "string", "description": "ISO 8601 start time with timezone offset e.g. '2026-06-05T15:00:00+08:00'."},
                "end_datetime": {"type": "string", "description": "ISO 8601 end time. Default 1 hour after start if unspecified."},
                "description": {"type": "string", "description": "Optional notes or description."},
            },
            "required": ["title", "start_datetime", "end_datetime"],
        },
    },
    {
        "name": "find_events",
        "description": "Search calendar events by keyword.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "delete_event",
        "description": "Delete a calendar event by keyword match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Keyword to find the event to delete."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "list_tasks",
        "description": "List Google Tasks.",
        "input_schema": {
            "type": "object",
            "properties": {
                "show_completed": {"type": "boolean", "description": "Include completed tasks (default false).", "default": False},
            },
        },
    },
    {
        "name": "create_task",
        "description": "Create a new Google Task.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Task title."},
                "due": {"type": "string", "description": "Due date as RFC 3339 string e.g. '2026-06-10T00:00:00.000Z' (optional)."},
                "notes": {"type": "string", "description": "Optional task notes."},
            },
            "required": ["title"],
        },
    },
    {
        "name": "complete_task",
        "description": "Mark a task as done by partial title match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial task title."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "update_task",
        "description": "Edit a task's title, due date, or notes.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial task title to find."},
                "title": {"type": "string", "description": "New title (optional)."},
                "due": {"type": "string", "description": "New due date RFC 3339 (optional)."},
                "notes": {"type": "string", "description": "New notes (optional)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "delete_task",
        "description": "Delete a task by partial title match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial task title."},
            },
            "required": ["query"],
        },
    },
]

_TOOL_FNS = {
    "get_upcoming_events": lambda a: get_upcoming_events(a.get("days", 7)),
    "create_event": lambda a: create_event(a["title"], a["start_datetime"], a["end_datetime"], a.get("description")),
    "find_events": lambda a: find_events(a["query"]),
    "delete_event": lambda a: delete_event(a["query"]),
    "list_tasks": lambda a: list_tasks(a.get("show_completed", False)),
    "create_task": lambda a: create_task(a["title"], a.get("due"), a.get("notes")),
    "complete_task": lambda a: complete_task(a["query"]),
    "update_task": lambda a: update_task(a["query"], a.get("title"), a.get("due"), a.get("notes")),
    "delete_task": lambda a: delete_task(a["query"]),
}

SYSTEM_PROMPT = (
    "You are the Productivity Agent for Friday. Your job is to manage Google Calendar and Google Tasks. "
    "Use the available tools to fulfil the instruction. "
    "When creating events, infer the timezone as Asia/Singapore (+08:00) and format datetimes as ISO 8601. "
    "Return a concise plain-text result describing what was done."
)


def run_productivity_agent(instruction: str) -> str:
    messages = [{"role": "user", "content": instruction}]

    response = _client.messages.create(
        model=settings.NOTES_AGENT_MODEL,
        max_tokens=1024,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=TOOLS,
        messages=messages,
    )

    while response.stop_reason == "tool_use":
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                fn = _TOOL_FNS.get(block.name)
                result = fn(block.input) if fn else f"Unknown tool: {block.name}"
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })
        messages = [
            {"role": "user", "content": instruction},
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": tool_results},
        ]
        response = _client.messages.create(
            model=settings.NOTES_AGENT_MODEL,
            max_tokens=1024,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            tools=TOOLS,
            messages=messages,
        )

    for block in response.content:
        if hasattr(block, "text"):
            return block.text
    return "Productivity agent completed the task."
```

- [ ] **Step 2: Verify the module imports cleanly**

```
python -c "from agents.productivity_agent import run_productivity_agent; print('productivity_agent OK')"
```
Expected output: `productivity_agent OK`

---

## Task 5: Update Friday Master Agent

**Files:**
- Modify: `backend/agents/friday.py`

- [ ] **Step 1: Add the import at the top of `friday.py`**

Add this line after the existing `from agents.notes_agent import run_notes_agent` line:

```python
from agents.productivity_agent import run_productivity_agent
```

- [ ] **Step 2: Update the SYSTEM_PROMPT**

Replace the existing `SYSTEM_PROMPT` string with:

```python
SYSTEM_PROMPT = """\
You are Friday, a personal AI assistant for Qhairul. You are warm, efficient, and direct — you get things done without unnecessary filler.

You have access to sub-agents that handle specialised tasks:
- **notes_agent**: Save, search, read, edit, or delete notes in Google Drive.
- **productivity_agent**: View, create, find, or delete Google Calendar events. Add, complete, update, or delete Google Tasks.

When the user asks you to do something that a sub-agent handles, delegate to it immediately using the tool. After the sub-agent returns a result, summarise it naturally in 1-2 sentences.

For questions or conversation that don't require a sub-agent, answer directly.

Keep responses concise. Never narrate what you're about to do — just do it and report back.
"""
```

- [ ] **Step 3: Add the productivity_agent tool to the TOOLS list**

Add this entry to the `TOOLS` list in `friday.py` (after the notes_agent entry):

```python
{
    "name": "productivity_agent",
    "description": (
        "Delegate a calendar or task request to the Productivity Agent. "
        "Use this when the user wants to view, create, find, or delete Google Calendar events, "
        "or add, complete, update, or delete Google Tasks."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "instruction": {
                "type": "string",
                "description": "Clear natural-language instruction, e.g. 'Create a calendar event titled Dentist on Friday at 3pm'",
            }
        },
        "required": ["instruction"],
    },
},
```

- [ ] **Step 4: Add the agent function to `_AGENT_FNS`**

Add this entry to the `_AGENT_FNS` dict:

```python
"productivity_agent": lambda args: run_productivity_agent(args["instruction"]),
```

- [ ] **Step 5: Verify the module imports cleanly**

```
python -c "from agents.friday import run_friday; print('friday OK')"
```
Expected output: `friday OK`

---

## Task 6: End-to-End Verification

- [ ] **Step 1: Start Friday**

```
python main.py
```

Expected: `Friday is online. Listening on Telegram...`

- [ ] **Step 2: Test calendar — view events**

Send in Telegram: `what's on my calendar this week`

Expected: Friday lists your upcoming events (or says none if calendar is empty).

- [ ] **Step 3: Test calendar — create event**

Send in Telegram: `schedule a dentist appointment on Monday at 10am`

Expected: Friday confirms the event was created. Verify it appears in Google Calendar.

- [ ] **Step 4: Test tasks — create task**

Send in Telegram: `add a task: buy groceries`

Expected: Friday confirms task created. Verify it appears in Google Tasks.

- [ ] **Step 5: Test tasks — complete task**

Send in Telegram: `mark buy groceries as done`

Expected: Friday confirms task marked done.

- [ ] **Step 6: Test Notes Agent regression**

Send in Telegram: `save a note: phase 2 is working`

Expected: Friday saves the note (Notes Agent still works, no regression).
