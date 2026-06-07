# Finance Page Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four targeted improvements to the Finance dashboard: live income from Google Sheet, cross-month variable expense search, savings sort, and drag-and-drop fixed expense reordering.

**Architecture:** Backend gains a `read_cell()` helper in `gsheets.py` and a `fetch_income()` function in `finance.py`; the `GET /finance/income` endpoint is replaced to call it. All frontend changes are in a single file (`finance/page.tsx`): new state, derived values, and JSX swaps — no new components files, no new npm packages.

**Tech Stack:** Python FastAPI (backend), Next.js 15 / React / TypeScript (frontend), `@dnd-kit/core` + `@dnd-kit/sortable` (already installed), Google Sheets API v4 (already authorized).

---

## File Map

| Action | File |
|--------|------|
| Modify | `FridayV2/backend/integrations/gsheets.py` — add `read_cell()` |
| Modify | `FridayV2/backend/integrations/finance.py` — add `fetch_income()`, import `read_cell` |
| Modify | `FridayV2/backend/api.py` — replace `GET /finance/income` body |
| Modify | `FridayV2/frontend/app/(dashboard)/finance/page.tsx` — all 4 frontend changes |

---

## Task 1: Backend — `read_cell` + `fetch_income` + update income endpoint

**Files:**
- Modify: `FridayV2/backend/integrations/gsheets.py`
- Modify: `FridayV2/backend/integrations/finance.py`
- Modify: `FridayV2/backend/api.py`

**Context:** `gsheets.py` currently ends at line 111 (the `delete_row` function). `finance.py` imports from `gsheets` at lines 6–15. The `GET /finance/income` endpoint in `api.py` is at lines 464–485 and reads from a local JSON file.

- [ ] **Step 1: Add `read_cell` to `gsheets.py`**

Open `FridayV2/backend/integrations/gsheets.py`. Append after the last line (after `delete_row`):

```python
def read_cell(spreadsheet_id: str, range_: str) -> str:
    """Read a single cell value from any spreadsheet by ID. Returns empty string if not found."""
    result = _sheets().spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_,
    ).execute()
    values = result.get("values", [])
    if values and values[0]:
        return str(values[0][0])
    return ""
```

- [ ] **Step 2: Add `read_cell` to the import in `finance.py`**

Open `FridayV2/backend/integrations/finance.py`. The import block at lines 6–15 currently is:

```python
from integrations.gsheets import (
    _discover_sheet_id,
    _sheet_id_cache,
    _drive,
    _sheets,
    get_all_rows,
    append_row,
    update_row,
    delete_row,
)
```

Replace it with:

```python
from integrations.gsheets import (
    _discover_sheet_id,
    _sheet_id_cache,
    _drive,
    _sheets,
    get_all_rows,
    append_row,
    update_row,
    delete_row,
    read_cell,
)
```

- [ ] **Step 3: Add `INCOME_SPREADSHEET_ID` constant and `fetch_income()` to `finance.py`**

Append after the `_parse_amount` function (currently the last thing in the file, ending around line 60):

```python
INCOME_SPREADSHEET_ID = "13A1BMtJKATQNE0VrkfAKZBxiQvPXTSVCzPQXZEBQHZw"


def fetch_income() -> float:
    """Read current monthly income from Google Drive sheet.
    Opens the spreadsheet above, reads the tab named 'Sheet2', cell B1.
    NOTE: if the tab name is not 'Sheet2', update the range string below.
    """
    raw = read_cell(INCOME_SPREADSHEET_ID, "Sheet2!B1")
    try:
        return float(str(raw).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0
```

- [ ] **Step 4: Update the finance import in `api.py`**

Open `FridayV2/backend/api.py`. Find line 315:

```python
from integrations.finance import _fixed_id, _variable_id, _savings_id, _parse_amount, _current_month
```

Replace with:

```python
from integrations.finance import _fixed_id, _variable_id, _savings_id, _parse_amount, _current_month, fetch_income
```

- [ ] **Step 5: Replace the `GET /finance/income` endpoint body in `api.py`**

Find the full `get_income` function (lines 464–485):

```python
@app.get("/finance/income")
def get_income():
    import re as _re
    cfg = _read_finance_config()
    stored = float(cfg.get("monthly_income", 0.0))
    if stored > 0:
        return {"amount": stored}
    # Fallback: read income/salary facts from Friday's memory
    try:
        rows = get_supabase().table("user_memory").select("fact").execute()
        keywords = ["income", "salary", "earns", "earn", "wage", "pay"]
        for row in (rows.data or []):
            fact = (row.get("fact") or "").lower()
            if any(kw in fact for kw in keywords):
                nums = _re.findall(r'[\d,]+(?:\.\d+)?', fact)
                for n in nums:
                    val = float(n.replace(",", ""))
                    if val >= 500:
                        return {"amount": val}
    except Exception:
        pass
    return {"amount": 0.0}
```

Replace with:

```python
@app.get("/finance/income")
def get_income():
    try:
        return {"amount": fetch_income()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 6: Verify imports load cleanly**

With the backend running (or in a new terminal in `FridayV2/backend/`):

```
python -c "from integrations.gsheets import read_cell; from integrations.finance import fetch_income; print('OK')"
```

Expected: `OK`

- [ ] **Step 7: Test the endpoint**

Ensure the backend is running (`uvicorn api:app --port 8001`), then:

```
curl http://localhost:8001/finance/income
```

Expected: `{"amount": <number matching cell B1 in Sheet2>}` — not `0.0`.

If you get `{"detail": "..."}`, check that the sheet tab is actually named `Sheet2`. Open the spreadsheet, look at the tab label at the bottom, and update `"Sheet2!B1"` in `fetch_income()` if it differs.

- [ ] **Step 8: Commit**

```
git add FridayV2/backend/integrations/gsheets.py FridayV2/backend/integrations/finance.py FridayV2/backend/api.py
git commit -m "feat(finance): read income live from Google Drive sheet (Sheet2!B1)"
```

---

## Task 2: Frontend — Make Income tile read-only

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/finance/page.tsx`

**Context:** The Income tile in the `summary` widget (around line 438–453) currently shows an inline edit form when clicked. The `editingIncome`, `incomeInput` state and `saveIncome` function are used only here. Since income is now read from the sheet, these are dead.

- [ ] **Step 1: Remove `editingIncome`, `incomeInput` state declarations**

Find these two lines (around line 183–184):

```ts
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput]     = useState("");
```

Delete both lines.

- [ ] **Step 2: Remove `saveIncome` function**

Find and delete the `saveIncome` function (around line 366–369):

```ts
  async function saveIncome() {
    try { await apiFetch("/finance/income", { method: "POST", body: JSON.stringify({ amount: parseFloat(incomeInput) || 0 }) }); setEditingIncome(false); load(); }
    catch (e) { alert(String(e)); }
  }
```

- [ ] **Step 3: Replace the Income tile JSX in the `summary` widget**

Find this block inside the `summary` widget (around lines 440–453):

```tsx
              {editingIncome ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input autoFocus value={incomeInput} onChange={e => setIncomeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveIncome(); if (e.key === "Escape") setEditingIncome(false); }}
                    style={{ ...inputStyle, padding: "4px 8px", fontSize: 13, width: 100 }} />
                  <button onClick={saveIncome} style={{ color: "var(--cyan)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>Save</button>
                </div>
              ) : (
                <div className="metric-value" onClick={() => { setIncomeInput(String(income)); setEditingIncome(true); }}
                  style={{ fontSize: 22, color: "#34d399", cursor: "pointer" }} title="Click to edit">
                  {cur} {income.toFixed(2)}
                </div>
              )}
```

Replace with:

```tsx
              <div className="metric-value" style={{ fontSize: 22, color: "#34d399" }}>
                {cur} {income.toFixed(2)}
              </div>
```

- [ ] **Step 4: Verify TypeScript build**

```
cd FridayV2/frontend && npm run build
```

Expected: exits 0 with no type errors.

- [ ] **Step 5: Commit**

```
git add FridayV2/frontend/app/(dashboard)/finance/page.tsx
git commit -m "feat(finance): income tile is read-only — live from Google Sheet"
```

---

## Task 3: Frontend — Variable Expenses cross-month search

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/finance/page.tsx`

**Context:** `allVariable` (all expenses across all months) is already loaded at page mount via `GET /finance/variable/all` and stored in the `allVariable` state. The current Variable tab uses `sortedVarData` (current month only). We filter `allVariable` client-side — no new API call.

- [ ] **Step 1: Add `varSearch` state**

Find the existing state declarations block (around lines 176–184). After:

```ts
  const [editSaving, setEditSaving] = useState<Saving | null>(null);
```

Add:

```ts
  const [varSearch, setVarSearch] = useState("");
```

- [ ] **Step 2: Add derived search data after `sortedVarData`**

Find the line (around line 422):

```ts
  const sortedVarData = [...varMonthData].sort((a, b) => b.date.localeCompare(a.date));
```

Add immediately after it:

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

- [ ] **Step 3: Replace the Variable tab meta row**

In the Variable tab section (inside `{activeTab === "variable" && ...}`), find the entire meta row div:

```tsx
          <div style={metaRow}>
            <span>{sortedVarData.length} entries · {cur} {sortedVarData.reduce((s, v) => s + parseAmt(v.amount), 0).toFixed(2)} — {formatMonthFull(varMonth)}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button onClick={() => shiftVarMonth(-1)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-2)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", transition: "border-color 0.15s, color 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
              >‹</button>
              <button onClick={() => shiftVarMonth(1)} disabled={varMonth >= todayYM} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: varMonth >= todayYM ? "var(--text-3)" : "var(--text-2)", cursor: varMonth >= todayYM ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", opacity: varMonth >= todayYM ? 0.4 : 1, transition: "border-color 0.15s, color 0.15s" }}
                onMouseEnter={e => { if (varMonth < todayYM) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = varMonth >= todayYM ? "var(--text-3)" : "var(--text-2)"; }}
              >›</button>
            </div>
          </div>
```

Replace with:

```tsx
          <div style={metaRow}>
            <span>
              {searchResults
                ? `${searchResults.length} results · ${cur} ${searchResults.reduce((s, v) => s + parseAmt(v.amount), 0).toFixed(2)} — all months`
                : `${sortedVarData.length} entries · ${cur} ${sortedVarData.reduce((s, v) => s + parseAmt(v.amount), 0).toFixed(2)} — ${formatMonthFull(varMonth)}`
              }
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                value={varSearch}
                onChange={e => setVarSearch(e.target.value)}
                placeholder="Search expenses…"
                style={{ ...inputStyle, padding: "5px 10px", fontSize: 12, width: 180 }}
                className="cyber-input"
              />
              {!searchResults && (
                <>
                  <button onClick={() => shiftVarMonth(-1)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-2)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", transition: "border-color 0.15s, color 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
                  >‹</button>
                  <button onClick={() => shiftVarMonth(1)} disabled={varMonth >= todayYM} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: varMonth >= todayYM ? "var(--text-3)" : "var(--text-2)", cursor: varMonth >= todayYM ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", opacity: varMonth >= todayYM ? 0.4 : 1, transition: "border-color 0.15s, color 0.15s" }}
                    onMouseEnter={e => { if (varMonth < todayYM) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = varMonth >= todayYM ? "var(--text-3)" : "var(--text-2)"; }}
                  >›</button>
                </>
              )}
            </div>
          </div>
```

- [ ] **Step 4: Replace `sortedVarData` with `displayedVarData` in the Variable tab table**

In the same Variable tab section, find the table body:

```tsx
                  {sortedVarData.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No expenses this month.</td></tr>
                  )}
                  {sortedVarData.map((v) => (
```

Replace with:

```tsx
                  {displayedVarData.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No expenses found.</td></tr>
                  )}
                  {displayedVarData.map((v) => (
```

- [ ] **Step 5: Verify TypeScript build**

```
cd FridayV2/frontend && npm run build
```

Expected: exits 0 with no type errors.

- [ ] **Step 6: Manual test**

Start the dev server (`npm run dev`). Open `http://localhost:3000/finance`, go to the **Var Exp** tab.
- Confirm the month navigation is visible and the table shows current-month data.
- Type a word (e.g. a category name like "food") in the search box.
- Confirm the month nav hides, meta row shows "X results · … all months", and the table shows matching entries across all months.
- Clear the search. Confirm month nav returns and table shows current month.

- [ ] **Step 7: Commit**

```
git add FridayV2/frontend/app/(dashboard)/finance/page.tsx
git commit -m "feat(finance): add cross-month search to Variable Expenses tab"
```

---

## Task 4: Frontend — Savings most-recent-first

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/finance/page.tsx`

**Context:** `savings` (current-month savings array) renders without any sort. We sort it descending by date. The savings table appears in two places: the `savings` widget object and the Savings tab section.

- [ ] **Step 1: Add `sortedSavings` derived value**

After the `displayedVarData` line added in Task 3, add:

```ts
  const sortedSavings = [...savings].sort((a, b) => b.date.localeCompare(a.date));
```

- [ ] **Step 2: Replace `savings.map` with `sortedSavings.map` in the `savings` widget**

In the `widgets` object, find the `savings` widget (around line 617). Replace:

```tsx
              {savings.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No savings this month.</td></tr>
              )}
              {savings.map((s) => (
```

With:

```tsx
              {sortedSavings.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No savings this month.</td></tr>
              )}
              {sortedSavings.map((s) => (
```

- [ ] **Step 3: Replace `savings.map` with `sortedSavings.map` in the Savings tab**

In the Savings tab section (inside `{activeTab === "savings" && ...}`), find:

```tsx
                  {savings.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No savings this month.</td></tr>}
                  {savings.map((s) => (
```

Replace with:

```tsx
                  {sortedSavings.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No savings this month.</td></tr>}
                  {sortedSavings.map((s) => (
```

- [ ] **Step 4: Verify TypeScript build**

```
cd FridayV2/frontend && npm run build
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```
git add FridayV2/frontend/app/(dashboard)/finance/page.tsx
git commit -m "feat(finance): sort savings most-recent-first"
```

---

## Task 5: Frontend — Fixed Expenses drag-and-drop reordering

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/finance/page.tsx`

**Context:** `@dnd-kit/core` and `@dnd-kit/sortable` are already installed and imported. The current sortable import is:
```ts
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
```
We need to add `verticalListSortingStrategy`. The existing `sensors` and `closestCenter` from `@dnd-kit/core` are also reused. The Google Sheet is never written to — order is localStorage-only.

- [ ] **Step 1: Add `verticalListSortingStrategy` to the sortable import**

Find the `@dnd-kit/sortable` import line and replace it with:

```ts
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
```

- [ ] **Step 2: Add `fixedOrder` state**

After the `varSearch` state added in Task 3, add:

```ts
  const [fixedOrder, setFixedOrder] = useState<number[]>([]);
```

- [ ] **Step 3: Load `fixedOrder` from localStorage on mount**

In the existing `useEffect` that loads localStorage (the one starting `useEffect(() => { const s = localStorage.getItem(SPANS_KEY)...`), add before the closing `}, []);`:

```ts
    const fo = localStorage.getItem("fixed_expense_order");
    if (fo) setFixedOrder(JSON.parse(fo));
```

- [ ] **Step 4: Add `orderedFixed` derived value**

After the `sortedSavings` line, add:

```ts
  const orderedFixed: FixedExpense[] = fixedOrder.length
    ? [
        ...fixedOrder
          .map(idx => fixed.find(f => f._index === idx))
          .filter((f): f is FixedExpense => f !== undefined),
        ...fixed.filter(f => !fixedOrder.includes(f._index)),
      ]
    : fixed;
```

- [ ] **Step 5: Add `onFixedDragEnd` handler**

After the existing `onDragEnd` function (the one that handles widget reordering), add:

```ts
  function onFixedDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const currentOrder = orderedFixed.map(f => f._index);
    const oldIdx = currentOrder.indexOf(active.id as number);
    const newIdx = currentOrder.indexOf(over.id as number);
    const next = arrayMove(currentOrder, oldIdx, newIdx);
    setFixedOrder(next);
    localStorage.setItem("fixed_expense_order", JSON.stringify(next));
  }
```

- [ ] **Step 6: Add `SortableFixedRow` component**

Add this new component just before the `export default function FinancePage()` line:

```tsx
function SortableFixedRow({ id, children }: { id: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: transform ? `translateY(${transform.y}px)` : undefined,
        zIndex: isDragging ? 10 : undefined,
        position: isDragging ? "relative" : undefined,
        background: isDragging ? "var(--bg-elevated)" : undefined,
        opacity: isDragging ? 0.9 : 1,
      }}
    >
      <td style={{ paddingRight: 4, width: 20 }}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: "grab", color: "var(--text-3)", fontSize: 14, userSelect: "none" }}
        >⠿</span>
      </td>
      {children}
    </tr>
  );
}
```

- [ ] **Step 7: Replace the Fixed tab table with the DnD version**

In the Fixed tab section, find the entire `<div style={{ ...panel, overflow: "hidden" }}>` block that contains the fixed expenses table:

```tsx
          <div style={{ ...panel, overflow: "hidden" }}>
            <div className={finHidden} style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead><tr><th style={{ width: 32 }} /><th>Item</th><th style={{ textAlign: "right" }}>Cost/mo</th><th>Notes</th><th /></tr></thead>
                <tbody className="finance-blur">
                  {fixed.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No fixed expenses.</td></tr>}
                  {fixed.map((f) => {
                    const isPaid = paidFixed.has(f._index);
                    return (
                      <tr key={f._index} style={{ opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>
                        <td style={{ paddingRight: 4 }}>
                          <input type="checkbox" checked={isPaid} onChange={() => togglePaidFixed(f._index)} style={{ accentColor: "var(--cyan)", width: 14, height: 14, cursor: "pointer" }} />
                        </td>
                        {editFixed?._index === f._index ? (
                          <>
                            <td><input value={editFixed.item} onChange={e => setEditFixed(p => p && { ...p, item: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                            <td><input value={editFixed.cost} onChange={e => setEditFixed(p => p && { ...p, cost: e.target.value })} style={{ ...inputStyle, width: 80, padding: "4px 8px", fontSize: 12, textAlign: "right" }} /></td>
                            <td><input value={editFixed.comments} onChange={e => setEditFixed(p => p && { ...p, comments: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                              <button onClick={saveEditFixed} style={{ color: "var(--cyan)", fontSize: 11, background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Save</button>
                              <button onClick={() => setEditFixed(null)} style={{ color: "var(--text-3)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ textDecoration: isPaid ? "line-through" : "none" }}>{f.item}</td>
                            <td style={{ textAlign: "right", color: isPaid ? "var(--text-3)" : "var(--cyan)", fontFamily: "var(--font-mono)", textDecoration: isPaid ? "line-through" : "none" }}>{parseFloat(f.cost).toFixed(2)}</td>
                            <td style={{ color: "var(--text-3)", fontSize: 12 }}>{f.comments}</td>
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                              <button onClick={() => setEditFixed({ ...f })} className="btn-icon" style={{ fontSize: 11, marginRight: 4 }}>✎</button>
                              <button onClick={() => deleteFixed(f._index)} className="btn-danger">✕</button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
```

Replace with:

```tsx
          <div style={{ ...panel, overflow: "hidden" }}>
            <div className={finHidden} style={{ overflowX: "auto" }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFixedDragEnd}>
                <SortableContext items={orderedFixed.map(f => f._index)} strategy={verticalListSortingStrategy}>
                  <table className="data-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ width: 20 }} />
                        <th style={{ width: 32 }} />
                        <th>Item</th>
                        <th style={{ textAlign: "right" }}>Cost/mo</th>
                        <th>Notes</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="finance-blur">
                      {orderedFixed.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No fixed expenses.</td></tr>
                      )}
                      {orderedFixed.map((f) => {
                        const isPaid = paidFixed.has(f._index);
                        return (
                          <SortableFixedRow key={f._index} id={f._index}>
                            <td style={{ paddingRight: 4, opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>
                              <input type="checkbox" checked={isPaid} onChange={() => togglePaidFixed(f._index)} style={{ accentColor: "var(--cyan)", width: 14, height: 14, cursor: "pointer" }} />
                            </td>
                            {editFixed?._index === f._index ? (
                              <>
                                <td><input value={editFixed.item} onChange={e => setEditFixed(p => p && { ...p, item: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                                <td><input value={editFixed.cost} onChange={e => setEditFixed(p => p && { ...p, cost: e.target.value })} style={{ ...inputStyle, width: 80, padding: "4px 8px", fontSize: 12, textAlign: "right" }} /></td>
                                <td><input value={editFixed.comments} onChange={e => setEditFixed(p => p && { ...p, comments: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                  <button onClick={saveEditFixed} style={{ color: "var(--cyan)", fontSize: 11, background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Save</button>
                                  <button onClick={() => setEditFixed(null)} style={{ color: "var(--text-3)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ textDecoration: isPaid ? "line-through" : "none", opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>{f.item}</td>
                                <td style={{ textAlign: "right", color: isPaid ? "var(--text-3)" : "var(--cyan)", fontFamily: "var(--font-mono)", textDecoration: isPaid ? "line-through" : "none", opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>{parseFloat(f.cost).toFixed(2)}</td>
                                <td style={{ color: "var(--text-3)", fontSize: 12, opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>{f.comments}</td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                  <button onClick={() => setEditFixed({ ...f })} className="btn-icon" style={{ fontSize: 11, marginRight: 4 }}>✎</button>
                                  <button onClick={() => deleteFixed(f._index)} className="btn-danger">✕</button>
                                </td>
                              </>
                            )}
                          </SortableFixedRow>
                        );
                      })}
                    </tbody>
                  </table>
                </SortableContext>
              </DndContext>
            </div>
          </div>
```

> **Note:** The `isPaid` opacity that was on the `<tr>` in the original is now applied per-cell (since `<tr>` is replaced by `SortableFixedRow` which manages its own style). Apply `opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s"` to each visible data cell in the non-edit branch, as shown above.

- [ ] **Step 8: Verify TypeScript build**

```
cd FridayV2/frontend && npm run build
```

Expected: exits 0 with no type errors.

- [ ] **Step 9: Manual test**

Open `http://localhost:3000/finance`, go to the **Fixed Exp** tab.
- Confirm each row has a `⠿` handle as the leftmost column.
- Drag a row up or down — confirm it reorders visually.
- Refresh the page — confirm the new order is preserved (loaded from localStorage).
- Add a new fixed expense — confirm it appears at the bottom of the custom order.

- [ ] **Step 10: Commit**

```
git add FridayV2/frontend/app/(dashboard)/finance/page.tsx
git commit -m "feat(finance): drag-and-drop reordering in Fixed Expenses tab (localStorage-only)"
```
