import anthropic

from core.config import settings
from integrations.fitness import (
    sync_today,
    get_daily_summary,
    get_weekly_trends,
    get_recent_activities,
)

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

TOOLS = [
    {
        "name": "sync_fitness_data",
        "description": "Pull today's fitness metrics from Garmin Connect and store in the database. Use before querying today's data if you want to force a fresh sync.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_today_summary",
        "description": "Get today's health snapshot: steps, sleep, HRV, body battery, stress, resting HR, VO2 max. Automatically syncs fresh data from Garmin before returning.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_weekly_trends",
        "description": "Get fitness trends averaged over the last N days. Reads from stored history — no live Garmin sync needed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "n_days": {
                    "type": "integer",
                    "description": "Number of days to look back. Default 7.",
                }
            },
        },
    },
    {
        "name": "get_recent_activities",
        "description": "Get the most recent workouts/activities from Garmin (runs, rides, etc.) with duration, distance, avg HR, and calories.",
        "input_schema": {
            "type": "object",
            "properties": {
                "n": {
                    "type": "integer",
                    "description": "Number of activities to return. Default 5.",
                }
            },
        },
    },
]

_TOOL_FNS = {
    "sync_fitness_data": lambda a: sync_today(),
    "get_today_summary": lambda a: get_daily_summary(),
    "get_weekly_trends": lambda a: get_weekly_trends(a.get("n_days", 7)),
    "get_recent_activities": lambda a: get_recent_activities(a.get("n", 5)),
}


def _system_prompt() -> str:
    from datetime import datetime
    from zoneinfo import ZoneInfo
    today = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m-%d")
    return (
        f"You are the Fitness Agent for Friday. You fetch and analyse Garmin health metrics "
        f"and give actionable coaching advice based on the data. "
        f"Today's date is {today}. Always use YYYY-MM-DD for dates. "
        f"After presenting raw metric data, always add a short coaching section: "
        f"comment on sleep quality, recovery state (Body Battery + HRV), training load from recent activities, "
        f"and whether a rest day or easy day is warranted. "
        f"Reference Garmin terminology naturally: Body Battery, HRV status (Balanced/Good/Fair/Poor), "
        f"Training Readiness, VO2 max. "
        f"Keep your response concise and practical — numbers + one clear takeaway per metric. "
        f"Return plain text."
    )


def run_fitness_agent(instruction: str) -> str:
    messages = [{"role": "user", "content": instruction}]

    response = _client.messages.create(
        model=settings.NOTES_AGENT_MODEL,
        max_tokens=2048,
        system=[{"type": "text", "text": _system_prompt(), "cache_control": {"type": "ephemeral"}}],
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
            max_tokens=2048,
            system=[{"type": "text", "text": _system_prompt(), "cache_control": {"type": "ephemeral"}}],
            tools=TOOLS,
            messages=messages,
        )

    for block in response.content:
        if hasattr(block, "text"):
            return block.text
    return "Fitness agent completed the task."
