"""
High-level fitness operations.
Syncs Garmin data to Supabase and provides formatted summaries for the fitness agent.
"""

import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from core.config import settings
from core.supabase_client import supabase

logger = logging.getLogger(__name__)
from integrations.garmin import (
    fetch_daily_stats,
    fetch_sleep,
    fetch_hrv,
    fetch_body_battery,
    fetch_stress,
    fetch_resting_hr,
    fetch_vo2max,
    fetch_recent_activities,
)


def _today() -> str:
    return datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m-%d")


def _to_int(val) -> int | None:
    return int(val) if val is not None else None


def sync_today() -> str:
    """Fetch all today's metrics from Garmin and upsert to fitness_daily."""
    date = _today()

    stats = fetch_daily_stats(date)
    sleep = fetch_sleep(date)
    hrv = fetch_hrv(date)
    battery = fetch_body_battery(date)
    stress = fetch_stress(date)
    rhr = fetch_resting_hr(date)
    vo2 = fetch_vo2max()

    logger.info("sync_today fetch results — rhr=%s  hrv=%s  vo2=%s", rhr, hrv, vo2)

    def _to_hrs(mins) -> float | None:
        return round(int(mins) / 60, 2) if mins is not None else None

    row = {
        "user_id": "default",
        "date": date,
        "steps": _to_int(stats.get("steps")),
        "active_minutes": _to_int(stats.get("active_minutes")),
        "calories_active": _to_int(stats.get("calories")),
        "distance_km": stats.get("distance_km"),
        "heart_rate_resting": _to_int(rhr.get("resting_hr")),
        "sleep_duration_hrs": _to_hrs(sleep.get("duration_min")),
        "sleep_score": _to_int(sleep.get("score")),
        "sleep_deep_hrs": _to_hrs(sleep.get("deep_min")),
        "sleep_light_hrs": _to_hrs(sleep.get("light_min")),
        "sleep_rem_hrs": _to_hrs(sleep.get("rem_min")),
        "hrv_weekly_avg": hrv.get("hrv_score"),
        "body_battery_low": _to_int(battery.get("body_battery_low")),
        "body_battery_high": _to_int(battery.get("body_battery_high")),
        "stress_avg": _to_int(stress.get("stress_avg")),
        "vo2_max": vo2,
    }

    try:
        supabase.table("health_metrics").upsert(row, on_conflict="user_id,date").execute()
    except Exception as e:
        raise RuntimeError(f"Supabase upsert failed: {e}") from e
    return f"Synced fitness data for {date}."


def _read_row(date: str) -> dict | None:
    result = supabase.table("health_metrics").select("*").eq("user_id", "default").eq("date", date).execute()
    rows = result.data
    return rows[0] if rows else None


def get_daily_summary(date: str | None = None) -> str:
    """Return a formatted daily health summary. Auto-syncs if querying today."""
    target = date or _today()
    if target == _today():
        sync_today()

    row = _read_row(target)
    if not row:
        return f"No fitness data found for {target}. Make sure your Garmin watch has synced."

    lines = [f"Health summary for {target}:"]

    if row.get("steps") is not None:
        lines.append(f"Steps: {row['steps']:,}")
    if row.get("active_minutes") is not None:
        lines.append(f"Active minutes: {row['active_minutes']} min")
    if row.get("calories_active") is not None:
        lines.append(f"Calories burned: {row['calories_active']} kcal")
    if row.get("heart_rate_resting") is not None:
        lines.append(f"Resting HR: {row['heart_rate_resting']} bpm")

    if row.get("sleep_duration_hrs") is not None:
        hrs = float(row["sleep_duration_hrs"])
        h = int(hrs); m = round((hrs % 1) * 60)
        score = f" (score: {row['sleep_score']})" if row.get("sleep_score") else ""
        lines.append(f"Sleep: {h}h {m}m{score}")
        if row.get("sleep_deep_hrs") is not None:
            deep = float(row["sleep_deep_hrs"]); rem = float(row.get("sleep_rem_hrs") or 0)
            lines.append(f"  Deep: {deep:.1f}h  REM: {rem:.1f}h")

    if row.get("hrv_weekly_avg") is not None:
        lines.append(f"HRV: {row['hrv_weekly_avg']} ms")

    if row.get("body_battery_low") is not None:
        lines.append(f"Body Battery: {row['body_battery_low']}–{row['body_battery_high']}")

    if row.get("stress_avg") is not None:
        lines.append(f"Avg stress: {row['stress_avg']}")

    if row.get("vo2_max") is not None:
        lines.append(f"VO2 max: {float(row['vo2_max']):.1f}")

    return "\n".join(lines)


def get_weekly_trends(n_days: int = 7) -> str:
    """Return averaged trends for the last n_days from Supabase (no Garmin API call)."""
    today = datetime.strptime(_today(), "%Y-%m-%d")
    start = (today - timedelta(days=n_days - 1)).strftime("%Y-%m-%d")

    result = supabase.table("health_metrics").select("*").eq("user_id", "default").gte("date", start).order("date").execute()
    rows = result.data

    if not rows:
        return f"No fitness data found for the last {n_days} days. Sync some data first."

    def avg(field: str) -> float | None:
        vals = [r[field] for r in rows if r.get(field) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    lines = [f"Fitness trends — last {n_days} days ({start} to {_today()}):"]
    lines.append(f"Days with data: {len(rows)}")

    if avg("steps") is not None:
        lines.append(f"Avg steps:           {int(avg('steps')):,}/day")
    if avg("active_minutes") is not None:
        lines.append(f"Avg active minutes:  {avg('active_minutes')} min/day")
    if avg("sleep_duration_hrs") is not None:
        total = avg("sleep_duration_hrs")
        h = int(total); m = round((total % 1) * 60)
        score = f"  avg score: {avg('sleep_score')}" if avg("sleep_score") else ""
        lines.append(f"Avg sleep:           {h}h {m}m{score}")
    if avg("hrv_weekly_avg") is not None:
        lines.append(f"Avg HRV:             {avg('hrv_weekly_avg')} ms")
    if avg("body_battery_high") is not None:
        lines.append(f"Avg body battery:    {avg('body_battery_low')}–{avg('body_battery_high')} (low–high)")
    if avg("stress_avg") is not None:
        lines.append(f"Avg stress:          {avg('stress_avg')}")
    if avg("heart_rate_resting") is not None:
        lines.append(f"Avg resting HR:      {avg('heart_rate_resting')} bpm")

    lines.append("\nDay-by-day:")
    for r in rows:
        parts = [r["date"]]
        if r.get("steps") is not None:
            parts.append(f"{r['steps']:,} steps")
        if r.get("sleep_duration_hrs") is not None:
            hrs = float(r["sleep_duration_hrs"]); h = int(hrs); m = round((hrs % 1) * 60)
            parts.append(f"sleep {h}h{m}m")
        if r.get("hrv_weekly_avg") is not None:
            parts.append(f"HRV {r['hrv_weekly_avg']}")
        if r.get("body_battery_high") is not None:
            parts.append(f"BB {r['body_battery_low']}–{r['body_battery_high']}")
        lines.append("  " + " | ".join(parts))

    return "\n".join(lines)


def get_recent_activities(n: int = 5) -> str:
    """Return the last n workouts from Garmin (live, not from Supabase)."""
    activities = fetch_recent_activities(n)
    if not activities:
        return "No recent activities found."

    lines = [f"Recent activities ({len(activities)}):"]
    for a in activities:
        parts = [f"• {a['date']}: {a['type'].replace('_', ' ').title()}"]
        if a.get("name"):
            parts[0] += f" — {a['name']}"
        detail = []
        if a.get("duration_min"):
            detail.append(f"{a['duration_min']} min")
        if a.get("distance_km"):
            detail.append(f"{a['distance_km']} km")
        if a.get("avg_hr"):
            detail.append(f"avg HR {a['avg_hr']} bpm")
        if a.get("calories"):
            detail.append(f"{a['calories']} kcal")
        if detail:
            parts.append(f"  {', '.join(detail)}")
        lines.append("\n".join(parts))

    return "\n".join(lines)
