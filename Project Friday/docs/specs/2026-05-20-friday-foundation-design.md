# Project Friday — Foundation Layer Design

**Date:** 2026-05-20  
**Status:** Approved  

---

## Overview

Friday is a personal AI assistant inspired by Jarvis from Iron Man. This document covers the foundation layer: personal profile storage, onboarding dashboard, smart capture via Telegram, and an advisory engine powered by Claude API.

---

## Tech Stack

| Component | Tool | Cost |
|---|---|---|
| AI Brain | Claude API (claude-sonnet-4-6) | Existing subscription |
| Profile Storage | Supabase | Free tier |
| Speech-to-Text | Whisper (local) | Free |
| Text-to-Speech | Google Cloud TTS | Free tier (1M chars/month) |
| Voice/Note Capture | Telegram Bot | Free |
| Finance Data | Google Sheet (existing) + Google Drive MCP | Free |
| Dashboard UI | Next.js + TypeScript + Tailwind | Free |
| Python Backend | Python 3.11+ | Free |

**Subscription footprint:** Claude API only.

---

## Project Structure

```
Project Friday/
├── friday-core/                  # Python — AI brain
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── profile/
│   │   ├── __init__.py
│   │   ├── schema.py             # Profile dataclass
│   │   ├── storage.py            # Supabase read/write
│   │   └── updater.py            # Extract profile updates from conversations
│   ├── voice/
│   │   ├── __init__.py
│   │   ├── stt.py                # Whisper speech-to-text
│   │   └── tts.py                # Google Cloud TTS
│   ├── brain/
│   │   ├── __init__.py
│   │   ├── claude.py             # Claude API with prompt caching
│   │   └── router.py             # Intent detection + routing
│   └── integrations/
│       ├── __init__.py
│       ├── telegram_bot.py       # Telegram bot
│       └── sheets.py             # Google Sheet read/write
│
├── friday-dashboard/             # Next.js — profile UI
│   └── app/
│       ├── onboarding/
│       ├── profile/
│       └── notes/
│
└── docs/
    └── specs/
        └── 2026-05-20-friday-foundation-design.md  ← this file
```

---

## Profile Schema

Stored in Supabase `profiles` table as a JSON column. One row per user.

```json
{
  "identity": {
    "name": "",
    "preferred_name": "",
    "age": null,
    "timezone": "",
    "location": "",
    "language": "en"
  },
  "daily_routine": {
    "wake_time": "",
    "sleep_time": "",
    "work_hours": "",
    "work_days": [],
    "habits": []
  },
  "health": {
    "dietary_preferences": [],
    "dietary_restrictions": [],
    "fitness_goals": [],
    "notes": ""
  },
  "work_and_projects": {
    "role": "",
    "active_projects": [
      { "name": "", "status": "", "deadline": "", "notes": "" }
    ],
    "skills": [],
    "work_style": ""
  },
  "goals": {
    "short_term": [],
    "long_term": []
  },
  "finance": {
    "google_sheet_id": "",
    "monthly_income": null,
    "currency": "MYR",
    "budget_allocations": {
      "food": null,
      "transport": null,
      "bills": null,
      "entertainment": null,
      "savings": null,
      "other": null
    },
    "savings_goals": []
  },
  "notes": [],
  "preferences": {
    "communication_style": "casual",
    "verbosity": "concise",
    "hobbies": [],
    "entertainment": []
  }
}
```

**Finance note:** Daily expenses live in the user's existing Google Sheet — NOT in Supabase. `google_sheet_id` is a pointer only. Friday reads the live sheet via Google Drive MCP on demand.

---

## Feature 1: Onboarding Form (Next.js Dashboard)

A sectioned web form the user fills in once at `http://localhost:3000/onboarding`.

**Sections:** Identity → Daily Routine → Health → Work & Projects → Goals → Finance → Preferences

- Each section saves to Supabase independently
- Unfilled sections are treated as "unknown" — Friday asks naturally in conversation
- Finance section: user pastes Google Sheet URL, system extracts the sheet ID
- Notes section (read-only): live feed of captured items + routing status

---

## Feature 2: Smart Capture via Telegram

The primary way the user feeds Friday information during the day.

### Pipeline

```
User sends voice/text note on Telegram
  → telegram_bot.py receives it
  → If voice: stt.py transcribes with Whisper
  → router.py calls Claude to determine intent:
      - Expense entry?      → sheets.py appends row to Google Sheet
      - Project update?     → storage.py updates work_and_projects
      - Health update?      → storage.py updates health
      - Goal update?        → storage.py updates goals
      - General idea/note?  → storage.py appends to notes[]
      - Incomplete info?    → Friday replies via Telegram asking follow-up
  → Dashboard notes feed updates with capture + routing status
```

### Routing Examples

| User says | Friday does |
|---|---|
| "Expense log, spent $7 at the grocery store" | Appends row to Google Sheet: [date, 7, food, grocery store] |
| "I need to start working on a new project" | Replies: "Got it. What's the project about, and do you have a deadline?" |
| "My goal this month is to save RM500" | Updates goals.short_term |
| "I've been trying to cut down on coffee" | Updates health.notes |

---

## Feature 3: Advisory Engine

### How every response is built

```python
system_prompt = f"""
You are Friday, a personal AI assistant for {profile['identity']['preferred_name']}.

Here is everything you know about them:
{profile_json}

Today is {today}. Be proactive, concise, and helpful.
"""
```

The profile is the system prompt. Prompt caching is applied — the profile block is marked as a cache breakpoint to reduce API cost on repeated conversations.

### Three advisory modes

1. **Morning briefing** — scheduled daily (APScheduler), sent via Telegram at user's configured time. Covers: upcoming deadlines, budget status vs allocations, goal check-in.

2. **On-demand** — user asks Friday a question. She answers with full profile context + live Google Sheet data if finance-related.

3. **Passive nudge** — after a capture event triggers a threshold (e.g., budget category 90% spent), Friday flags it at next check-in.

---

## Supabase Schema

```sql
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table capture_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  raw_text text not null,
  routed_to text,
  status text default 'captured',
  created_at timestamptz default now()
);
```

---

## Verification Checklist

- [ ] Fill onboarding form → profile appears correctly in Supabase
- [ ] Send Telegram text: "Expense log, spent $7 at grocery" → new row in Google Sheet
- [ ] Send Telegram text: "I need to start a new project" → Friday replies asking for details → after answering, project appears in profile
- [ ] Ask Friday: "How are my finances this month?" → reads Google Sheet, gives breakdown vs budget allocations
- [ ] Dashboard Notes feed shows all captured items with routing status
- [ ] Morning briefing arrives at scheduled time via Telegram
