# Finance Page Changes — Design Spec

## Overview

Four targeted improvements to the Finance dashboard. All frontend changes are in
`FridayV2/frontend/app/(dashboard)/finance/page.tsx`. Backend changes are in
`FridayV2/backend/integrations/gsheets.py`, `FridayV2/backend/integrations/finance.py`,
and `FridayV2/backend/api.py`.

---

## 1. Variable Expenses: Cross-Month Search + Most-Recent-First

### Current state
Month-scoped view, sorted most-recent-first. No search capability.

### Changes

**Sort order:** already most-recent-first (`sortedVarData`). No change needed.

**Search input:** add a text input above the table in the Variable tab.

New state:
```ts
const [varSearch, setVarSearch] = useState("");
```

Derived display data:
```ts
const searchResults = varSearch.trim()
  ? allVariable
      .filter(v =>
        [v.description, v.category].some(f =>
          f.toLowerCase().includes(varSearch.toLowerCase())
        )
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  : null;

const displayedVarData = searchResults ?? sortedVarData;
```

**Search UI:** a `<input>` with placeholder `"Search expenses…"` placed in the meta row
area of the Variable tab, to the right of the month navigation.

**Behaviour when search is active (`searchResults !== null`):**
- Month navigation arrows are hidden (replaced by the search scope label "all months")
- Meta row shows `"{N} results · {cur} {total} — all months"`
- Table renders `displayedVarData` (cross-month, most-recent-first)
- Date column shows the full `YYYY-MM-DD` date so the user can see which month each entry is from

**Behaviour when search is empty:**
- Month navigation arrows visible
- Meta row shows current month count/total
- Table renders `sortedVarData` (current month only)

**No new API calls.** `allVariable` is already fetched at page load via `/finance/variable/all`.

---

## 2. Fixed Expenses: Drag-and-Drop Row Reordering

### Current state
Fixed expenses render in sheet order. No reordering.

### Changes

**State:**
```ts
const [fixedOrder, setFixedOrder] = useState<number[]>([]);
```
`fixedOrder` is an array of `_index` values representing the preferred display order.

**Persistence:** localStorage key `"fixed_expense_order"`.

**Initialization (in `useEffect` on mount):**
```ts
const saved = localStorage.getItem("fixed_expense_order");
if (saved) setFixedOrder(JSON.parse(saved));
```

**Merge when `fixed` API data loads:** any `_index` values not in `fixedOrder` are appended
at the end, so newly added expenses appear at the bottom automatically.

**Derived display list:**
```ts
const orderedFixed = fixedOrder.length
  ? [
      ...fixedOrder.map(idx => fixed.find(f => f._index === idx)).filter(Boolean),
      ...fixed.filter(f => !fixedOrder.includes(f._index)),
    ] as FixedExpense[]
  : fixed;
```

**DnD implementation:**
- Wrap the fixed expenses `<tbody>` rows in a new `SortableContext` (using `fixedOrder` as items — but since items must be strings/numbers, use `_index` values directly)
- Add a `SortableFixedRow` component that wraps `<tr>` using `useSortable({ id: f._index })`
- Apply `transform` constrained to Y-axis only:
  ```ts
  const style = transform ? { transform: `translateY(${transform.y}px)` } : undefined;
  ```
  Apply `style` to the `<tr>` element.
- Add a `⠿` drag handle in the first column cell (before the checkbox), using `{...listeners} {...attributes}` on the handle `<span>` only (not the whole row, so editing still works)
- `onDragEnd` in the fixed tab: update `fixedOrder` and save to localStorage

**The Google Sheet is never modified.** Only the visual order in the dashboard changes.

---

## 3. Overview: Income from Google Drive Sheet

### Current state
`GET /finance/income` reads from `backend/data/finance_config.json`, falling back to
user memory in Supabase. Income is editable via a click-to-edit form in the summary widget.

### Backend changes

**Add `read_cell()` to `integrations/gsheets.py`:**
```python
def read_cell(spreadsheet_id: str, range_: str) -> str:
    """Read a single cell value from any spreadsheet by ID."""
    result = _sheets().spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_,
    ).execute()
    values = result.get("values", [])
    if values and values[0]:
        return str(values[0][0])
    return ""
```

> **Note for implementer:** Verify the sheet tab name before coding. Open the spreadsheet and check the tab label at the bottom. If it is not "Sheet2", substitute the correct name in the range string (e.g. `"Income!B1"`).

**Add `fetch_income()` to `integrations/finance.py`:**
```python
INCOME_SPREADSHEET_ID = "13A1BMtJKATQNE0VrkfAKZBxiQvPXTSVCzPQXZEBQHZw"

def fetch_income() -> float:
    raw = read_cell(INCOME_SPREADSHEET_ID, "Sheet2!B1")
    try:
        return float(str(raw).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0
```

Import `read_cell` at the top of `finance.py` (add to the existing import from `gsheets`).

**Update `GET /finance/income` in `api.py`:**
```python
@app.get("/finance/income")
def get_income():
    try:
        return {"amount": fetch_income()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Remove the JSON-file read logic and the Supabase fallback from this endpoint entirely.

### Frontend changes

Remove the click-to-edit income UI from the summary widget:
- Delete state: `editingIncome`, `incomeInput`
- Delete function: `saveIncome`
- Delete the `POST /finance/income` call site
- In the Income tile, replace the conditional edit form with a plain read-only display:
  ```tsx
  <div className="metric-value" style={{ fontSize: 22, color: "#34d399" }}>
    {cur} {income.toFixed(2)}
  </div>
  ```

The `POST /finance/income` backend endpoint can remain (it writes to JSON, now unused by
the frontend — no need to delete it).

---

## 4. Savings: Most Recent at Top

### Current state
`savings` renders in sheet order (no explicit sort).

### Change

Sort before rendering:
```ts
const sortedSavings = [...savings].sort((a, b) => b.date.localeCompare(a.date));
```

Render `{sortedSavings.map(...)}` instead of `{savings.map(...)}` in both the Savings tab
and the `savings` widget object.

---

## Architecture Summary

| Layer    | File                            | Change                                                    |
|----------|---------------------------------|-----------------------------------------------------------|
| Backend  | `integrations/gsheets.py`       | Add `read_cell(spreadsheet_id, range_)` function          |
| Backend  | `integrations/finance.py`       | Add `fetch_income()`, import `read_cell`                  |
| Backend  | `api.py`                        | Replace `/finance/income` GET body with `fetch_income()`  |
| Frontend | `finance/page.tsx`              | `varSearch` state + search UI + derived `displayedVarData`|
| Frontend | `finance/page.tsx`              | `fixedOrder` state + `SortableFixedRow` + DnD in Fixed tab|
| Frontend | `finance/page.tsx`              | Remove income edit UI; read-only Income tile              |
| Frontend | `finance/page.tsx`              | `sortedSavings` sort before render                        |

No schema changes. No new API endpoints. No new npm packages (DnD already installed).
