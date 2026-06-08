# FridayV2 Phase 2 — Productivity Agent Design

**Date:** 2026-06-03
**Status:** Approved

---

## Context

Phase 1 delivered the Friday Master Agent + Notes Agent + Telegram + LiveKit voice. Phase 2 adds the Productivity Agent, giving Friday full control over Google Calendar and Google Tasks under `qhairul.asmai@gmail.com`.

---

## Architecture

The Productivity Agent follows the identical pattern established by the Notes Agent in Phase 1: a Python function (`run_productivity_agent`) is registered as a tool in Friday's tool list. Friday routes any calendar or task request to it via `tool_use`. The Productivity Agent makes its own Claude (Haiku) call with Google Calendar and Google Tasks tools, executes the chosen tool, and returns a plain-text result to Friday.

```
User → Friday (Haiku)
           ├── tool: notes_agent          (Phase 1, unchanged)
           └── tool: productivity_agent   (Phase 2)
                        ├── Google Calendar API tools
                        └── Google Tasks API tools
```

---

## Components

### New files

**`integrations/gcal.py`**
Raw Google Calendar API wrapper. Uses the same OAuth token (`secrets/gdrive_token.json`) with an added Calendar scope. Functions:
- `get_upcoming_events(days=7) -> str` — list events in the next N days
- `create_event(title, start_datetime, end_datetime, description=None) -> str` — create a calendar event
- `find_events(query) -> str` — search events by keyword or date phrase
- `delete_event(query) -> str` — delete an event by partial title/keyword match

**`integrations/gtasks.py`**
Raw Google Tasks API wrapper. Same OAuth token, added Tasks scope. Functions:
- `list_tasks(show_completed=False) -> str` — list tasks from default task list
- `create_task(title, due=None, notes=None) -> str` — add a new task
- `complete_task(query) -> str` — mark a task done by partial title match
- `update_task(query, title=None, due=None, notes=None) -> str` — edit a task
- `delete_task(query) -> str` — delete a task by partial title match

**`agents/productivity_agent.py`**
Wraps all Calendar and Tasks functions as Claude tool definitions. Exposes `run_productivity_agent(instruction: str) -> str`. Model: `claude-haiku-4-5-20251001` with ephemeral system prompt caching.

### Updated files

**`agents/friday.py`**
Add `productivity_agent` tool definition alongside `notes_agent`. Friday's system prompt updated to mention Calendar and Tasks capabilities.

**`scripts/authorize_google.py`**
Add two scopes to the existing list:
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/tasks`

The existing `secrets/gdrive_token.json` must be deleted and the script re-run so the new scopes are included in the token.

---

## Google OAuth

All credentials remain under `qhairul.asmai@gmail.com`. The single token file covers Drive + Calendar + Tasks after re-authorisation.

Updated scope list:
```python
SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
]
```

---

## Data Flow Example

> User (Telegram): "Schedule a dentist appointment on Friday at 3pm"

1. Friday (Haiku) receives the message
2. Friday calls `productivity_agent` with instruction: `"Create a calendar event titled 'Dentist Appointment' on Friday at 3pm"`
3. Productivity Agent (Haiku) calls `create_event` tool
4. `gcal.py` creates the event via Google Calendar API
5. Productivity Agent returns: `"Created event: Dentist Appointment on 2026-06-06 at 15:00"`
6. Friday replies to Telegram: `"Done — dentist appointment booked for Friday at 3pm."`

---

## Implementation Steps

1. Update `scripts/authorize_google.py` — add Calendar + Tasks scopes
2. Delete `secrets/gdrive_token.json` and re-run auth script
3. Write `integrations/gcal.py`
4. Write `integrations/gtasks.py`
5. Write `agents/productivity_agent.py`
6. Update `agents/friday.py` — add productivity_agent tool + update system prompt
7. Test: send calendar and task commands via Telegram

---

## Verification

1. Send `"what's on my calendar this week"` → Friday lists events
2. Send `"add a task: buy groceries"` → task appears in Google Tasks
3. Send `"schedule a call with Ahmad on Monday at 2pm"` → event created in Google Calendar
4. Send `"mark buy groceries as done"` → task marked complete
5. Send `"save a note about my meeting"` → Notes Agent still works (no regression)
