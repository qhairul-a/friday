"""
Garmin Connect API wrapper.
Handles authentication, token caching, and raw metric fetching.
All functions return empty dicts / None on API failure so a partial outage
doesn't break a full sync.

Token persistence: tokens are stored both on disk (GARMIN_TOKEN_DIR) and in
Supabase (profiles.data.garmin_tokens) so they survive container restarts.
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from garminconnect import Garmin, GarminConnectAuthenticationError

from core.config import settings

logger = logging.getLogger(__name__)

_garmin_client: Garmin | None = None
_pending_mfa: dict | None = None  # holds {"client": Garmin, "state": ...} during 2FA


# ── Token persistence helpers ─────────────────────────────────────────────────

def _save_tokens(client: Garmin) -> None:
    """Serialize garth tokens and save to disk + Supabase."""
    try:
        token_dir = settings.GARMIN_TOKEN_DIR
        token_dir.mkdir(parents=True, exist_ok=True)
        client.client.dump(str(token_dir))
        token_str = client.client.dumps()
        from core.supabase_client import supabase as _supa
        # upsert so tokens are saved even if the profiles row doesn't exist yet
        _supa.table("profiles").upsert(
            {"user_id": "default", "data": {"garmin_tokens": token_str}},
            on_conflict="user_id",
        ).execute()
        logger.info("Garmin tokens saved to disk and Supabase")
    except Exception as e:
        logger.warning("Failed to persist Garmin tokens: %s", e)


def _load_tokens_from_supabase() -> str | None:
    """Return garth token string from Supabase, or None if not found."""
    try:
        from core.supabase_client import supabase as _supa
        result = _supa.table("profiles").select("data").eq("user_id", "default").single().execute()
        if not result.data:
            return None
        return result.data.get("data", {}).get("garmin_tokens")
    except Exception as e:
        logger.warning("Failed to load Garmin tokens from Supabase: %s", e)
        return None


# ── MFA flow (called from api.py) ─────────────────────────────────────────────

def request_mfa_code() -> bool:
    """Initiate fresh Garmin login, which sends a 2FA code to the user's email.
    Returns True if MFA is required, False if login succeeded without MFA."""
    global _pending_mfa, _garmin_client
    _garmin_client = None
    client = Garmin(
        email=settings.GARMIN_EMAIL,
        password=settings.GARMIN_PASSWORD,
        return_on_mfa=True,
    )
    state = client.login()
    if state:
        _pending_mfa = {"client": client, "state": state}
        return True
    # Login succeeded with no MFA (e.g. session still valid)
    _save_tokens(client)
    _garmin_client = client
    _pending_mfa = None
    return False


def complete_mfa(code: str) -> None:
    """Complete the 2FA flow with the code from the user's email."""
    global _pending_mfa, _garmin_client
    if not _pending_mfa:
        raise RuntimeError("No pending MFA session. Request a code first via /garmin/request-code.")
    client: Garmin = _pending_mfa["client"]
    state = _pending_mfa["state"]
    client.resume_login(state, code.strip())
    _save_tokens(client)
    _garmin_client = client
    _pending_mfa = None


# ── Internal client accessor ──────────────────────────────────────────────────

def _client() -> Garmin:
    global _garmin_client
    if _garmin_client is not None:
        return _garmin_client

    token_file = settings.GARMIN_TOKEN_DIR / "garmin_tokens.json"

    # If local token is missing, try restoring from Supabase
    if not token_file.exists():
        token_str = _load_tokens_from_supabase()
        if token_str:
            try:
                client = Garmin(
                    email=settings.GARMIN_EMAIL or None,
                    password=settings.GARMIN_PASSWORD or None,
                )
                client.client.loads(token_str)
                _garmin_client = client
                logger.info("Garmin tokens restored from Supabase")
                return _garmin_client
            except Exception as e:
                logger.warning("Supabase token restore failed: %s", e)
        raise RuntimeError(
            "Garmin not authenticated. Use Settings › Health Metrics › Reconnect Garmin."
        )

    try:
        client = Garmin(
            email=settings.GARMIN_EMAIL or None,
            password=settings.GARMIN_PASSWORD or None,
        )
        client.login(str(settings.GARMIN_TOKEN_DIR))
        _garmin_client = client
        return _garmin_client
    except GarminConnectAuthenticationError as e:
        _garmin_client = None
        raise RuntimeError(
            f"Garmin session expired. Use Settings › Health Metrics › Reconnect Garmin."
        ) from e
    except Exception as e:
        _garmin_client = None
        raise RuntimeError(f"Garmin token load failed: {e}") from e


def _safe(fn, *args, **kwargs):
    """Call fn and return result, or empty dict on any exception."""
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        logger.warning("Garmin API call failed: %s", e)
        return {}


def fetch_daily_stats(date: str) -> dict:
    """Return steps, active_minutes, calories, distance_km for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_stats, date)
    if not raw:
        return {}
    distance_m = raw.get("totalDistanceMeters")
    return {
        "steps": raw.get("totalSteps"),
        "active_minutes": raw.get("highlyActiveSeconds", 0) // 60 + raw.get("activeSeconds", 0) // 60,
        "calories": raw.get("totalKilocalories"),
        "distance_km": round(distance_m / 1000, 2) if distance_m else None,
    }


def fetch_sleep(date: str) -> dict:
    """Return sleep stages and score for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_sleep_data, date)
    if not raw:
        return {}
    daily = raw.get("dailySleepDTO", {})
    return {
        "duration_min": (daily.get("sleepTimeSeconds") or 0) // 60,
        "score": daily.get("sleepScores", {}).get("overall", {}).get("value"),
        "deep_min": (daily.get("deepSleepSeconds") or 0) // 60,
        "light_min": (daily.get("lightSleepSeconds") or 0) // 60,
        "rem_min": (daily.get("remSleepSeconds") or 0) // 60,
    }


def fetch_hrv(date: str) -> dict:
    """Return HRV score and status for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_hrv_data, date)
    logger.debug("fetch_hrv raw keys=%s", list(raw.keys()) if isinstance(raw, dict) else raw)
    if not raw:
        return {}
    summary = raw.get("hrvSummary", {})
    logger.debug("fetch_hrv summary=%s", summary)
    return {
        "hrv_score": summary.get("lastNightAvg") or summary.get("lastNight"),
        "hrv_status": summary.get("status"),
    }


def fetch_body_battery(date: str) -> dict:
    """Return body battery low/high for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_body_battery, date)
    if not raw or not isinstance(raw, list):
        return {}
    charged = [e.get("charged") for e in raw if e.get("charged") is not None]
    drained = [e.get("drained") for e in raw if e.get("drained") is not None]
    if not charged and not drained:
        return {}
    values = charged + drained
    return {
        "body_battery_low": min(values),
        "body_battery_high": max(values),
    }


def fetch_stress(date: str) -> dict:
    """Return average stress for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_stress_data, date)
    if not raw:
        return {}
    return {
        "stress_avg": raw.get("avgStressLevel"),
    }


def fetch_resting_hr(date: str) -> dict:
    """Return resting heart rate for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_rhr_day, date)
    logger.debug("fetch_resting_hr raw keys=%s", list(raw.keys()) if isinstance(raw, dict) else raw)
    if not raw:
        return {}
    value = raw.get("allMetrics", {}).get("metricsMap", {}).get("WELLNESS_RESTING_HEART_RATE", [{}])
    logger.debug("fetch_resting_hr WELLNESS_RESTING_HEART_RATE value=%s", value)
    if isinstance(value, list) and value:
        return {"resting_hr": value[0].get("value")}
    return {}


def fetch_vo2max() -> float | None:
    """Return the latest VO2 max estimate."""
    raw = _safe(_client().get_max_metrics, datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m-%d"))
    logger.debug("fetch_vo2max raw=%s", raw)
    if not raw or not isinstance(raw, list):
        return None
    for item in raw:
        logger.debug("fetch_vo2max item keys=%s", list(item.keys()) if isinstance(item, dict) else item)
        if item.get("vo2MaxPreciseValue"):
            return item["vo2MaxPreciseValue"]
        if item.get("generic", {}).get("vo2MaxPreciseValue"):
            return item["generic"]["vo2MaxPreciseValue"]
    return None


def fetch_recent_activities(n: int = 10) -> list[dict]:
    """Return the last n activities with type, duration, distance, avg HR, calories."""
    raw = _safe(_client().get_activities, 0, n)
    if not raw or not isinstance(raw, list):
        return []
    result = []
    for a in raw:
        duration_sec = a.get("duration") or a.get("movingDuration") or 0
        distance_m = a.get("distance") or 0
        result.append({
            "type": a.get("activityType", {}).get("typeKey", "unknown"),
            "name": a.get("activityName", ""),
            "date": (a.get("startTimeLocal") or "")[:10],
            "duration_min": round(duration_sec / 60),
            "distance_km": round(distance_m / 1000, 2) if distance_m else None,
            "avg_hr": a.get("averageHR"),
            "calories": a.get("calories"),
        })
    return result
