# Research Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Research Agent to FridayV2 that searches the web via Tavily and returns an AI-generated summary with sources.

**Architecture:** `integrations/tavily.py` wraps the Tavily API. `agents/research_agent.py` exposes a single `run_research_agent(query)` function that calls Tavily directly — no internal Claude call needed since Tavily's `include_answer=True` returns an AI-generated answer. Friday registers this as a tool alongside notes_agent and productivity_agent.

**Tech Stack:** Python, `tavily-python` SDK, existing `core/config.py` settings pattern, existing `agents/friday.py` tool registration pattern.

---

## File Map

| Action | File |
|---|---|
| Modify | `backend/requirements.txt` — add `tavily-python>=0.3.0` |
| Modify | `backend/core/config.py` — add `TAVILY_API_KEY: str` field |
| Modify | `backend/.env.example` — add `TAVILY_API_KEY` line |
| Create | `backend/integrations/tavily.py` — Tavily API wrapper |
| Create | `backend/agents/research_agent.py` — `run_research_agent(query)` |
| Modify | `backend/agents/friday.py` — add import, tool, _AGENT_FNS entry, update system prompt |

---

## Task 1: Install tavily-python + Update Config

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/core/config.py`
- Modify: `backend/.env.example`

- [ ] **Step 1: Install the Tavily SDK**

Run from `backend/`:
```
pip install tavily-python
```
Expected output ends with: `Successfully installed tavily-python-...`

- [ ] **Step 2: Add to `backend/requirements.txt`**

Add this line after the `requests` line:
```
tavily-python>=0.3.0
```

- [ ] **Step 3: Add `TAVILY_API_KEY` to `backend/core/config.py`**

Read the file first. In the `Settings` class, add this field after `DEEPGRAM_API_KEY`:
```python
TAVILY_API_KEY: str
```

- [ ] **Step 4: Add to `backend/.env.example`**

Add this line after the `DEEPGRAM_API_KEY` line:
```
TAVILY_API_KEY=your-tavily-api-key
```

- [ ] **Step 5: Verify config loads**

Run from `backend/`:
```
python -c "from core.config import settings; print('TAVILY_API_KEY OK:', bool(settings.TAVILY_API_KEY))"
```
Expected: `TAVILY_API_KEY OK: True`

---

## Task 2: Write `integrations/tavily.py`

**Files:**
- Create: `backend/integrations/tavily.py`

- [ ] **Step 1: Create `backend/integrations/tavily.py`**

```python
from tavily import TavilyClient

from core.config import settings


def search_web(query: str, max_results: int = 5) -> str:
    """Search the web using Tavily and return a formatted summary with sources."""
    try:
        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        response = client.search(query, include_answer=True, max_results=max_results)

        answer = response.get("answer", "")
        results = response.get("results", [])

        if not answer and not results:
            return f"No results found for '{query}'."

        lines = []
        if answer:
            lines.append(answer)

        if results:
            lines.append("\nSources:")
            for i, r in enumerate(results, 1):
                title = r.get("title", "Untitled")
                url = r.get("url", "")
                lines.append(f"{i}. {title} — {url}")

        return "\n".join(lines)
    except Exception as e:
        return f"Search failed: {e}"
```

- [ ] **Step 2: Verify the module imports cleanly**

Run from `backend/`:
```
python -c "from integrations.tavily import search_web; print('tavily OK')"
```
Expected: `tavily OK`

---

## Task 3: Write `agents/research_agent.py`

**Files:**
- Create: `backend/agents/research_agent.py`

- [ ] **Step 1: Create `backend/agents/research_agent.py`**

```python
from integrations.tavily import search_web


def run_research_agent(query: str) -> str:
    """Search the web for the given query and return a formatted summary with sources."""
    return search_web(query)
```

- [ ] **Step 2: Verify the module imports cleanly**

Run from `backend/`:
```
python -c "from agents.research_agent import run_research_agent; print('research_agent OK')"
```
Expected: `research_agent OK`

---

## Task 4: Update `agents/friday.py`

**Files:**
- Modify: `backend/agents/friday.py`

- [ ] **Step 1: Add the import**

Read the file first. After the existing `from agents.productivity_agent import run_productivity_agent` line, add:
```python
from agents.research_agent import run_research_agent
```

- [ ] **Step 2: Update SYSTEM_PROMPT**

Replace the `productivity_agent` bullet line with an updated version that also mentions research, and add a research bullet. The full updated SYSTEM_PROMPT should be:

```python
SYSTEM_PROMPT = """\
You are Friday, a personal AI assistant for Qhairul. You are warm, efficient, and direct — you get things done without unnecessary filler.

You have access to sub-agents that handle specialised tasks:
- **notes_agent**: Save, search, read, edit, or delete notes in Google Drive.
- **productivity_agent**: View, create, find, or delete Google Calendar events. Add, complete, update, or delete Google Tasks. Add, list, edit, delete, and mark done/undone daily routines (recurring habits like "morning workout").
- **research_agent**: Search the web for information on any topic. Use when the user asks to research, look up, find out about, or search for something online.

When the user asks you to do something that a sub-agent handles, delegate to it immediately using the tool. After the sub-agent returns a result, summarise it naturally in 1-2 sentences.

For questions or conversation that don't require a sub-agent, answer directly.

Keep responses concise. Never narrate what you're about to do — just do it and report back.
"""
```

- [ ] **Step 3: Add the research_agent tool to TOOLS**

Append this entry to the end of the `TOOLS` list (before the closing `]`):
```python
    {
        "name": "research_agent",
        "description": (
            "Search the web for information on any topic. "
            "Use this when the user asks to research, look up, find out about, or search for something online."
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
    },
```

- [ ] **Step 4: Add the entry to `_AGENT_FNS`**

Append this entry to the end of the `_AGENT_FNS` dict (before the closing `}`):
```python
    "research_agent": lambda args: run_research_agent(args["query"]),
```

- [ ] **Step 5: Verify friday.py imports cleanly**

Run from `backend/`:
```
python -c "from agents.friday import run_friday; print('friday OK')"
```
Expected: `friday OK`

---

## Task 5: End-to-End Verification

This task requires the user to interact with Telegram. Instruct them clearly.

- [ ] **Step 1: Start Friday**

Run from `backend/`:
```
python main.py
```
Expected: `Friday is online. Listening on Telegram...`

- [ ] **Step 2: Test — basic web search**

Send in Telegram: `research the latest developments in AI agents`

Expected: Friday returns a paragraph summary followed by numbered sources with titles and URLs.

- [ ] **Step 3: Test — save findings**

Immediately after the research reply, send: `save that to my notes`

Expected: Friday calls the notes_agent and confirms the research was saved to Google Drive.

- [ ] **Step 4: Regression — notes still work**

Send: `save a note: research agent is working`

Expected: Friday saves the note (Notes Agent unaffected).

- [ ] **Step 5: Regression — routines still work**

Send: `what are my routines`

Expected: Friday lists routines (Productivity Agent unaffected).
