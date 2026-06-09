"""
Friday — master orchestrator agent for FridayV2.
Receives user input, routes to sub-agents via tool_use, returns a final response.
"""

import anthropic
from datetime import datetime
from zoneinfo import ZoneInfo
from core.config import settings
from agents.notes_agent import run_notes_agent
from agents.productivity_agent import run_productivity_agent
from agents.research_agent import run_research_agent
from agents.finance_agent import run_finance_agent
from agents.fitness_agent import run_fitness_agent
from agents.navigation_agent import run_navigation_agent
from integrations.memory import load_memory

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _system_prompt(memory: str) -> str:
    today = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m-%d")
    return f"""\
You are Friday, a personal AI assistant for Qhairul. You are warm, efficient, and direct — you get things done without unnecessary filler.

Today's date is {today}. Never ask the user for the date — you already know it.

--- What you know about Qhairul ---
{memory}
---

Use this knowledge naturally — let it inform your tone, suggestions, and responses without explicitly referencing it unless relevant. The more you learn, the better you serve him.

When recording an expense, never assume missing information. If the category, amount, or description is not clearly stated, ask the user to confirm before delegating to finance_agent.

You have access to sub-agents that handle specialised tasks:
- **notes_agent**: Save, search, read, edit, or delete notes in Google Drive.
- **productivity_agent**: View, create, find, or delete Google Calendar events. Add, complete, update, or delete Google Tasks. Add, list, edit, delete, and mark done/undone daily routines (recurring habits like "morning workout").
- **research_agent**: Search the web for information on any topic. Use when the user asks to research, look up, find out about, or search for something online.
- **finance_agent**: Manage fixed and variable expenses in Google Sheets. Get financial summaries and analytics.
- **fitness_agent**: Fetch and analyse Garmin fitness metrics. Get health summaries, trends, and coaching advice.
- **navigation_agent**: Get Google Maps directions to any destination. Only the destination name is needed — nothing else. Call this immediately whenever the user mentions navigating or getting directions.

IMPORTANT — navigation rules (never break these):
1. NEVER say you lack GPS, location access, or browser data. You do not need any of that.
2. NEVER ask the user for their location.
3. The generated URL opens in Google Maps on the user's phone, which uses their device GPS automatically.
4. Just call navigation_agent with the destination and return the URL you receive. That is all.

IMPORTANT — your responses ARE the Telegram messages. You do not need any special capability to "send" to Telegram. Whatever text you return is automatically delivered to the user. Always include URLs from sub-agents verbatim in your response so the user receives them as tappable links.

When the user asks you to do something that a sub-agent handles, delegate to it immediately using the tool. After the sub-agent returns a result, summarise it naturally.

For research results specifically: give a more detailed response — highlight the key findings in a few bullet points, then suggest 2-3 related topics the user might want to explore next. Keep it scannable, not a wall of text.

IMPORTANT — saving research to notes: When the user asks to save research findings, pass the COMPLETE research output to notes_agent — the full answer text AND all source URLs. Never save just a summary. The note content should be the full research result exactly as returned by research_agent.

For questions or conversation that don't require a sub-agent, answer directly.

Keep responses concise. Never narrate what you're about to do — just do it and report back.
"""

TOOLS = [
    {
        "name": "notes_agent",
        "description": (
            "Delegate a notes-related task to the Notes Agent. "
            "Use this when the user wants to save, find, read, edit, or delete notes in Google Drive."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "instruction": {
                    "type": "string",
                    "description": "Clear natural-language instruction for the Notes Agent, e.g. 'Save a note titled Meeting Summary with content: ...'",
                }
            },
            "required": ["instruction"],
        },
    },
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
    {
        "name": "research_agent",
        "description": (
            "Search the web for information on any topic. "
            "Use this when the user asks to research, look up, find out about, or search for something online."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Clear search query, e.g. 'latest AI agent frameworks 2026'",
                }
            },
            "required": ["query"],
        },
    },
    {
        "name": "finance_agent",
        "description": (
            "Manage fixed and variable expenses in Google Sheets, and generate financial summaries. "
            "Use this when the user asks about expenses, spending, financial summaries, or wants to add/edit/delete expense records."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "instruction": {
                    "type": "string",
                    "description": "Clear natural-language instruction, e.g. 'Add variable expense: coffee SGD 5 food today'",
                }
            },
            "required": ["instruction"],
        },
    },
    {
        "name": "fitness_agent",
        "description": (
            "Fetch and analyse Garmin fitness metrics, and provide health coaching insights. "
            "Use this when the user asks about steps, sleep, HRV, body battery, stress, VO2 max, "
            "recent workouts, fitness trends, recovery, or general health."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "instruction": {
                    "type": "string",
                    "description": "Clear natural-language instruction, e.g. 'Get today's health summary' or 'How has my sleep been this week?'",
                }
            },
            "required": ["instruction"],
        },
    },
    {
        "name": "navigation_agent",
        "description": (
            "Get Google Maps directions to a destination and return a tappable link. "
            "Use when the user asks to navigate, get directions, or find their way to a place. "
            "No user location needed — Google Maps uses the device's GPS automatically when the link is opened."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "destination": {
                    "type": "string",
                    "description": "Place name or address, e.g. 'Marina Bay Sands' or 'Changi Airport T3'",
                },
                "mode": {
                    "type": "string",
                    "enum": ["driving", "walking", "transit", "bicycling"],
                    "description": "Travel mode. Defaults to driving.",
                },
            },
            "required": ["destination"],
        },
    },
]

_AGENT_FNS = {
    "notes_agent": lambda args: run_notes_agent(args["instruction"]),
    "productivity_agent": lambda args: run_productivity_agent(args["instruction"]),
    "research_agent": lambda args: run_research_agent(args["query"]),
    "finance_agent": lambda args: run_finance_agent(args["instruction"]),
    "fitness_agent": lambda args: run_fitness_agent(args["instruction"]),
    "navigation_agent": lambda args: run_navigation_agent(args["destination"], args.get("mode", "driving")),
}


def run_friday(user_input: str, history: list[dict]) -> tuple[str, list[dict]]:
    """
    Process a user message and return (response_text, updated_history).
    history is a list of {"role": "user"|"assistant", "content": str|list} dicts.
    The caller is responsible for maintaining and passing history each turn.
    """
    memory = load_memory()
    system = [{"type": "text", "text": _system_prompt(memory), "cache_control": {"type": "ephemeral"}}]
    messages = history + [{"role": "user", "content": user_input}]

    response = _client.messages.create(
        model=settings.FRIDAY_MODEL,
        max_tokens=2048,
        system=system,
        tools=TOOLS,
        messages=messages,
    )

    # Execute any tool calls
    while response.stop_reason == "tool_use":
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                fn = _AGENT_FNS.get(block.name)
                result = fn(block.input) if fn else f"Unknown agent: {block.name}"
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        messages = messages + [
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": tool_results},
        ]
        response = _client.messages.create(
            model=settings.FRIDAY_MODEL,
            max_tokens=2048,
            system=system,
            tools=TOOLS,
            messages=messages,
        )

    # Extract final text
    final_text = ""
    for block in response.content:
        if hasattr(block, "text"):
            final_text = block.text
            break

    if not final_text:
        final_text = "Done."

    # Update history with this turn (user + assistant)
    updated_history = history + [
        {"role": "user", "content": user_input},
        {"role": "assistant", "content": final_text},
    ]

    return final_text, updated_history
