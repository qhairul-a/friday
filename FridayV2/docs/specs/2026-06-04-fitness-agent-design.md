# FridayV2 — Fitness Agent Design

**Date:** 2026-06-04  
**Status:** Approved

---

## Context

The Fitness Agent gives Friday read access to Garmin Connect fitness metrics. It stores daily health snapshots in Supabase and provides on-demand analytics and coaching advice via Telegram. A proactive morning summary is pushed daily at a configurable time.

The `garminconnect` Python library (unofficial mobile SSO — no enterprise OAuth required) provides access to 130+ Garmin API methods. Historical snapshots stored in Supabase power trend analysis and lay the groundwork for dashboard visualisation in a later phase.

---

## Garmin Device

**Forerunner series** (running/multi-sport). Supports: steps, sleep stages, HRV, body battery, stress, VO2 max, resting HR, and GPS activity data.

---

## Architecture

```
You → Friday (Haiku)
           └── fitness_agent (NEW)
                    ├── integrations/garmin.py   — Garmin Connect API wrapper
                    └── integrations/fitness.py  — daily sync + analytics
```

---

## Supabase Table: `fitness_daily`

```sql
CREATE TABLE fitness_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date UNIQUE NOT NULL,
    steps integer,
    active_minutes integer,
    calories integer,
    resting_hr integer,
    sleep_duration_min integer,
    sleep_score integer,
    sleep_deep_min integer,
    sleep_light_min integer,
    sleep_rem_min integer,
    hrv_score integer,
    hrv_status text,
    body_battery_low integer,
    body_battery_high integer,
    stress_avg integer,
    vo2max real,
    synced_at timestamp with time zone DEFAULT now()
);
```

---

## Metrics Tracked (Forerunner series)

| Metric | Garmin API Method | Stored in Supabase |
|--------|-------------------|--------------------|
| Steps | `get_stats` | ✅ |
| Active minutes | `get_stats` | ✅ |
| Calories | `get_stats` | ✅ |
| Resting heart rate | `get_rhr_day` | ✅ |
| Sleep duration + score | `get_sleep_data` | ✅ |
| Sleep stages (deep/light/REM) | `get_sleep_data` | ✅ |
| HRV score + status | `get_hrv_data` | ✅ |
| Body Battery (low/high) | `get_body_battery` | ✅ |
| Average stress | `get_stress_data` | ✅ |
| VO2 max | `get_max_metrics` | ✅ |
| Recent activities (workouts) | `get_activities` | On-demand only |

---

## Components

### `integrations/garmin.py`

Low-level Garmin Connect API wrapper. Uses `garminconnect` library with token caching at `secrets/garmin_tokens.json`. All functions return empty dicts/None on API failure — partial outages don't break a full sync.

**Functions:**
- `_client() -> Garmin` — returns authenticated instance; loads cached tokens, auto-refreshes if expired
- `fetch_daily_stats(date: str) -> dict` — steps, active_minutes, calories
- `fetch_sleep(date: str) -> dict` — duration_min, score, deep_min, light_min, rem_min
- `fetch_hrv(date: str) -> dict` — hrv_score, hrv_status
- `fetch_body_battery(date: str) -> dict` — low, high
- `fetch_stress(date: str) -> dict` — stress_avg
- `fetch_resting_hr(date: str) -> dict` — resting_hr
- `fetch_vo2max() -> float | None` — latest VO2 max
- `fetch_recent_activities(n: int = 10) -> list[dict]` — type, duration_min, distance_km, avg_hr, calories

### `integrations/fitness.py`

High-level fitness operations. Imports from `garmin.py` and `supabase_client.py`.

**Functions:**
- `sync_today() -> str` — fetch all metrics for today from Garmin, upsert to `fitness_daily`; returns confirmation
- `get_daily_summary(date: str = None) -> str` — auto-syncs first if querying today (guarantees freshness), then reads from Supabase; past dates read directly
- `get_weekly_trends(n_days: int = 7) -> str` — reads last N days from Supabase (no Garmin API call); returns avg sleep, steps, HRV, stress, body battery
- `get_recent_activities(n: int = 5) -> str` — calls Garmin live, returns formatted workout list

**Data freshness:**
- Today queries: always sync from Garmin first (~8–9 API calls, safe within 200/day rate limit)
- Historical queries: read from Supabase only (0 Garmin API calls)

### `agents/fitness_agent.py`

Claude Haiku + 4 tools. Same pattern as all other sub-agents.

**Tools:**
- `sync_fitness_data` — explicitly pull today's metrics from Garmin into Supabase
- `get_today_summary` — today's health snapshot (auto-syncs before returning)
- `get_weekly_trends` — 7-day trend overview from Supabase history
- `get_recent_activities` — recent workout list from Garmin

**System prompt** instructs the agent to:
- Know today's date (dynamic `_system_prompt()` — injected at call time)
- Return raw metric data then add actionable coaching insights: training load, sleep quality, recovery state, rest day recommendations
- Reference Garmin-specific terminology: Body Battery, HRV status, Training Readiness

`run_fitness_agent(instruction: str) -> str`

### `agents/friday.py`

- Import `run_fitness_agent`
- Add `fitness_agent` tool to TOOLS
- Add `"fitness_agent": lambda args: run_fitness_agent(args["instruction"])` to `_AGENT_FNS`
- Update system prompt to mention fitness capabilities

### Daily Proactive Push — `integrations/telegram_bot.py`

Uses `python-telegram-bot`'s built-in `JobQueue` (APScheduler). Requires `[job-queue]` extra on the package.

- `send_daily_health_push(context)` — async; syncs today → calls `run_fitness_agent` with morning brief prompt → sends to `TELEGRAM_USER_ID`
- Registered in `build_app()` via `app.job_queue.run_daily(...)` at `settings.GARMIN_DAILY_PUSH_TIME`

### `core/config.py`

Add:
```python
# Garmin
GARMIN_EMAIL: str = ""
GARMIN_PASSWORD: str = ""
GARMIN_TOKEN_FILE: Path = BASE_DIR / "secrets" / "garmin_tokens.json"
GARMIN_DAILY_PUSH_TIME: str = "08:00"
```

### `scripts/setup_garmin.py`

One-time authentication script. Reads credentials from env, authenticates with Garmin SSO, saves token to `secrets/garmin_tokens.json`. Prompts for MFA code if enabled on the account. Run once manually; tokens auto-refresh thereafter.

### `.env` / `.env.example`

Add:
```
GARMIN_EMAIL=your-garmin-email
GARMIN_PASSWORD=your-garmin-password
GARMIN_DAILY_PUSH_TIME=08:00
```

### `requirements.txt`

Changes:
- `python-telegram-bot>=21.0` → `python-telegram-bot[job-queue]>=21.0`
- Add: `garminconnect>=0.3.0`

---

## Data Flow Example

> "How is my health today?"

1. Friday calls `fitness_agent` with: `"Get today's health summary"`
2. Fitness agent calls `get_today_summary`
3. `fitness.py` calls `sync_today()` → fetches all Garmin endpoints → upserts to Supabase
4. Reads row back, formats summary with all metrics
5. Fitness agent adds coaching insights (sleep quality, body battery advice, etc.)
6. Friday relays to Telegram

> Daily 8 AM push

1. Job fires at 08:00 SGT
2. `send_daily_health_push` calls `sync_today()` then `run_fitness_agent("Morning brief...")`
3. Fitness agent returns summary + insights
4. Sent directly to Telegram

---

## Implementation Steps

1. Create Supabase `fitness_daily` table
2. Add Garmin settings to `config.py`, `.env`, `.env.example`
3. Update `requirements.txt`
4. Write `scripts/setup_garmin.py`
5. Write `integrations/garmin.py`
6. Write `integrations/fitness.py`
7. Write `agents/fitness_agent.py`
8. Update `agents/friday.py`
9. Update `integrations/telegram_bot.py` with daily push

**Manual step (once):** Run `python scripts/setup_garmin.py` after filling in `GARMIN_EMAIL` and `GARMIN_PASSWORD` in `.env`.

---

## Verification

1. Run `python scripts/setup_garmin.py` → `secrets/garmin_tokens.json` created
2. Python REPL: `from integrations.garmin import fetch_daily_stats; print(fetch_daily_stats("2026-06-04"))` → step data returned
3. Python REPL: `from integrations.fitness import sync_today; print(sync_today())` → row in Supabase `fitness_daily`
4. Telegram: `"how am I doing health-wise today?"` → metrics + coaching
5. Telegram: `"give me my fitness trends for the past week"` → 7-day summary
6. Wait for 8 AM push or manually trigger → morning health brief arrives
7. Test other agents (notes, finance) → no regression
