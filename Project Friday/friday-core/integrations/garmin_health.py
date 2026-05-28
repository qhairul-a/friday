"""
Garmin Health integration for Friday.

sync_today(user_id)     → called by scripts/sync_garmin.py every 4 hours.
get_health_today()      → today's snapshot spoken by Friday.
get_health_trends()     → multi-day data for Friday to analyse and give recommendations.
"""
import os
from datetime import date, timedelta
from supabase import create_client
from profile.storage import load_profile

_supabase = None


def _client():
    global _supabase
    if _supabase is None:
        _supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _supabase


def _surface_metrics(user_id: str) -> list[str]:
    """Return the list of metrics the user wants surfaced in conversation and widget."""
    try:
        profile = load_profile(user_id)
        return getattr(profile.integrations, "garmin_metrics", [])
    except Exception:
        return []


def sync_today(user_id: str) -> str:
    """Pull all available metrics from Garmin Connect and upsert to Supabase."""
    from garminconnect import Garmin

    # Prefer credentials stored in the user's profile (entered via Settings page).
    # Fall back to env vars for backwards-compatibility.
    try:
        profile = load_profile(user_id)
        email    = getattr(profile.integrations, "garmin_email", "").strip() or os.environ.get("GARMIN_EMAIL", "")
        password = getattr(profile.integrations, "garmin_password", "").strip() or os.environ.get("GARMIN_PASSWORD", "")
    except Exception:
        email    = os.environ.get("GARMIN_EMAIL", "")
        password = os.environ.get("GARMIN_PASSWORD", "")

    if not email or not password:
        raise RuntimeError("Garmin credentials not set. Enter them in Settings → Health Metrics.")

    # Use a persistent tokenstore so we reuse OAuth tokens across sync runs.
    # Without this, every 4-hour sync does a fresh OAuth flow and Garmin
    # sends an OTP email every time. With cached tokens, MFA is only needed
    # once (when tokens first expire, typically after 30+ days).
    tokenstore = os.path.expanduser("~/.garmin_tokens")

    gc = Garmin(email, password)
    try:
        gc.login(tokenstore=tokenstore)
    except Exception as e:
        raise RuntimeError(
            f"Garmin auth failed — run the setup script to authenticate with MFA: "
            f"python scripts/setup_garmin_auth.py\n(Error: {e})"
        )

    today = date.today().isoformat()

    # Fetch all metric groups — each call is independent; failures are non-fatal.
    # Returns the result as-is (preserving lists), or {} on error / None return.
    def safe(fn, *args, **kwargs):
        try:
            result = fn(*args, **kwargs)
            return result if result is not None else {}
        except Exception as e:
            print(f"[garmin] Warning: {fn.__name__} failed: {e}")
            return {}

    stats  = safe(gc.get_stats, today)
    hr     = safe(gc.get_heart_rates, today)
    stress = safe(gc.get_stress_data, today)
    sleep  = safe(gc.get_sleep_data, today)
    bb     = safe(gc.get_body_battery, today)
    spo2   = safe(gc.get_spo2_data, today)
    hrv    = safe(gc.get_hrv_data, today)

    # ── Average heart rate from per-minute values ──────────────────────────────
    hr_values = [v[1] for v in (hr.get("heartRateValues") or []) if v[1] is not None]
    hr_avg = round(sum(hr_values) / len(hr_values)) if hr_values else None

    # ── Body battery high / low ────────────────────────────────────────────────
    bb_list = bb if isinstance(bb, list) else []
    bb_vals = [item.get("value") for item in bb_list if item.get("value") is not None]
    bb_high = max(bb_vals) if bb_vals else None
    bb_low  = min(bb_vals) if bb_vals else None

    # ── SpO2 average from hourly readings ──────────────────────────────────────
    # Use `or []` after .get() — key may exist with a null value, bypassing the default
    spo2_readings = [
        r.get("averageSpO2")
        for r in ((spo2 or {}).get("spO2HourlyAverages") or [])
        if r and r.get("averageSpO2")
    ]
    spo2_avg = round(sum(spo2_readings) / len(spo2_readings), 1) if spo2_readings else None

    # ── HRV weekly average ─────────────────────────────────────────────────────
    hrv_avg = ((hrv or {}).get("hrvSummary") or {}).get("weeklyAvg")

    # ── Sleep breakdown ────────────────────────────────────────────────────────
    # `or {}` guards against dailySleepDTO key existing with a null value
    sd          = (sleep or {}).get("dailySleepDTO") or {}
    sleep_hrs   = round(sd.get("sleepTimeSeconds", 0) / 3600, 2) or None
    sleep_score = (sd.get("sleepScores") or {}).get("overall", {}).get("value") or None
    deep_hrs    = round(sd.get("deepSleepSeconds", 0) / 3600, 2) or None
    light_hrs   = round(sd.get("lightSleepSeconds", 0) / 3600, 2) or None
    rem_hrs     = round(sd.get("remSleepSeconds", 0) / 3600, 2) or None

    # ── VO2 max ────────────────────────────────────────────────────────────────
    vo2 = stats.get("vo2MaxValue") or stats.get("maxVO2")

    def _int(v):
        return int(v) if v is not None else None

    row = {
        "user_id":            user_id,
        "date":               today,
        "steps":              _int(stats.get("totalSteps")),
        "steps_goal":         _int(stats.get("dailyStepGoal")),
        "distance_km":        round(stats.get("totalDistanceMeters", 0) / 1000, 2) or None,
        "calories_active":    _int(stats.get("activeKilocalories")),
        "calories_total":     _int(stats.get("totalKilocalories")),
        "active_minutes":     _int((stats.get("highlyActiveSeconds") or 0) // 60) or None,
        "floors_climbed":     _int(stats.get("floorsAscended")),
        "heart_rate_resting": _int(hr.get("restingHeartRate")),
        "heart_rate_avg":     _int(hr_avg),
        "hrv_weekly_avg":     float(hrv_avg) if hrv_avg else None,
        "body_battery_high":  _int(bb_high),
        "body_battery_low":   _int(bb_low),
        "stress_avg":         _int(stress.get("avgStressLevel")),
        "spo2_avg":           spo2_avg,
        "sleep_duration_hrs": sleep_hrs,
        "sleep_score":        _int(sleep_score),
        "sleep_deep_hrs":     deep_hrs,
        "sleep_light_hrs":    light_hrs,
        "sleep_rem_hrs":      rem_hrs,
        "vo2_max":            float(vo2) if vo2 else None,
    }
    _client().table("health_metrics").upsert(row, on_conflict="user_id,date").execute()
    return f"Synced Garmin health metrics for {today}"


def get_health_today(user_id: str, target_date: str | None = None) -> str:
    """Spoken summary of today's health — only surfaced metrics included."""
    surfaced = _surface_metrics(user_id)
    d = target_date or date.today().isoformat()
    rows = (
        _client().table("health_metrics").select("*")
        .eq("user_id", user_id).eq("date", d).execute().data
    )
    if not rows:
        return f"No health data synced for {d} yet — it updates every 4 hours."
    r = rows[0]

    parts = []
    if "steps" in surfaced and r.get("steps"):
        goal = r.get("steps_goal")
        pct  = f" ({round(r['steps'] / goal * 100)}% of goal)" if goal else ""
        parts.append(f"{r['steps']:,} steps{pct}")
    if "distance" in surfaced and r.get("distance_km"):
        parts.append(f"{r['distance_km']} km walked")
    if "calories_active" in surfaced and r.get("calories_active"):
        parts.append(f"{r['calories_active']} active calories burned")
    if "active_minutes" in surfaced and r.get("active_minutes"):
        parts.append(f"{r['active_minutes']} active minutes")
    if "floors_climbed" in surfaced and r.get("floors_climbed"):
        parts.append(f"{r['floors_climbed']} floors climbed")
    if "heart_rate_resting" in surfaced and r.get("heart_rate_resting"):
        parts.append(f"resting heart rate {r['heart_rate_resting']} bpm")
    if "heart_rate_avg" in surfaced and r.get("heart_rate_avg"):
        parts.append(f"average heart rate {r['heart_rate_avg']} bpm")
    if "hrv" in surfaced and r.get("hrv_weekly_avg"):
        parts.append(f"HRV weekly average {r['hrv_weekly_avg']}")
    if "body_battery" in surfaced and r.get("body_battery_high") is not None:
        parts.append(f"body battery peaked at {r['body_battery_high']}, low of {r['body_battery_low']}")
    if "stress_avg" in surfaced and r.get("stress_avg"):
        label = "low" if r["stress_avg"] < 26 else "moderate" if r["stress_avg"] < 51 else "high"
        parts.append(f"stress level {r['stress_avg']} ({label})")
    if "spo2" in surfaced and r.get("spo2_avg"):
        parts.append(f"blood oxygen {r['spo2_avg']}%")
    if "sleep_duration" in surfaced and r.get("sleep_duration_hrs"):
        h = int(r["sleep_duration_hrs"])
        m = int((r["sleep_duration_hrs"] % 1) * 60)
        parts.append(f"{h}h {m}m sleep last night")
    if "sleep_score" in surfaced and r.get("sleep_score"):
        parts.append(f"sleep score {r['sleep_score']}")
    if "sleep_stages" in surfaced and r.get("sleep_deep_hrs"):
        parts.append(
            f"sleep stages: {r['sleep_deep_hrs']}h deep, "
            f"{r.get('sleep_light_hrs', 0)}h light, {r.get('sleep_rem_hrs', 0)}h REM"
        )
    if "vo2_max" in surfaced and r.get("vo2_max"):
        parts.append(f"VO2 max {r['vo2_max']}")

    if not parts:
        return "No enabled health metrics have data for today yet."
    return "Here's your health summary: " + "; ".join(parts) + "."


def get_health_trends(user_id: str, days: int = 7) -> str:
    """Return all stored health data for N days for Friday to analyse and recommend.
    All metrics are included regardless of surface settings, for richer analysis.
    """
    start = (date.today() - timedelta(days=days - 1)).isoformat()
    rows = (
        _client().table("health_metrics").select("*")
        .eq("user_id", user_id).gte("date", start)
        .order("date", desc=False).execute().data
    )
    if not rows:
        return "Not enough health data yet for trend analysis."

    lines = [
        f"All health data for the past {len(rows)} days. "
        "Analyse trends across all metrics and give 2–3 specific, actionable spoken recommendations:"
    ]
    for r in rows:
        fields = {
            "steps":          r.get("steps"),
            "distance_km":    r.get("distance_km"),
            "active_min":     r.get("active_minutes"),
            "floors":         r.get("floors_climbed"),
            "cal_active":     r.get("calories_active"),
            "hr_rest":        r.get("heart_rate_resting"),
            "hr_avg":         r.get("heart_rate_avg"),
            "hrv":            r.get("hrv_weekly_avg"),
            "body_bat_high":  r.get("body_battery_high"),
            "body_bat_low":   r.get("body_battery_low"),
            "stress":         r.get("stress_avg"),
            "spo2":           r.get("spo2_avg"),
            "sleep_hrs":      r.get("sleep_duration_hrs"),
            "sleep_score":    r.get("sleep_score"),
            "deep_hrs":       r.get("sleep_deep_hrs"),
            "rem_hrs":        r.get("sleep_rem_hrs"),
            "vo2":            r.get("vo2_max"),
        }
        non_null = {k: v for k, v in fields.items() if v is not None}
        lines.append("  " + r["date"] + ": " + ", ".join(f"{k}={v}" for k, v in non_null.items()))

    lines.append(
        "\nSpeak your analysis naturally. No bullet points. "
        "Be specific — reference actual numbers. Never diagnose; suggest a doctor for persistent concerns."
    )
    return "\n".join(lines)
