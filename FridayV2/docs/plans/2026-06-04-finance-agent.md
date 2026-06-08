# Finance Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Finance Agent that reads/writes two Google Sheets (fixed + variable expenses) and computes 8 financial analytics entirely in Python.

**Architecture:** `integrations/gsheets.py` handles raw Sheets API CRUD. `integrations/finance.py` builds on it with domain operations and analytics. `agents/finance_agent.py` wraps everything as Claude tools. Friday gains a `finance_agent` tool alongside the existing three agents.

**Tech Stack:** Python, Google Sheets API v4, Google Drive API v3 (for sheet discovery), existing OAuth token (new `spreadsheets` scope added), Anthropic SDK (Haiku).

---

## File Map

| Action | File |
|---|---|
| Modify | `backend/scripts/authorize_google.py` — add spreadsheets scope |
| Modify | `backend/core/config.py` — add FINANCE_FOLDER_ID, CURRENCY |
| Modify | `backend/.env` — add FINANCE_FOLDER_ID, CURRENCY values |
| Modify | `backend/.env.example` — add FINANCE_FOLDER_ID, CURRENCY |
| Create | `backend/integrations/gsheets.py` — Sheets API CRUD |
| Create | `backend/integrations/finance.py` — domain operations + analytics |
| Create | `backend/agents/finance_agent.py` — Claude tool_use agent |
| Modify | `backend/agents/friday.py` — add finance_agent tool |

---

## Task 1: OAuth Scope + Config

**Files:**
- Modify: `backend/scripts/authorize_google.py`
- Modify: `backend/core/config.py`
- Modify: `backend/.env`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add spreadsheets scope to `backend/scripts/authorize_google.py`**

Read the file. Replace the SCOPES list with:
```python
SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/spreadsheets",
]
```

- [ ] **Step 2: Add fields to `backend/core/config.py`**

Read the file. In the `Settings` class, after `TAVILY_API_KEY: str`, add:
```python
# Finance
FINANCE_FOLDER_ID: str = "1Ei0A9dlWroT_V5WAzjE9IjPzHhM0c7Zm"
CURRENCY: str = "SGD"
```

- [ ] **Step 3: Add to `backend/.env`**

Read the file. Add these two lines (with the actual values):
```
FINANCE_FOLDER_ID=1Ei0A9dlWroT_V5WAzjE9IjPzHhM0c7Zm
CURRENCY=SGD
```

- [ ] **Step 4: Add to `backend/.env.example`**

Read the file. Add after the TAVILY_API_KEY line:
```
# Finance
FINANCE_FOLDER_ID=your-finance-folder-id
CURRENCY=SGD
```

- [ ] **Step 5: Delete old token and re-run auth**

Delete the old token:
```
del secrets\gdrive_token.json
```

Re-run auth (browser will open — sign in as qhairul.asmai@gmail.com and grant all permissions including Sheets):
```
python scripts/authorize_google.py
```

Expected: `Authorization successful. Token saved to: ...secrets\gdrive_token.json`

- [ ] **Step 6: Verify config loads**

```
python -c "from core.config import settings; print('FINANCE_FOLDER_ID:', settings.FINANCE_FOLDER_ID[:10])"
```
Expected: `FINANCE_FOLDER_ID: 1Ei0A9dlW`

---

## Task 2: Write `integrations/gsheets.py`

**Files:**
- Create: `backend/integrations/gsheets.py`

- [ ] **Step 1: Create `backend/integrations/gsheets.py`**

```python
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/spreadsheets",
]

_sheet_id_cache: dict[str, str] = {}


def _get_creds() -> Credentials:
    if not settings.GDRIVE_TOKEN_FILE.exists():
        raise RuntimeError("Google not authorized. Run: python scripts/authorize_google.py")
    creds = Credentials.from_authorized_user_file(str(settings.GDRIVE_TOKEN_FILE), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(settings.GDRIVE_TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return creds


def _sheets():
    return build("sheets", "v4", credentials=_get_creds())


def _drive():
    return build("drive", "v3", credentials=_get_creds())


def _discover_sheet_id(name: str) -> str:
    if name in _sheet_id_cache:
        return _sheet_id_cache[name]
    safe = name.replace("'", "\\'")
    result = _drive().files().list(
        q=f"name='{safe}' and '{settings.FINANCE_FOLDER_ID}' in parents and trashed=false",
        fields="files(id, name)",
        pageSize=5,
    ).execute()
    files = result.get("files", [])
    if not files:
        raise RuntimeError(f"Sheet '{name}' not found in Finance folder.")
    _sheet_id_cache[name] = files[0]["id"]
    return _sheet_id_cache[name]


def get_all_rows(spreadsheet_id: str) -> list[dict]:
    """Return all data rows as list of dicts. Row 1 is headers."""
    result = _sheets().spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range="A:Z",
    ).execute()
    values = result.get("values", [])
    if len(values) < 2:
        return []
    headers = values[0]
    rows = []
    for row in values[1:]:
        while len(row) < len(headers):
            row.append("")
        rows.append(dict(zip(headers, row)))
    return rows


def append_row(spreadsheet_id: str, values: list) -> None:
    _sheets().spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range="A:A",
        valueInputOption="USER_ENTERED",
        body={"values": [values]},
    ).execute()


def update_row(spreadsheet_id: str, row_index: int, values: list) -> None:
    """Update row at 0-based data index (0 = first data row below header = sheet row 2)."""
    sheet_row = row_index + 2
    _sheets().spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f"A{sheet_row}:Z{sheet_row}",
        valueInputOption="USER_ENTERED",
        body={"values": [values]},
    ).execute()


def delete_row(spreadsheet_id: str, row_index: int) -> None:
    """Delete row at 0-based data index."""
    meta = _sheets().spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_id = meta["sheets"][0]["properties"]["sheetId"]
    start = row_index + 1  # +1 to skip header (0-indexed: header=0, first data=1)
    _sheets().spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={
            "requests": [{
                "deleteDimension": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "ROWS",
                        "startIndex": start,
                        "endIndex": start + 1,
                    }
                }
            }]
        },
    ).execute()
```

- [ ] **Step 2: Verify the module imports cleanly**

```
python -c "from integrations.gsheets import get_all_rows; print('gsheets OK')"
```
Expected: `gsheets OK`

---

## Task 3: Write `integrations/finance.py`

**Files:**
- Create: `backend/integrations/finance.py`

- [ ] **Step 1: Create `backend/integrations/finance.py`**

```python
from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from core.config import settings
from integrations.gsheets import (
    _discover_sheet_id,
    get_all_rows,
    append_row,
    update_row,
    delete_row,
)

FIXED_SHEET = "master_fixed expenses"
VARIABLE_SHEET = "master_variable expenses"


def _current_month() -> str:
    return datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m")


def _fixed_id() -> str:
    return _discover_sheet_id(FIXED_SHEET)


def _variable_id() -> str:
    return _discover_sheet_id(VARIABLE_SHEET)


def _find_fixed(query: str) -> list[tuple[int, dict]]:
    rows = get_all_rows(_fixed_id())
    return [(i, r) for i, r in enumerate(rows) if query.lower() in r.get("Item", "").lower()]


def _find_variable(query: str) -> list[tuple[int, dict]]:
    rows = get_all_rows(_variable_id())
    return [(i, r) for i, r in enumerate(rows) if query.lower() in r.get("description", "").lower()]


# ─── Fixed expenses ───────────────────────────────────────────────────────────

def list_fixed_expenses() -> str:
    rows = get_all_rows(_fixed_id())
    if not rows:
        return "No fixed expenses found."
    total = sum(float(r.get("Cost", 0) or 0) for r in rows)
    cur = settings.CURRENCY
    lines = [f"Fixed expenses ({len(rows)} items):"]
    for r in rows:
        note = f" — {r['Comments']}" if r.get("Comments") else ""
        lines.append(f"• {r['Item']}: {cur} {float(r.get('Cost', 0)):.2f}{note}")
    lines.append(f"\nTotal: {cur} {total:.2f}/month")
    return "\n".join(lines)


def add_fixed_expense(item: str, cost: float, comments: str = "") -> str:
    append_row(_fixed_id(), [item, str(cost), comments])
    return f"Added fixed expense: {item} ({settings.CURRENCY} {cost:.2f}/month)"


def edit_fixed_expense(query: str, cost: float = None, comments: str = None) -> str:
    matches = _find_fixed(query)
    if not matches:
        return f"No fixed expense found matching '{query}'."
    if len(matches) > 1:
        names = ", ".join(r["Item"] for _, r in matches[:3])
        return f"Multiple fixed expenses match '{query}': {names}. Be more specific."
    idx, row = matches[0]
    update_row(_fixed_id(), idx, [
        row["Item"],
        str(cost) if cost is not None else row.get("Cost", ""),
        comments if comments is not None else row.get("Comments", ""),
    ])
    return f"Updated fixed expense: {row['Item']}"


def delete_fixed_expense(query: str) -> str:
    matches = _find_fixed(query)
    if not matches:
        return f"No fixed expense found matching '{query}'."
    if len(matches) > 1:
        names = ", ".join(r["Item"] for _, r in matches[:3])
        return f"Multiple fixed expenses match '{query}': {names}. Be more specific."
    idx, row = matches[0]
    delete_row(_fixed_id(), idx)
    return f"Deleted fixed expense: {row['Item']}"


# ─── Variable expenses ────────────────────────────────────────────────────────

def list_variable_expenses(month: str = None) -> str:
    month = month or _current_month()
    rows = [r for r in get_all_rows(_variable_id()) if r.get("date", "").startswith(month)]
    if not rows:
        return f"No variable expenses found for {month}."
    total = sum(float(r.get("amount", 0) or 0) for r in rows)
    cur = settings.CURRENCY
    lines = [f"Variable expenses for {month} ({len(rows)} entries):"]
    for r in rows:
        lines.append(f"• {r.get('date')}: [{r.get('category')}] {r.get('description')} — {cur} {float(r.get('amount', 0)):.2f}")
    lines.append(f"\nTotal: {cur} {total:.2f}")
    return "\n".join(lines)


def add_variable_expense(date: str, category: str, description: str, amount: float) -> str:
    append_row(_variable_id(), [date, category, description, "Friday", str(amount)])
    return f"Added: {description} — {settings.CURRENCY} {amount:.2f} on {date}"


def edit_variable_expense(
    query: str,
    date: str = None,
    category: str = None,
    description: str = None,
    amount: float = None,
) -> str:
    matches = _find_variable(query)
    if not matches:
        return f"No variable expense found matching '{query}'."
    if len(matches) > 1:
        descs = ", ".join(r.get("description", "") for _, r in matches[:3])
        return f"Multiple expenses match '{query}': {descs}. Be more specific."
    idx, row = matches[0]
    update_row(_variable_id(), idx, [
        date or row.get("date", ""),
        category or row.get("category", ""),
        description or row.get("description", ""),
        row.get("recorder", "Friday"),
        str(amount) if amount is not None else row.get("amount", ""),
    ])
    return f"Updated variable expense: {row.get('description', '')}"


def delete_variable_expense(query: str) -> str:
    matches = _find_variable(query)
    if not matches:
        return f"No variable expense found matching '{query}'."
    if len(matches) > 1:
        descs = ", ".join(r.get("description", "") for _, r in matches[:3])
        return f"Multiple expenses match '{query}': {descs}. Be more specific."
    idx, row = matches[0]
    delete_row(_variable_id(), idx)
    return f"Deleted variable expense: {row.get('description', '')}"


# ─── Analytics ────────────────────────────────────────────────────────────────

def get_financial_summary(month: str = None) -> str:
    month = month or _current_month()
    cur = settings.CURRENCY

    fixed_rows = get_all_rows(_fixed_id())
    fixed_total = sum(float(r.get("Cost", 0) or 0) for r in fixed_rows)

    all_variable = get_all_rows(_variable_id())
    month_rows = [r for r in all_variable if r.get("date", "").startswith(month)]

    # Category totals and percentages
    cat_totals: dict[str, float] = defaultdict(float)
    for r in month_rows:
        try:
            cat_totals[r.get("category", "Other")] += float(r.get("amount", 0) or 0)
        except ValueError:
            pass
    variable_total = sum(cat_totals.values())
    cat_pct = {c: v / variable_total * 100 for c, v in cat_totals.items()} if variable_total else {}

    # Month-over-month totals and counts (last 6 months)
    monthly_totals: dict[str, float] = defaultdict(float)
    monthly_counts: dict[str, int] = defaultdict(int)
    for r in all_variable:
        d = r.get("date", "")
        if len(d) >= 7:
            m = d[:7]
            try:
                monthly_totals[m] += float(r.get("amount", 0) or 0)
                monthly_counts[m] += 1
            except ValueError:
                pass
    recent = sorted(monthly_totals)[-6:]

    # Per-category monthly trends
    cat_monthly: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for r in all_variable:
        d = r.get("date", "")
        if len(d) >= 7:
            try:
                cat_monthly[r.get("category", "Other")][d[:7]] += float(r.get("amount", 0) or 0)
            except ValueError:
                pass

    count = len(month_rows)
    avg = variable_total / count if count else 0

    lines = [f"Financial Summary — {month}", "=" * 40]
    lines.append(f"\nFixed total:    {cur} {fixed_total:.2f}/month ({len(fixed_rows)} items)")
    lines.append(f"Variable total: {cur} {variable_total:.2f} ({count} entries, avg {cur} {avg:.2f})")
    lines.append(f"Combined:       {cur} {fixed_total + variable_total:.2f}")

    if cat_totals:
        lines.append(f"\nVariable by category ({month}):")
        for cat, amt in sorted(cat_totals.items(), key=lambda x: -x[1]):
            lines.append(f"  {cat}: {cur} {amt:.2f} ({cat_pct[cat]:.1f}%)")

    if recent:
        lines.append(f"\nMonthly variable trend:")
        for m in recent:
            lines.append(f"  {m}: {cur} {monthly_totals[m]:.2f} ({monthly_counts[m]} entries)")

    if cat_monthly and recent:
        lines.append(f"\nCategory trends (last 3 months):")
        last3 = recent[-3:]
        for cat in sorted(cat_monthly):
            parts = [f"{m[-2:]}: {cur}{cat_monthly[cat].get(m, 0):.0f}" for m in last3]
            lines.append(f"  {cat}: {' → '.join(parts)}")

    if fixed_rows:
        lines.append(f"\nFixed expenses:")
        for r in fixed_rows:
            lines.append(f"  {r.get('Item')}: {cur} {float(r.get('Cost', 0)):.2f}")

    return "\n".join(lines)
```

- [ ] **Step 2: Verify the module imports cleanly**

```
python -c "from integrations.finance import list_fixed_expenses; print('finance OK')"
```
Expected: `finance OK`

---

## Task 4: Write `agents/finance_agent.py`

**Files:**
- Create: `backend/agents/finance_agent.py`

- [ ] **Step 1: Create `backend/agents/finance_agent.py`**

```python
import anthropic

from core.config import settings
from integrations.finance import (
    list_fixed_expenses,
    add_fixed_expense,
    edit_fixed_expense,
    delete_fixed_expense,
    list_variable_expenses,
    add_variable_expense,
    edit_variable_expense,
    delete_variable_expense,
    get_financial_summary,
)

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

TOOLS = [
    {
        "name": "list_fixed_expenses",
        "description": "List all fixed monthly expenses with total.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "add_fixed_expense",
        "description": "Add a new fixed monthly expense.",
        "input_schema": {
            "type": "object",
            "properties": {
                "item": {"type": "string", "description": "Expense name, e.g. 'Netflix'."},
                "cost": {"type": "number", "description": "Monthly cost amount."},
                "comments": {"type": "string", "description": "Optional notes."},
            },
            "required": ["item", "cost"],
        },
    },
    {
        "name": "edit_fixed_expense",
        "description": "Edit a fixed expense by partial name match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial expense name to find."},
                "cost": {"type": "number", "description": "New cost (optional)."},
                "comments": {"type": "string", "description": "New comments (optional)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "delete_fixed_expense",
        "description": "Delete a fixed expense by partial name match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial expense name."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "list_variable_expenses",
        "description": "List variable expenses for a month.",
        "input_schema": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "Month in YYYY-MM format. Defaults to current month."},
            },
        },
    },
    {
        "name": "add_variable_expense",
        "description": "Add a new variable expense entry.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "Date in YYYY-MM-DD format."},
                "category": {"type": "string", "description": "Category, e.g. 'food', 'transport'."},
                "description": {"type": "string", "description": "Description of the expense."},
                "amount": {"type": "number", "description": "Amount spent."},
            },
            "required": ["date", "category", "description", "amount"],
        },
    },
    {
        "name": "edit_variable_expense",
        "description": "Edit a variable expense by partial description match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial description to find."},
                "date": {"type": "string", "description": "New date YYYY-MM-DD (optional)."},
                "category": {"type": "string", "description": "New category (optional)."},
                "description": {"type": "string", "description": "New description (optional)."},
                "amount": {"type": "number", "description": "New amount (optional)."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "delete_variable_expense",
        "description": "Delete a variable expense by partial description match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial description to match."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_financial_summary",
        "description": "Get a comprehensive financial summary with all analytics: category breakdown, percentages, fixed vs variable, monthly trends, spending frequency, and averages.",
        "input_schema": {
            "type": "object",
            "properties": {
                "month": {"type": "string", "description": "Month in YYYY-MM format. Defaults to current month."},
            },
        },
    },
]

_TOOL_FNS = {
    "list_fixed_expenses": lambda a: list_fixed_expenses(),
    "add_fixed_expense": lambda a: add_fixed_expense(a["item"], a["cost"], a.get("comments", "")),
    "edit_fixed_expense": lambda a: edit_fixed_expense(a["query"], a.get("cost"), a.get("comments")),
    "delete_fixed_expense": lambda a: delete_fixed_expense(a["query"]),
    "list_variable_expenses": lambda a: list_variable_expenses(a.get("month")),
    "add_variable_expense": lambda a: add_variable_expense(a["date"], a["category"], a["description"], a["amount"]),
    "edit_variable_expense": lambda a: edit_variable_expense(a["query"], a.get("date"), a.get("category"), a.get("description"), a.get("amount")),
    "delete_variable_expense": lambda a: delete_variable_expense(a["query"]),
    "get_financial_summary": lambda a: get_financial_summary(a.get("month")),
}

SYSTEM_PROMPT = (
    "You are the Finance Agent for Friday. You manage fixed and variable expense records in Google Sheets "
    "and compute financial analytics. Use the available tools to fulfil the instruction. "
    "Currency is " + settings.CURRENCY + ". "
    "Return a concise plain-text result."
)


def run_finance_agent(instruction: str) -> str:
    messages = [{"role": "user", "content": instruction}]

    response = _client.messages.create(
        model=settings.NOTES_AGENT_MODEL,
        max_tokens=2048,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=TOOLS,
        messages=messages,
    )

    while response.stop_reason == "tool_use":
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                fn = _TOOL_FNS.get(block.name)
                result = fn(block.input) if fn else f"Unknown tool: {block.name}"
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })
        messages = [
            {"role": "user", "content": instruction},
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": tool_results},
        ]
        response = _client.messages.create(
            model=settings.NOTES_AGENT_MODEL,
            max_tokens=2048,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            tools=TOOLS,
            messages=messages,
        )

    for block in response.content:
        if hasattr(block, "text"):
            return block.text
    return "Finance agent completed the task."
```

- [ ] **Step 2: Verify the module imports cleanly**

```
python -c "from agents.finance_agent import run_finance_agent; print('finance_agent OK')"
```
Expected: `finance_agent OK`

---

## Task 5: Update `agents/friday.py`

**Files:**
- Modify: `backend/agents/friday.py`

- [ ] **Step 1: Add import**

Read the file. After `from agents.research_agent import run_research_agent`, add:
```python
from agents.finance_agent import run_finance_agent
```

- [ ] **Step 2: Update SYSTEM_PROMPT**

Replace the full SYSTEM_PROMPT with:
```python
SYSTEM_PROMPT = """\
You are Friday, a personal AI assistant for Qhairul. You are warm, efficient, and direct — you get things done without unnecessary filler.

You have access to sub-agents that handle specialised tasks:
- **notes_agent**: Save, search, read, edit, or delete notes in Google Drive.
- **productivity_agent**: View, create, find, or delete Google Calendar events. Add, complete, update, or delete Google Tasks. Add, list, edit, delete, and mark done/undone daily routines (recurring habits like "morning workout").
- **research_agent**: Search the web for information on any topic. Use when the user asks to research, look up, find out about, or search for something online.
- **finance_agent**: Manage fixed and variable expenses in Google Sheets. Get financial summaries and analytics.

When the user asks you to do something that a sub-agent handles, delegate to it immediately using the tool. After the sub-agent returns a result, summarise it naturally.

For research results specifically: give a more detailed response — highlight the key findings in a few bullet points, then suggest 2-3 related topics the user might want to explore next. Keep it scannable, not a wall of text.

IMPORTANT — saving research to notes: When the user asks to save research findings, pass the COMPLETE research output to notes_agent — the full answer text AND all source URLs. Never save just a summary. The note content should be the full research result exactly as returned by research_agent.

For questions or conversation that don't require a sub-agent, answer directly.

Keep responses concise. Never narrate what you're about to do — just do it and report back.
"""
```

- [ ] **Step 3: Add finance_agent to TOOLS list**

Append to the end of the TOOLS list (before the closing `]`):
```python
    {
        "name": "finance_agent",
        "description": (
            "Manage fixed and variable expenses in Google Sheets, and generate financial summaries. "
            "Use this when the user asks about expenses, spending, financial summaries, or wants to add/edit/delete expense records."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "instruction": {
                    "type": "string",
                    "description": "Clear natural-language instruction, e.g. 'Add variable expense: coffee SGD 5 food today'",
                }
            },
            "required": ["instruction"],
        },
    },
```

- [ ] **Step 4: Add to `_AGENT_FNS`**

Append to the end of `_AGENT_FNS` (before closing `}`):
```python
    "finance_agent": lambda args: run_finance_agent(args["instruction"]),
```

- [ ] **Step 5: Verify**

```
python -c "from agents.friday import run_friday; print('friday OK')"
```
Expected: `friday OK`

---

## Task 6: End-to-End Verification

Requires user interaction with Telegram. Instruct them.

- [ ] **Step 1: Start Friday**

```
python main.py
```
Expected: `Friday is online. Listening on Telegram...`

- [ ] **Step 2: Test — list fixed expenses**

Send: `show my fixed expenses`
Expected: Friday lists all rows from `master_fixed expenses` with total.

- [ ] **Step 3: Test — add variable expense**

Send: `add a variable expense: coffee at Starbucks, food, SGD 7.50, today`
Expected: Friday confirms. Row appears in `master_variable expenses` with recorder="Friday".

- [ ] **Step 4: Test — financial summary**

Send: `give me a financial summary for this month`
Expected: Friday returns a formatted summary with category breakdown, fixed vs variable, monthly trends.

- [ ] **Step 5: Regression**

Send: `what are my routines`
Expected: Routines still work (no regression).
