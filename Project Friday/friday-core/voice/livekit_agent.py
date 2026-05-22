import asyncio
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

# Ensure friday-core/ is on sys.path so local packages resolve correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

import httpx
import anthropic as anthropic_sdk

from livekit import agents
from livekit.agents import AgentSession, Agent, function_tool
from livekit.plugins import deepgram, google, anthropic
from google.cloud import texttospeech

from profile.storage import load_profile
from profile.schema import FridayProfile
from integrations import gdrive_notes
from integrations.expenses import append_expense, get_finance_context
from integrations.calendar import get_upcoming_events, create_event, find_events, delete_event
from integrations.routines import get_routines, mark_routine_done, add_routine_item, delete_routine_item, update_routine_schedule
from integrations.briefings import get_pending_briefing, mark_delivered, build_briefing_content
from integrations.tasks import list_tasks, create_task, move_task, update_task
from integrations.goals import get_goals, add_goal, update_goal, delete_goal


def _build_voice_instructions(profile: FridayProfile) -> str:
    raw = profile.identity.preferred_name or ""
    name = raw.split(";")[0].strip() or profile.identity.name or "there"
    tz = ZoneInfo(os.environ.get("TIMEZONE", "Asia/Singapore"))
    now = datetime.now(tz)
    today = now.strftime("%A, %d %B %Y, %I:%M %p")
    profile_json = profile.to_json()
    return f"""You are Friday, a personal AI assistant for {name}.

Today is {today}.

Behaviour rules:
- Be proactive, concise, and warm.
- You are speaking aloud — respond in natural spoken sentences. No markdown, no bullet points.
- Keep responses short: 1–3 sentences for most replies.
- When you log something, confirm briefly in one sentence.
- Be proactive: mention anything worth flagging after the main response.

Finance rules:
- ALL expense and spending data is stored internally — you always have full access to it via your tools.
- For ANY question about spending, expenses, or financial analysis, call get_spending_summary. Never say you cannot access this data.
- get_spending_summary accepts an optional month (YYYY-MM). Use it for historical queries, e.g. '2026-04' for April 2026.
- To record a new expense, call log_expense.
- Google Sheets is no longer used for expenses. Do not mention it.

Here is everything you know about {name}:
{profile_json}"""


class FridayVoiceAgent(Agent):
    def __init__(self, profile: FridayProfile, pending_briefing: dict | None = None):
        self._profile = profile
        self._pending_briefing = pending_briefing
        super().__init__(instructions=_build_voice_instructions(profile))

    @function_tool
    async def deliver_briefing(self) -> str:
        """Deliver the scheduled briefing when user confirms. Read naturally, end with encouragement."""
        if not self._pending_briefing:
            return "No briefing is currently scheduled for this time."
        content = await asyncio.to_thread(
            build_briefing_content,
            self._pending_briefing,
            os.environ.get("FRIDAY_USER_ID", "default"),
            self._profile,
        )
        await asyncio.to_thread(mark_delivered, self._pending_briefing["id"])
        return content + "\n\n[After delivering the briefing above, close with a short warm message encouraging the user to have a productive and great day.]"

    @function_tool
    async def search_notes(self, query: str) -> str:
        """Search notes for the given keywords."""
        return await asyncio.to_thread(gdrive_notes.search_notes, query)

    @function_tool
    async def create_note(self, title: str, content: str) -> str:
        """Save a new note with the given title and content."""
        await asyncio.to_thread(gdrive_notes.write_note, title, content)
        return f"Note saved: {title}"

    @function_tool
    async def get_spending_summary(self, month: str = "") -> str:
        """Get spending breakdown. month is YYYY-MM, empty for current month."""
        return await asyncio.to_thread(
            get_finance_context,
            os.environ.get("FRIDAY_USER_ID", "default"),
            month or None,
        )

    @function_tool
    async def log_expense(self, amount: float, category: str, description: str, expense_date: str = "") -> str:
        """Log an expense. expense_date is YYYY-MM-DD, empty for today."""
        return await asyncio.to_thread(
            append_expense,
            os.environ.get("FRIDAY_USER_ID", "default"),
            amount, category, description, expense_date or None,
        )

    @function_tool
    async def get_routine_items(self) -> str:
        """Get the routine list with done status and schedule."""
        return await asyncio.to_thread(get_routines, os.environ.get("FRIDAY_USER_ID", "default"))

    @function_tool
    async def mark_routine(self, title: str, done: bool) -> str:
        """Mark a routine item done or undone by partial title match."""
        return await asyncio.to_thread(mark_routine_done, os.environ.get("FRIDAY_USER_ID", "default"), title, done)

    @function_tool
    async def add_routine(self, title: str) -> str:
        """Add a new daily routine item."""
        return await asyncio.to_thread(add_routine_item, os.environ.get("FRIDAY_USER_ID", "default"), title)

    @function_tool
    async def update_routine_schedule(self, title: str, days: list[str]) -> str:
        """Set which days a routine repeats. days is a list of full day names."""
        return await asyncio.to_thread(update_routine_schedule, os.environ.get("FRIDAY_USER_ID", "default"), title, days)

    @function_tool
    async def delete_routine(self, title: str) -> str:
        """Delete a routine item by partial title match."""
        return await asyncio.to_thread(delete_routine_item, os.environ.get("FRIDAY_USER_ID", "default"), title)

    @function_tool
    async def get_calendar_events(self) -> str:
        """Get upcoming calendar events."""
        urls = self._profile.preferences.calendar_urls or []
        return await asyncio.to_thread(get_upcoming_events, urls)

    @function_tool
    async def find_calendar_events(self, query: str) -> str:
        """Search calendar events by keyword. Call before deleting to get event_id."""
        return await asyncio.to_thread(find_events, query)

    @function_tool
    async def delete_calendar_event(self, event_id: str) -> str:
        """Delete a calendar event by its ID. Call find_calendar_events first."""
        return await asyncio.to_thread(delete_event, event_id)

    @function_tool
    async def create_calendar_event(self, summary: str, start_iso: str, end_iso: str = "", description: str = "") -> str:
        """Add a Google Calendar event. start_iso and end_iso are ISO 8601 strings."""
        return await asyncio.to_thread(
            create_event,
            summary,
            start_iso,
            end_iso or None,
            description or None,
        )

    @function_tool
    async def get_tasks(self, status: str = "") -> str:
        """Get tasks. status is todo/in_progress/done/archived, empty for active."""
        return await asyncio.to_thread(
            list_tasks,
            os.environ.get("FRIDAY_USER_ID", "default"),
            status or None,
        )

    @function_tool
    async def create_new_task(self, title: str, priority: str = "normal", due_date: str = "", label: str = "") -> str:
        """Create a task. priority is low/normal/high, due_date is YYYY-MM-DD."""
        return await asyncio.to_thread(
            create_task,
            os.environ.get("FRIDAY_USER_ID", "default"),
            title, priority, due_date or None, label or None,
        )

    @function_tool
    async def move_task_status(self, title: str, status: str) -> str:
        """Move a task to todo/in_progress/done/archived by partial title match."""
        return await asyncio.to_thread(
            move_task,
            os.environ.get("FRIDAY_USER_ID", "default"),
            title, status,
        )

    @function_tool
    async def update_task_details(self, title: str, new_title: str = "", priority: str = "", due_date: str = "", label: str = "") -> str:
        """Update a task's fields by partial title match. Empty fields are unchanged."""
        return await asyncio.to_thread(
            update_task,
            os.environ.get("FRIDAY_USER_ID", "default"),
            title,
            new_title or None,
            priority or None,
            due_date or None,
            label or None,
        )

    @function_tool
    async def get_goals(self) -> str:
        """Get the user's goals list with target dates."""
        return await asyncio.to_thread(get_goals, os.environ.get("FRIDAY_USER_ID", "default"))

    @function_tool
    async def add_goal(self, title: str, target_date: str = "") -> str:
        """Add a new goal. target_date is YYYY-MM-DD, empty for no date."""
        return await asyncio.to_thread(add_goal, os.environ.get("FRIDAY_USER_ID", "default"), title, target_date or None)

    @function_tool
    async def update_goal(self, title: str, new_title: str = "", target_date: str = "") -> str:
        """Update a goal by partial title match. Empty fields are unchanged."""
        return await asyncio.to_thread(update_goal, os.environ.get("FRIDAY_USER_ID", "default"), title, new_title or None, target_date or None)

    @function_tool
    async def delete_goal(self, title: str) -> str:
        """Delete a goal by partial title match."""
        return await asyncio.to_thread(delete_goal, os.environ.get("FRIDAY_USER_ID", "default"), title)


async def entrypoint(ctx: agents.JobContext):
    user_id = os.environ.get("FRIDAY_USER_ID", "default")

    # Load profile and check briefings off the event loop so the room
    # connection isn't blocked by Supabase / file I/O latency.
    profile, pending = await asyncio.gather(
        asyncio.to_thread(load_profile, user_id),
        asyncio.to_thread(get_pending_briefing, user_id),
    )

    await ctx.connect()

    _anthropic_client = anthropic_sdk.AsyncClient(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        http_client=httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, read=180.0),
            follow_redirects=True,
        ),
    )
    session = AgentSession(
        stt=deepgram.STT(api_key=os.environ["DEEPGRAM_API_KEY"]),
        llm=anthropic.LLM(
            model="claude-haiku-4-5-20251001",
            client=_anthropic_client,
            _strict_tool_schema=False,
        ),
        tts=google.TTS(
            voice_name="en-US-Chirp3-HD-Aoede",
            audio_encoding=texttospeech.AudioEncoding.OGG_OPUS,
        ),
    )

    agent = FridayVoiceAgent(profile, pending_briefing=pending)
    await session.start(agent, room=ctx.room)

    if pending:
        greeting = (
            f"Greet the user briefly by name. "
            f"Then mention you have their '{pending['name']}' ready and ask if they'd like to hear it now."
        )
    else:
        greeting = "Greet the user briefly by name."

    await session.generate_reply(instructions=greeting)


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint, agent_name="friday"))
