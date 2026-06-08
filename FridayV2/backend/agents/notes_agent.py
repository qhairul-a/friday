"""
Notes sub-agent for FridayV2.
Wraps Google Drive note operations as Claude tools.
Called by the Friday master agent via tool_use.
"""

import json
import anthropic

from core.config import settings
from integrations.gdrive_notes import (
    save_note,
    list_notes,
    search_notes,
    read_note,
    edit_note,
    delete_note,
    search_vault,
)

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

TOOLS = [
    {
        "name": "save_note",
        "description": "Save a new note to Google Drive (Q_obsidian/Friday/). Use when the user wants to capture, record, or write down information.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Short descriptive title for the note."},
                "content": {"type": "string", "description": "Full note content in markdown."},
            },
            "required": ["title", "content"],
        },
    },
    {
        "name": "list_notes",
        "description": "List the most recent notes saved by Friday.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Maximum number of notes to return (default 10).", "default": 10},
            },
        },
    },
    {
        "name": "search_notes",
        "description": "Search notes saved by Friday using keywords.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keywords."},
                "max_results": {"type": "integer", "description": "Max results to return (default 5).", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "read_note",
        "description": "Read the full content of a specific note by title.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title_query": {"type": "string", "description": "Partial note title to match."},
            },
            "required": ["title_query"],
        },
    },
    {
        "name": "edit_note",
        "description": "Replace the content of an existing note.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title_query": {"type": "string", "description": "Partial title of the note to edit."},
                "new_content": {"type": "string", "description": "New content to replace the note body."},
            },
            "required": ["title_query", "new_content"],
        },
    },
    {
        "name": "delete_note",
        "description": "Delete a note by title.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title_query": {"type": "string", "description": "Partial title of the note to delete."},
            },
            "required": ["title_query"],
        },
    },
    {
        "name": "search_vault",
        "description": "Search the entire Obsidian vault (all folders, not just Friday notes) for a keyword.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keywords."},
                "max_results": {"type": "integer", "description": "Max results (default 5).", "default": 5},
            },
            "required": ["query"],
        },
    },
]

_TOOL_FNS = {
    "save_note": lambda args: save_note(args["title"], args["content"]),
    "list_notes": lambda args: list_notes(args.get("limit", 10)),
    "search_notes": lambda args: search_notes(args["query"], args.get("max_results", 5)),
    "read_note": lambda args: read_note(args["title_query"]),
    "edit_note": lambda args: edit_note(args["title_query"], args["new_content"]),
    "delete_note": lambda args: delete_note(args["title_query"]),
    "search_vault": lambda args: search_vault(args["query"], args.get("max_results", 5)),
}

SYSTEM_PROMPT = (
    "You are the Notes Agent for Friday. Your only job is to manage notes in Google Drive. "
    "Use the available tools to fulfil the instruction. Be precise and efficient. "
    "Return a concise plain-text result describing what was done or found."
)


def run_notes_agent(instruction: str) -> str:
    """
    Execute a natural-language notes instruction using Claude tool_use.
    Returns a plain-text result suitable for Friday to relay to the user.
    """
    messages = [{"role": "user", "content": instruction}]

    response = _client.messages.create(
        model=settings.NOTES_AGENT_MODEL,
        max_tokens=1024,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=TOOLS,
        messages=messages,
    )

    # Execute tool calls until the model stops
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

    # Extract final text
    for block in response.content:
        if hasattr(block, "text"):
            return block.text

    return "Notes agent completed the task."
