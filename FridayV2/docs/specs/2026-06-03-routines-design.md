# FridayV2 — Routines Design

**Date:** 2026-06-03
**Status:** Approved

---

## Context

Routines are recurring daily habits or tasks (e.g. "Morning workout at 7am on weekdays"). Friday can manage them via Telegram. The dashboard (future phase) will display them and allow manual check/uncheck. Completion status resets automatically each day.

---

## Supabase Table: `routines`

```sql
create table routines (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  scheduled_time time,
  days_of_week   text[],
  is_done        boolean not null default false,
  done_date      date,
  created_at     timestamptz not null default now()
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Auto-generated primary key |
| `name` | text | e.g. "Morning workout" |
| `scheduled_time` | time | Nullable — e.g. `07:00:00` |
| `days_of_week` | text[] | Nullable = every day. Values: `"mon"`, `"tue"`, `"wed"`, `"thu"`, `"fri"`, `"sat"`, `"sun"` |
| `is_done` | boolean | Default false |
| `done_date` | date | Date when last marked done — used to detect stale completions |
| `created_at` | timestamptz | Auto |

**Daily reset logic:** On any read, rows where `done_date < today` are treated as incomplete. The `is_done` field is lazily reset to `false` and `done_date` cleared in those rows at read time.

---

## Architecture

Routines slot into the existing Productivity Agent. No new agent is needed.

```
User → Friday (Haiku)
           └── tool: productivity_agent
                        ├── Google Calendar tools  (Phase 2)
                        ├── Google Tasks tools     (Phase 2)
                        └── Routines tools         (Phase 2.5 — this spec)
```

---

## Components

### New: `integrations/routines.py`

Supabase CRUD wrapper. Functions:

- `list_routines() -> str` — lists all routines with today's done status; lazily resets stale completions
- `add_routine(name, scheduled_time=None, days_of_week=None) -> str` — inserts a new row
- `edit_routine(query, name=None, scheduled_time=None, days_of_week=None) -> str` — updates by partial name match
- `delete_routine(query) -> str` — deletes by partial name match
- `mark_routine_done(query) -> str` — sets `is_done=true`, `done_date=today`
- `mark_routine_undone(query) -> str` — sets `is_done=false`, `done_date=null`

All match functions return an error string (not raise) for 0 matches and >1 matches.

### New: `core/supabase_client.py`

Move the shared Supabase client here from wherever it currently lives (or create it if not present). Provides a `get_supabase()` function returning an initialized `Client`. Used by `routines.py`.

### Updated: `agents/productivity_agent.py`

Add 6 new tool definitions to `TOOLS` and 6 new entries to `_TOOL_FNS`:

| Tool name | Maps to |
|---|---|
| `list_routines` | `list_routines()` |
| `add_routine` | `add_routine(name, scheduled_time, days_of_week)` |
| `edit_routine` | `edit_routine(query, name, scheduled_time, days_of_week)` |
| `delete_routine` | `delete_routine(query)` |
| `mark_routine_done` | `mark_routine_done(query)` |
| `mark_routine_undone` | `mark_routine_undone(query)` |

---

## Supabase Setup (one-time SQL migration)

Run this in the Supabase dashboard SQL editor:

```sql
create table routines (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  scheduled_time time,
  days_of_week   text[],
  is_done        boolean not null default false,
  done_date      date,
  created_at     timestamptz not null default now()
);
```

---

## Data Flow Example

> User (Telegram): "Add a morning workout routine at 7am on weekdays"

1. Friday routes to `productivity_agent` with: `"Add a routine called 'Morning workout' at 07:00 on mon, tue, wed, thu, fri"`
2. Productivity Agent calls `add_routine` tool
3. `routines.py` inserts into Supabase
4. Returns: `"Added routine: Morning workout (07:00, Mon–Fri)"`
5. Friday replies: `"Done — morning workout added to your routines at 7am on weekdays."`

---

## Implementation Steps

1. Run SQL migration in Supabase dashboard
2. Install supabase: `pip install supabase==2.9.1` (pinned to avoid a pyiceberg C-extension build failure on Windows with Python 3.14); add `supabase==2.9.1` to `requirements.txt`
3. Verify `core/supabase_client.py` exists and exports `get_supabase()`
4. Write `integrations/routines.py`
5. Update `agents/productivity_agent.py` — add routine tools

---

## Verification

1. Send `"add a routine: morning workout at 7am on weekdays"` → routine appears in Supabase `routines` table
2. Send `"what are my routines"` → Friday lists all routines
3. Send `"mark morning workout as done"` → `is_done=true`, `done_date=today` in Supabase
4. Send `"delete morning workout routine"` → row removed from Supabase
5. Send `"what's on my calendar this week"` → Calendar still works (no regression)
