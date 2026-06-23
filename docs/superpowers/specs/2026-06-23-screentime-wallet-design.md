# Screentime Wallet — Design Spec
**Date:** 2026-06-23  
**Status:** Approved

---

## Overview

A standalone web app for two children (Qasim & Muadz) to track reading time and convert it into earned screen time. Every minute of reading earns one minute of screen time. Unused screen time rolls over. The parent gets a separate PIN-protected view with session records and analytics.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (TypeScript, Tailwind CSS) — new standalone project |
| Database | Supabase — same project as friday-dashboard, new tables |
| Charts | Recharts |
| TTS | Web Speech API (browser-native, no cost) |
| Hosting | Vercel — new project (`screentime-wallet`) |
| Parent PIN | `PARENT_PIN` env var in Vercel — not stored in DB |

Friday dashboard can optionally query the same Supabase tables to surface parent analytics.

---

## Routes

| Route | Who | Description |
|---|---|---|
| `/` | Kids | "Who are you?" landing — Qasim / Muadz cards + small Parent link |
| `/child/[name]` | Kids | Reading timer + balance display + screen time countdown |
| `/parent` | Parent | PIN entry → records table + analytics (PIN checked per session) |

---

## Child View — States & Rules

### Layout (tablet portrait, large tap targets)
- Top: greeting ("Hey, Qasim 👋") + current balance in minutes
- Middle card: Reading Timer (start/stop)
- Bottom card: Screen Time (start/stop countdown)

### State machine

**Idle (has balance)**
- Start Reading → enabled
- Start Screen Time → enabled

**Reading in progress**
- Timer counts up, showing `MM:SS` and `+N min earned so far`
- Stop Reading → saves session, adds duration to balance
- Start Screen Time → disabled (mutually exclusive)

**Screen time counting down**
- Countdown from current balance
- Stop Screen Time → saves session, unused minutes remain in balance (rollover)
- Start Reading → disabled (mutually exclusive)

**Zero balance**
- Start Screen Time → greyed out, non-interactive
- Start Reading → always available

### Time's Up behaviour
When the countdown reaches zero during an active screen time session:
1. Full-screen "Time's Up!" alert overlay
2. Web Speech API fires: `"[Child name], your time is up! Try reading more to earn more screen time"`
3. Session is saved with `duration_used_minutes` = full balance at start
4. Balance is set to 0

---

## Parent View

### PIN Gate
- Simple PIN entry form on `/parent`
- PIN submitted to a Next.js API route (`/api/parent-auth`) which checks it server-side against `PARENT_PIN` env var and sets a signed `parent_session` cookie on success
- Cookie keeps parent authenticated for the browser session (no re-entry on refresh); cookie is HttpOnly and SameSite=Strict

### Tab 1 — Records
Table of all reading sessions:
| Column | Value |
|---|---|
| Date | Formatted date |
| Child | Colour-coded badge (Qasim purple / Muadz green) |
| Reading Start | Time HH:MM AM/PM |
| Reading End | Time HH:MM AM/PM |
| Earned | `+N min` |

- Filterable by child
- Sorted newest first
- Paginated (20 rows per page)

### Tab 2 — Analytics
**Stat cards (top row):**
- Utilization % = `SUM(screentime_used) / SUM(reading_earned) × 100` (combined)
- Total reading this week (combined hours)
- Qasim avg reading per day (minutes)
- Muadz avg reading per day (minutes)

**Charts:**
- Bar chart: reading minutes per day for the current week (per child, grouped bars)
- Bar chart: screen time utilization % per week (last 4 weeks)

---

## Data Model (Supabase)

### `reading_sessions`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
child_name      text NOT NULL  -- 'qasim' | 'muadz'
started_at      timestamptz NOT NULL
ended_at        timestamptz NOT NULL
duration_minutes numeric NOT NULL
created_at      timestamptz DEFAULT now()
```

### `screentime_sessions`
```sql
id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
child_name            text NOT NULL
started_at            timestamptz NOT NULL
ended_at              timestamptz          -- null while session is active
duration_used_minutes numeric              -- set on stop or zero-out
created_at            timestamptz DEFAULT now()
```

### `screentime_balance`
```sql
child_name      text PRIMARY KEY  -- 'qasim' | 'muadz'
balance_minutes numeric NOT NULL DEFAULT 0
updated_at      timestamptz DEFAULT now()
```

Seed with two rows on setup: `('qasim', 0)` and `('muadz', 0)`.

---

## Key Behaviours

- **Rollover:** Unused screen time stays in balance. Balance persists across days.
- **Mutual exclusion:** Reading and screen time sessions cannot run simultaneously per child.
- **Zero guard:** Screen time cannot start if balance is 0.
- **TTS:** Uses `window.speechSynthesis`. Fires only on client (no SSR).
- **Active session guard:** If a child closes the browser mid-session, the app detects an open session (no `ended_at`) on next load and prompts "You had a session in progress — did you finish?". Answering Yes ends the session using `now()` as `ended_at` and credits/deducts accordingly. Answering No resumes the live timer from `started_at`.
- **No auth for kids:** Home screen is the only gate. Parent PIN protects `/parent` only.

---

## Friday Dashboard Integration

The friday-dashboard can query Supabase directly using the shared project credentials:
- `reading_sessions` for reading analytics
- `screentime_sessions` for utilization data
- `screentime_balance` for live balances

No API bridge needed — same Supabase project.

---

## Out of Scope

- Push notifications / device lock when time runs out
- Multiple parent accounts or admin management
- Historical balance adjustments by parent
- Gamification beyond the core earn/spend mechanic
