# FridayV2 — Finance Agent Design

**Date:** 2026-06-04
**Status:** Approved

---

## Context

The Finance Agent gives Friday read/write access to two Google Sheets in the Finance Drive folder. It handles CRUD on fixed and variable expenses, and computes financial analytics entirely in Python. The analytics results are consumed by the dashboard in a later phase.

---

## Google Drive Finance Folder

**Folder ID:** `1Ei0A9dlWroT_V5WAzjE9IjPzHhM0c7Zm`

**Sheets:**
| Sheet name | Columns |
|---|---|
| `master_fixed expenses` | Item, Cost, Comments |
| `master_variable expenses` | date, category, description, recorder, amount |

Sheet IDs are auto-discovered at runtime by listing the folder via Drive API and matching file names. IDs are cached in-process after the first lookup.

---

## Architecture

```
You → Friday (Haiku)
           └── finance_agent (NEW)
                    ├── integrations/gsheets.py   — raw Sheets API CRUD
                    └── integrations/finance.py   — sheet operations + analytics
```

---

## New OAuth Scope

Add to `scripts/authorize_google.py` SCOPES list:
```python
"https://www.googleapis.com/auth/spreadsheets"
```
Delete `secrets/gdrive_token.json` and re-run `python scripts/authorize_google.py` once.

---

## Components

### `integrations/gsheets.py`

Low-level Google Sheets API wrapper. Uses `build("sheets", "v4", credentials=creds)`. Sheet IDs for the two finance sheets are discovered via Drive API and cached.

**Functions:**
- `_get_sheets_service()` — builds Sheets v4 service using `settings.GDRIVE_TOKEN_FILE`
- `_get_drive_service()` — builds Drive v3 service (reuses same credentials)
- `_discover_sheet_id(name: str) -> str` — lists `FINANCE_FOLDER_ID` via Drive, returns spreadsheet ID for the named file; caches result
- `get_all_rows(spreadsheet_id: str) -> list[dict]` — reads all data rows as list of dicts (first row = headers)
- `append_row(spreadsheet_id: str, values: list) -> str` — appends a row
- `update_row(spreadsheet_id: str, row_index: int, values: list) -> str` — updates row at 1-based data index (row 2 in sheet = index 1)
- `delete_row(spreadsheet_id: str, row_index: int) -> str` — deletes row at 1-based data index using `batchUpdate` DeleteDimension

### `integrations/finance.py`

All finance operations: fixed CRUD, variable CRUD, and analytics. Imports from `gsheets.py`.

**Fixed expense functions:**
- `list_fixed_expenses() -> str` — all rows formatted
- `add_fixed_expense(item: str, cost: float, comments: str = "") -> str`
- `edit_fixed_expense(query: str, cost: float = None, comments: str = None) -> str` — finds row by partial Item match
- `delete_fixed_expense(query: str) -> str` — finds row by partial Item match

**Variable expense functions:**
- `list_variable_expenses(month: str = None) -> str` — all rows, or filtered to `YYYY-MM` month
- `add_variable_expense(date: str, category: str, description: str, amount: float) -> str` — recorder is always "Friday"
- `edit_variable_expense(query: str, date: str = None, category: str = None, description: str = None, amount: float = None) -> str` — finds row by partial description match
- `delete_variable_expense(query: str) -> str` — finds row by partial description match

**Analytics:**
- `get_financial_summary(month: str = None) -> str` — computes all 8 metrics and returns formatted text:
  1. Monthly variable spend by category (totals)
  2. Category percentage breakdown
  3. Total fixed vs total variable comparison
  4. Month-over-month variable spend trend (last 6 months)
  5. Per-category month-over-month trends
  6. Spending frequency (entries per month)
  7. Average amount per variable entry
  8. Full fixed expenses list with grand total

If `month` is provided (format `YYYY-MM`), metrics 1, 2, 6, 7 apply to that month. Metrics 4 and 5 always show the last 6 months.

### `agents/finance_agent.py`

Claude Haiku + 9 tools. Same pattern as `notes_agent.py` and `productivity_agent.py`.

**Tools exposed:** `list_fixed_expenses`, `add_fixed_expense`, `edit_fixed_expense`, `delete_fixed_expense`, `list_variable_expenses`, `add_variable_expense`, `edit_variable_expense`, `delete_variable_expense`, `get_financial_summary`

`run_finance_agent(instruction: str) -> str`

### `agents/friday.py`

- Import `run_finance_agent`
- Add `finance_agent` tool to TOOLS
- Add entry to `_AGENT_FNS`
- Update SYSTEM_PROMPT to mention finance capabilities

### `core/config.py`

Add:
```python
FINANCE_FOLDER_ID: str = "1Ei0A9dlWroT_V5WAzjE9IjPzHhM0c7Zm"
CURRENCY: str = "SGD"
```

### `.env.example`

Add:
```
FINANCE_FOLDER_ID=1Ei0A9dlWroT_V5WAzjE9IjPzHhM0c7Zm
CURRENCY=SGD
```

---

## Data Flow Example

> "How much did I spend on food last month?"

1. Friday calls `finance_agent` with: `"Get financial summary for 2026-05"`
2. Finance agent calls `get_financial_summary("2026-05")`
3. `finance.py` reads variable sheet, filters to May 2026, aggregates by category
4. Returns formatted summary with Food total, % breakdown, and trend
5. Friday relays to Telegram

> "Add an expense: Grab ride, $12.50, transport, today"

1. Friday calls `finance_agent`
2. Finance agent calls `add_variable_expense("2026-06-04", "transport", "Grab ride", 12.50)`
3. Row appended to `master_variable expenses` with recorder="Friday"
4. Friday confirms in Telegram

---

## Implementation Steps

1. Update `scripts/authorize_google.py` — add spreadsheets scope; delete token and re-auth
2. Add `FINANCE_FOLDER_ID` and `CURRENCY` to `core/config.py` and `.env.example`; add actual values to `.env`
3. Write `integrations/gsheets.py`
4. Write `integrations/finance.py`
5. Write `agents/finance_agent.py`
6. Update `agents/friday.py`

---

## Verification

1. Send `"list my fixed expenses"` → Friday returns all rows from `master_fixed expenses`
2. Send `"add a variable expense: coffee, food, SGD 6, today"` → row appears in `master_variable expenses`
3. Send `"give me a financial summary for this month"` → Friday returns all 8 analytics
4. Send `"research something"` → Research Agent still works (no regression)
