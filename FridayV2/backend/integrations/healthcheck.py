"""
Lightweight daily health checks for all Friday integrations.
Each check is self-contained and safe — no side effects, no Garmin re-auth.
"""
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from core.config import settings

logger = logging.getLogger(__name__)


def _check_google_oauth() -> str:
    try:
        from integrations.gsheets import _get_creds
        _get_creds()
        return "✅ Google OAuth"
    except Exception as e:
        return f"❌ Google OAuth: {e}"


def _check_finance() -> str:
    try:
        from integrations.finance import list_fixed_expenses
        list_fixed_expenses()
        return "✅ Finance (Sheets)"
    except Exception as e:
        return f"❌ Finance: {e}"


def _check_calendar() -> str:
    try:
        from integrations.gcal import get_upcoming_events
        get_upcoming_events(days=1)
        return "✅ Calendar"
    except Exception as e:
        return f"❌ Calendar: {e}"


def _check_tasks() -> str:
    try:
        from integrations.gtasks import list_tasks
        list_tasks()
        return "✅ Tasks"
    except Exception as e:
        return f"❌ Tasks: {e}"


def _check_notes() -> str:
    try:
        from integrations.gdrive_notes import list_notes
        list_notes(limit=1)
        return "✅ Notes (Drive)"
    except Exception as e:
        return f"❌ Notes: {e}"


def _check_garmin() -> str:
    """Check token file only — never calls Garmin API to avoid triggering MFA."""
    try:
        token_file = settings.GARMIN_TOKEN_DIR / "garmin_tokens.json"
        if not token_file.exists():
            return "❌ Garmin: token missing — run setup_garmin.py"
        data = json.loads(token_file.read_text())
        if not data:
            return "❌ Garmin: token file is empty"
        return "✅ Garmin (token present)"
    except json.JSONDecodeError:
        return "❌ Garmin: token file corrupted"
    except Exception as e:
        return f"❌ Garmin: {e}"


def _check_supabase() -> str:
    try:
        from core.supabase_client import supabase
        supabase.table("health_metrics").select("date").limit(1).execute()
        return "✅ Supabase"
    except Exception as e:
        return f"❌ Supabase: {e}"


_CHECKS = [
    _check_google_oauth,
    _check_finance,
    _check_calendar,
    _check_tasks,
    _check_notes,
    _check_garmin,
    _check_supabase,
]


def check_all() -> str:
    """Run all integration checks. Returns a formatted message for Telegram."""
    results = []
    for fn in _CHECKS:
        try:
            results.append(fn())
        except Exception as e:
            results.append(f"❌ {fn.__name__}: {e}")

    ok = all(r.startswith("✅") for r in results)
    now = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%d %b %Y, %I:%M %p")

    if ok:
        header = f"🟢 *All Systems OK* — _{now}_"
    else:
        failed = sum(1 for r in results if not r.startswith("✅"))
        header = f"🔴 *{failed} issue(s) detected* — _{now}_"

    return header + "\n" + "\n".join(results)
