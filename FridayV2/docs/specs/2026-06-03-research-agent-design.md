# FridayV2 — Research Agent Design

**Date:** 2026-06-03
**Status:** Approved

---

## Context

The Research Agent gives Friday the ability to search the web on demand. It uses Tavily's API (which includes a built-in AI-generated answer) — no additional Claude call needed for synthesis. Friday relays the summary to the user via Telegram. Saving findings to notes is optional and user-initiated ("save that").

---

## Architecture

```
You → Friday (Haiku)
           ├── notes_agent         (Google Drive notes)
           ├── productivity_agent  (Calendar / Tasks / Routines)
           └── research_agent      (NEW)
                    └── Tavily API (search + AI answer)
```

Friday passes the user's query directly to the research agent. The research agent calls Tavily with `include_answer=True`, formats the result (AI answer + numbered sources), and returns plain text to Friday. No internal Claude call in the research agent itself.

---

## Components

### New: `integrations/tavily.py`

Single function:

```
search_web(query: str, max_results: int = 5) -> str
```

- Calls Tavily `/search` endpoint with `include_answer=True`
- Returns formatted string:
  ```
  [AI answer paragraph]

  Sources:
  1. Title — url
  2. Title — url
  ...
  ```
- Uses `TAVILY_API_KEY` from settings
- Returns an error string (not raise) if the API call fails

### New: `agents/research_agent.py`

Single function:

```
run_research_agent(query: str) -> str
```

- Calls `search_web(query)` directly
- No internal Claude call — Tavily's built-in answer is sufficient
- Returns the formatted result to Friday

### Updated: `core/config.py`

Add field:
```python
TAVILY_API_KEY: str
```

### Updated: `.env.example`

Add line:
```
TAVILY_API_KEY=your-tavily-api-key
```

### Updated: `agents/friday.py`

- Import `run_research_agent`
- Add `research_agent` tool to `TOOLS` list
- Add entry to `_AGENT_FNS`
- Update `SYSTEM_PROMPT` to mention research capability

---

## Tool Definition (in friday.py)

```python
{
    "name": "research_agent",
    "description": (
        "Search the web for information on any topic. "
        "Use this when the user asks to research, look up, find out, or search for something online."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Clear search query, e.g. 'latest AI agent frameworks 2026'",
            }
        },
        "required": ["query"],
    },
}
```

---

## Data Flow Example

> User: "research the best productivity apps for 2026"

1. Friday calls `research_agent` with `query="best productivity apps 2026"`
2. `tavily.search_web()` hits Tavily API → returns AI answer + sources
3. `run_research_agent` returns formatted text to Friday
4. Friday sends summary to Telegram

> User: "save that"

5. Friday calls `notes_agent` with instruction to save the research findings as a note

---

## Environment

`TAVILY_API_KEY` is already added to `.env`. Add to `core/config.py` as a required string field.

---

## Implementation Steps

1. Add `TAVILY_API_KEY` to `core/config.py` and `.env.example`
2. Write `integrations/tavily.py`
3. Write `agents/research_agent.py`
4. Update `agents/friday.py` — add tool + update system prompt

---

## Verification

1. Send `"research the latest on large language models"` → Friday returns a summary with sources
2. Reply `"save that to my notes"` → note saved to Google Drive (Notes Agent still works)
3. Send `"what are my routines"` → Productivity Agent still works (no regression)
