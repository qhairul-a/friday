import anthropic

from core.config import settings
from integrations.gcal import get_upcoming_events, create_event, find_events, delete_event
from integrations.gtasks import list_tasks, create_task, complete_task, update_task, delete_task
from integrations.routines import (
    list_routines,
    add_routine,
    edit_routine,
    delete_routine,
    mark_routine_done,
    mark_routine_undone,
)

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
    {
        "name": "list_routines",
        "description": "List all daily routines with today's completion status.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "add_routine",
        "description": "Add a new daily routine.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Routine name, e.g. 'Morning workout'."},
                "scheduled_time": {"type": "string", "description": "Optional time in HH:MM format, e.g. '07:00'."},
                "days_of_week": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional days, e.g. ['mon','tue','wed','thu','fri']. Omit for every day.",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "edit_routine",
        "description": "Edit an existing routine by partial name match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial routine name to find."},
                "name": {"type": "string", "description": "New name (optional)."},
                "scheduled_time": {"type": "string", "description": "New time in HH:MM (optional)."},
                "days_of_week": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "New days list (optional).",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "delete_routine",
        "description": "Delete a routine by partial name match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial routine name to match."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "mark_routine_done",
        "description": "Mark a routine as completed for today.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial routine name to match."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "mark_routine_undone",
        "description": "Unmark a routine as completed for today.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial routine name to match."},
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
    "list_routines": lambda a: list_routines(),
    "add_routine": lambda a: add_routine(a["name"], a.get("scheduled_time"), a.get("days_of_week")),
    "edit_routine": lambda a: edit_routine(a["query"], a.get("name"), a.get("scheduled_time"), a.get("days_of_week")),
    "delete_routine": lambda a: delete_routine(a["query"]),
    "mark_routine_done": lambda a: mark_routine_done(a["query"]),
    "mark_routine_undone": lambda a: mark_routine_undone(a["query"]),
}

SYSTEM_PROMPT = (
    "You are the Productivity Agent for Friday. You manage Google Calendar, Google Tasks, and daily Routines. "
    "Use the available tools to fulfil the instruction. "
    "IMPORTANT: When the user mentions 'routine', 'habit', or a recurring daily activity, use the routine tools "
    "(add_routine, list_routines, edit_routine, delete_routine, mark_routine_done, mark_routine_undone) — "
    "NOT calendar or task tools. Routines are stored separately in a database, not in Google Calendar. "
    "When creating calendar events, infer the timezone as Asia/Singapore (+08:00) and format datetimes as ISO 8601. "
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
