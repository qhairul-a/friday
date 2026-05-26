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

from livekit import agents, rtc
from livekit.agents import AgentSession, Agent, function_tool, room_io
from livekit.plugins import deepgram, google, anthropic
from google.cloud import texttospeech

from profile.storage import load_profile
from profile.schema import FridayProfile
from integrations import gdrive_notes
from integrations.expenses import append_expense, get_finance_context, list_expenses, edit_expense, delete_expense
from integrations.calendar import get_upcoming_events, create_event, find_events, delete_event
from integrations.routines import get_routines, mark_routine_done, add_routine_item, delete_routine_item, update_routine_schedule
from integrations.briefings import get_pending_briefing, mark_delivered, build_briefing_content
from integrations.tasks import list_tasks, create_task, move_task, update_task
from integrations.goals import get_goals, add_goal, update_goal, delete_goal
from integrations.reminders import get_reminders, add_reminder, edit_reminder, mark_reminder_done, delete_reminder
from integrations.garmin_health import get_health_today, get_health_trends


def _build_profile_context(profile: FridayProfile) -> str:
    """
    Build a compact, safe profile summary for the system prompt.

    Omits credentials (garmin_email/password), internal config (google_sheet_id,
    calendar_urls), and caps notes at the 5 most recent entries.
    Uses compact JSON (no indentation) — saves ~200–400 tokens vs indent=2.

    The system prompt is stable across turns so Anthropic's ephemeral cache
    applies: after the first message, these tokens cost ~10% of normal price.
    """
    import dataclasses
    p = profile
    ctx = {
        "identity":          dataclasses.asdict(p.identity),
        "daily_routine":     dataclasses.asdict(p.daily_routine),
        "health":            dataclasses.asdict(p.health),
        "work_and_projects": dataclasses.asdict(p.work_and_projects),
        "goals":             dataclasses.asdict(p.goals),
        "finance": {
            "monthly_income":     p.finance.monthly_income,
            "currency":           p.finance.currency,
            "budget_allocations": p.finance.budget_allocations,
            "savings_goals":      p.finance.savings_goals,
            "liabilities_list":   p.finance.liabilities_list,
            # google_sheet_id omitted — internal integration config
        },
        "notes": p.notes[-5:],  # most recent 5 only
        "preferences": {
            "communication_style": p.preferences.communication_style,
            "verbosity":           p.preferences.verbosity,
            "hobbies":             p.preferences.hobbies,
            "entertainment":       p.preferences.entertainment,
            # calendar_urls omitted — used by tools only, not conversation
        },
        # integrations section omitted entirely:
        # garmin_email / garmin_password are credentials that must never
        # be forwarded to the LLM.
    }
    import json
    return json.dumps(ctx, separators=(",", ":"))  # compact — no whitespace tokens


def _build_voice_instructions(profile: FridayProfile) -> str:
    raw = profile.identity.preferred_name or ""
    name = raw.split(";")[0].strip() or profile.identity.name or "there"
    tz = ZoneInfo(os.environ.get("TIMEZONE", "Asia/Singapore"))
    now = datetime.now(tz)
    today = now.strftime("%A, %d %B %Y, %I:%M %p")
    profile_ctx = _build_profile_context(profile)
    return f"""You are Friday, a personal AI assistant for {name}.

Today is {today}.

Behaviour rules:
- Be proactive, concise, and warm.
- You are speaking aloud — respond in natural spoken sentences. No markdown, no bullet points.
- Keep responses short: 1–3 sentences for most replies.
- When you log something, confirm briefly in one sentence.
- Be proactive: mention anything worth flagging after the main response.

Finance rules:
- IMPORTANT: The profile's finance section below is budget metadata ONLY (income, allocations, liabilities). It does NOT contain actual spending transactions.
- ALL actual expense and spending transaction data lives in the Supabase database, accessible ONLY via your tools.
- For ANY question about spending, expenses, costs, or financial analysis — including "variable expenses", "personal expenses", "how much did I spend", "what are my expenses" — you MUST call get_spending_summary. Never say you cannot access this data.
- "Variable expenses" means personal/discretionary spending (food, transport, entertainment, etc.) from the database — call get_spending_summary and read the category breakdown aloud.
- "Fixed expenses" or "liabilities" are found in profile.finance.liabilities_list below — read those directly from the profile.
- get_spending_summary accepts an optional month (YYYY-MM). Use it for historical queries, e.g. '2026-04' for April 2026.
- To record a new expense, call log_expense.
- If a tool call fails due to a technical error, say so clearly — do not say "I don't have access to that data".

Calendar rules:
- All calendar event times are already converted to Asia/Singapore time before you receive them. Read them exactly as given.
- Never say events are in UTC or mention timezone conversion — the times are already correct for the user.

Health rules:
- For any question about steps, distance, heart rate, body battery, stress, sleep, or fitness — call get_health_today.
- For trends, weekly/monthly analysis, or health advice/recommendations — call get_health_trends. Analyse all the data returned and give 2–3 natural spoken recommendations with specific numbers.
- Speak naturally. No bullet points. Reference actual numbers from the data.
- Never give medical diagnoses. For persistent concerning patterns, suggest consulting a doctor.
- Health data syncs every 4 hours. If data is missing, say it hasn't synced yet today.

Here is everything you know about {name}:
{profile_ctx}"""


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
    async def list_notes(self) -> str:
        """List recent notes. Call this before editing or deleting a note."""
        return await asyncio.to_thread(gdrive_notes.list_notes)

    @function_tool
    async def edit_note(self, title: str, new_content: str) -> str:
        """Update the content of an existing note by partial title match."""
        return await asyncio.to_thread(gdrive_notes.edit_note, title, new_content)

    @function_tool
    async def delete_note(self, title: str) -> str:
        """Delete a note by partial title match. Always confirm with user before calling."""
        return await asyncio.to_thread(gdrive_notes.delete_note, title)

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
    async def list_recent_expenses(self, month: str = "") -> str:
        """List individual expense entries with IDs. Call this before editing or deleting. month is YYYY-MM, empty for current month."""
        return await asyncio.to_thread(
            list_expenses,
            os.environ.get("FRIDAY_USER_ID", "default"),
            month or None,
        )

    @function_tool
    async def edit_expense(self, expense_id: str, amount: float = 0, category: str = "", description: str = "", expense_date: str = "") -> str:
        """Edit an expense by its short ID (from list_recent_expenses). Pass only fields to change; leave others empty."""
        return await asyncio.to_thread(
            edit_expense,
            os.environ.get("FRIDAY_USER_ID", "default"),
            expense_id,
            amount if amount else None,
            category or None,
            description or None,
            expense_date or None,
        )

    @function_tool
    async def delete_expense(self, expense_id: str) -> str:
        """Delete an expense by its short ID (from list_recent_expenses). Always confirm with user before calling."""
        return await asyncio.to_thread(
            delete_expense,
            os.environ.get("FRIDAY_USER_ID", "default"),
            expense_id,
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

    @function_tool
    async def get_reminders(self, include_done: bool = False) -> str:
        """Get reminders. Set include_done=true to show completed ones too."""
        return await asyncio.to_thread(get_reminders, os.environ.get("FRIDAY_USER_ID", "default"), include_done)

    @function_tool
    async def add_reminder(self, title: str, remind_at: str, note: str = "") -> str:
        """Set a reminder. remind_at is ISO 8601 e.g. '2026-05-25T09:00'. note is optional extra detail."""
        return await asyncio.to_thread(add_reminder, os.environ.get("FRIDAY_USER_ID", "default"), title, remind_at, note)

    @function_tool
    async def edit_reminder(self, reminder_id: str, title: str = "", remind_at: str = "", note: str = "") -> str:
        """Edit a reminder by its short ID (from get_reminders). Leave fields empty to keep unchanged."""
        return await asyncio.to_thread(edit_reminder, os.environ.get("FRIDAY_USER_ID", "default"), reminder_id, title, remind_at, note)

    @function_tool
    async def mark_reminder_done(self, reminder_id: str, done: bool = True) -> str:
        """Mark a reminder as done or undone by its short ID."""
        return await asyncio.to_thread(mark_reminder_done, os.environ.get("FRIDAY_USER_ID", "default"), reminder_id, done)

    @function_tool
    async def delete_reminder(self, reminder_id: str) -> str:
        """Delete a reminder by its short ID. Always confirm with user before calling."""
        return await asyncio.to_thread(delete_reminder, os.environ.get("FRIDAY_USER_ID", "default"), reminder_id)

    @function_tool
    async def get_health_today(self, date: str = "") -> str:
        """Get today's health snapshot: steps, distance, heart rate, body battery, stress, sleep."""
        return await asyncio.to_thread(
            get_health_today, os.environ.get("FRIDAY_USER_ID", "default"), date or None
        )

    @function_tool
    async def get_health_trends(self, days: int = 7) -> str:
        """Analyse health trends and give recommendations. days=7 for a week, days=30 for a month."""
        return await asyncio.to_thread(
            get_health_trends, os.environ.get("FRIDAY_USER_ID", "default"), days
        )


async def entrypoint(ctx: agents.JobContext):
    user_id = os.environ.get("FRIDAY_USER_ID", "default")

    # Connect to the LiveKit room FIRST so the agent appears as a participant
    # immediately. The browser starts a 30-second timeout when it joins the room;
    # being present quickly (before the slow I/O below) keeps us well within that
    # window and prevents spurious "didn't respond in time" errors.
    await ctx.connect()

    # ── Duplicate-agent guard ─────────────────────────────────────────────────
    # LiveKit dispatches a new job every time a user joins the room, even when
    # the persistent agent from a previous session is still present.  Without
    # this check that causes two Friday instances to run side-by-side, producing
    # the "double voice" symptom.  If another agent participant is already in
    # the room we exit immediately and let the existing agent handle the session.
    for participant in ctx.room.remote_participants.values():
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            print("[friday] Duplicate agent detected — exiting to prevent double-voice.")
            return

    # Load profile and pending briefing concurrently while already connected.
    # Use return_exceptions=True so a Supabase outage at startup doesn't crash the
    # entrypoint silently. Without this, any exception from load_profile or
    # get_pending_briefing propagates through gather and kills the process — the user
    # sees Friday connect then immediately drop with no greeting and no error message.
    results = await asyncio.gather(
        asyncio.to_thread(load_profile, user_id),
        asyncio.to_thread(get_pending_briefing, user_id),
        return_exceptions=True,
    )
    if isinstance(results[0], Exception):
        print(f"[friday] Warning: load_profile failed ({results[0]}), using empty profile.")
        profile = FridayProfile()
    else:
        profile = results[0]
    if isinstance(results[1], Exception):
        print(f"[friday] Warning: get_pending_briefing failed ({results[1]}), skipping briefing.")
        pending = None
    else:
        pending = results[1]

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
            caching="ephemeral",       # cache system prompt — ~90% off on turns 2+
            _strict_tool_schema=False,
        ),
        tts=google.TTS(
            voice_name="en-US-Chirp3-HD-Aoede",
            audio_encoding=texttospeech.AudioEncoding.OGG_OPUS,
        ),
    )

    agent = FridayVoiceAgent(profile, pending_briefing=pending)

    # ── Register disconnect handler BEFORE session.start() ───────────────────
    # If registered after generate_reply(), a disconnect during the greeting
    # fires the event before the handler exists — disconnected never gets set —
    # and the process waits forever, becoming a zombie that blocks the worker.
    disconnected = asyncio.Event()
    ctx.room.on("disconnected", lambda: disconnected.set())

    await session.start(
        agent,
        room=ctx.room,
        # Keep the session alive when the user navigates away or closes the tab.
        # Without this, every disconnect triggers a new job dispatch on reconnect,
        # spawning a second competing process which exhausts the worker capacity.
        room_options=room_io.RoomOptions(close_on_disconnect=False),
    )

    if pending:
        greeting = (
            f"Greet the user briefly by name. "
            f"Then mention you have their '{pending['name']}' ready and ask if they'd like to hear it now."
        )
    else:
        greeting = "Greet the user briefly by name."

    # Wrap the initial greeting so an Anthropic error (credits exhausted, rate
    # limit, network blip) doesn't crash the entrypoint silently. Without this,
    # Friday connects and says nothing — the "stuck listening" symptom. With this,
    # the error is logged and Friday stays connected so the user can still speak.
    try:
        await session.generate_reply(instructions=greeting)
    except Exception as e:
        print(f"[friday] Warning: initial greeting failed ({e}). Friday is still listening.")

    # ── Wait for room disconnect before exiting ──────────────────────────────
    #
    # We wait until LiveKit closes the room (all participants leave) and then
    # exit cleanly. This lets the framework recycle the process correctly.
    #
    # Previous design used asyncio.sleep(float("inf")) which caused processes to
    # accumulate: when a session ended the process would never exit voluntarily,
    # the SDK had to force-kill it after 60 s, leaving zombie processes that ate
    # VM memory/CPU until the load threshold (0.85) was breached and the worker
    # marked itself unavailable — causing the "agent offline" symptom.
    if not disconnected.is_set():
        await disconnected.wait()


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name="friday",
        # Raise from default 0.70 → 0.85: the VM was hitting 0.707 load with
        # zero active sessions, locking out all new connections.
        load_threshold=0.85,
        # 0 idle processes: no pre-warmed pool to replenish.
        #
        # With num_idle_processes=1, after each session the SDK immediately tries
        # to fork a replacement warm process. On the e2-micro (1 GB RAM) that fork
        # competes with the still-running session for CPU, hits the ~10 s
        # initialization timeout, gets killed, and the cascade of failed forks
        # spikes load to 1.7+ → worker marks itself unavailable even with 0 active
        # sessions.
        #
        # With 0 idle processes, no fork happens during a session. When the user
        # next connects the worker spawns a fresh process on demand — the previous
        # session has already exited by then so the VM is idle and initialization
        # completes cleanly.
        num_idle_processes=0,
        # Cold Python startup (imports + module init) takes 12–20 s on this e2-micro.
        # The SDK default is 10 s, which consistently kills the process before it can
        # ack — causing the "did not connect" symptom after any idle period.
        # 60 s gives plenty of headroom; there's no user-visible cost since the user
        # is already waiting for the agent to come online.
        initialize_process_timeout=60.0,
    ))
