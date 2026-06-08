# Widget Height Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add row-snapped height adjustment (via bottom drag handle) to all widgets across the four FridayV2 dashboard pages.

**Architecture:** Each page gains `heights` state (widget id → row count), a `HEIGHTS_KEY` for localStorage, `ROW_HEIGHT`/`MIN_ROWS`/`MAX_ROWS` constants, a `BottomResizeHandle` component, and `handleHeightChange`/`handleHeightResizeStart` functions — mirroring the existing width-resize pattern exactly. A shared CSS rule (`.widget-slot`) makes glass cards fill their grid row height without touching each widget's internal markup. The outer grid gains `grid-auto-rows` so cards align to a fixed row grid.

**Tech Stack:** Next.js 15, React, @dnd-kit/sortable, CSS Grid, localStorage

---

## Files Modified

| File | Change |
|------|--------|
| `FridayV2/frontend/app/globals.css` | Add `.widget-slot` CSS rules |
| `FridayV2/frontend/app/(dashboard)/overview/page.tsx` | Add constants, heights state, `BottomResizeHandle`, update `SortableCard`, `Widget`, grid, render |
| `FridayV2/frontend/app/(dashboard)/productivity/page.tsx` | Same pattern (`SortableWidget` variant) |
| `FridayV2/frontend/app/(dashboard)/fitness/page.tsx` | Same pattern (`SortableWidget` variant) |
| `FridayV2/frontend/app/(dashboard)/finance/page.tsx` | Same pattern (`SortableWidget` variant) |

---

## Task 1 — globals.css: widget-slot CSS

**Files:**
- Modify: `FridayV2/frontend/app/globals.css`

- [ ] **Step 1: Add widget-slot rules at the end of globals.css**

Append after the `.drag-handle:active` rule at the bottom of the file:

```css
/* ─── Widget slot (height-resizable) ──────────────────────────────────────────── */
.widget-slot {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.widget-slot > .glass,
.widget-slot > .glass.glow-cyan {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **Step 2: Commit**

```bash
git add FridayV2/frontend/app/globals.css
git commit -m "feat: add widget-slot CSS for height-resizable grid cards"
```

---

## Task 2 — Overview page

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/overview/page.tsx`

Context: Overview uses `SortableCard` (not `SortableWidget`). It has a shared `Widget` component wrapper. The grid is 6 columns.

- [ ] **Step 1: Add height constants after existing constants (around line 19)**

```ts
const HEIGHTS_KEY = "heights_overview_v2"
const ROW_HEIGHT  = 220
const MIN_ROWS    = 1
const MAX_ROWS    = 6

const DEFAULT_HEIGHTS: Record<string, number> = {
  upcoming_events:  2,
  world_clock:      1,
  tasks_due:        1,
  routines:         1,
  fitness_snapshot: 1,
  last_expense:     1,
}
```

- [ ] **Step 2: Add heights state to the `OverviewPage` component**

Add alongside the existing `const [spans, setSpans] = useState(...)` line:

```ts
const [heights, setHeights] = useState<Record<string, number>>(DEFAULT_HEIGHTS)
```

- [ ] **Step 3: Load heights from localStorage in the existing `useEffect` that loads spans**

The existing effect (around line 147) already loads `order`, `hidden`, and `spans`. Add heights to the same effect:

```ts
useEffect(() => {
  const o = localStorage.getItem(LAYOUT_KEY)
  const h = localStorage.getItem(HIDDEN_KEY)
  const s = localStorage.getItem(SPANS_KEY)
  const ht = localStorage.getItem(HEIGHTS_KEY)
  if (o)  setOrder(JSON.parse(o))
  if (h)  setHidden(JSON.parse(h))
  if (s)  setSpans(JSON.parse(s))
  if (ht) setHeights(JSON.parse(ht))
}, [])
```

- [ ] **Step 4: Add `BottomResizeHandle` component after the existing `ResizeHandle` component (around line 107)**

```tsx
function BottomResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 8,
        cursor: "ns-resize", zIndex: 9,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseEnter={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h")
        if (p) { p.style.opacity = "1"; p.style.boxShadow = "0 0 6px var(--cyan)" }
      }}
      onMouseLeave={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h")
        if (p) { p.style.opacity = "0.3"; p.style.boxShadow = "none" }
      }}
    >
      <div
        className="resize-pill-h"
        style={{ width: 32, height: 2, borderRadius: 4, background: "var(--cyan)", opacity: 0.3, transition: "opacity 0.15s, box-shadow 0.15s" }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Update `SortableCard` to accept `height` and `onHeightResizeStart` props**

Replace the existing `SortableCard` function:

```tsx
function SortableCard({ id, span = 3, height = 1, onResizeStart, onHeightResizeStart, children }: {
  id: string; span?: number; height?: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onHeightResizeStart: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        position: "relative",
        gridColumn: `span ${span}`,
        gridRow: `span ${height}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div {...attributes} {...listeners} className="drag-handle">⠿</div>
      <div className="widget-slot">
        {children}
      </div>
      <ResizeHandle onMouseDown={onResizeStart} />
      <BottomResizeHandle onMouseDown={onHeightResizeStart} />
    </div>
  )
}
```

- [ ] **Step 6: Update `Widget` component to fill height and scroll content**

Replace the existing `Widget` function:

```tsx
function Widget({ title, accent = "var(--cyan)", children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="glass glow-cyan" style={{
      padding: "24px", position: "relative",
      height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box",
    }}>
      <div style={{ position: "absolute", top: 0, left: 24, right: 24, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.6 }} />
      <div className="label-cyan" style={{ marginBottom: 16 }}>{title}</div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Add `handleHeightChange` and `handleHeightResizeStart` functions**

Add these after the existing `handleResizeStart` function:

```ts
function handleHeightChange(id: string, newHeight: number) {
  setHeights(prev => {
    const next = { ...prev, [id]: newHeight }
    localStorage.setItem(HEIGHTS_KEY, JSON.stringify(next))
    return next
  })
}

function handleHeightResizeStart(e: React.MouseEvent, id: string) {
  e.preventDefault()
  e.stopPropagation()
  const startY      = e.clientY
  const startHeight = heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1
  function onMove(mv: MouseEvent) {
    const delta = Math.round((mv.clientY - startY) / (ROW_HEIGHT + GRID_GAP))
    handleHeightChange(id, Math.max(MIN_ROWS, Math.min(MAX_ROWS, startHeight + delta)))
  }
  function onUp() {
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}
```

- [ ] **Step 8: Add `gridAutoRows` to the grid container**

Find the grid div (around line 528):
```tsx
<div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 20 }}>
```

Update it to:
```tsx
<div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 20, gridAutoRows: `${ROW_HEIGHT}px` }}>
```

- [ ] **Step 9: Update the `SortableCard` render call to pass height and `onHeightResizeStart`**

Find the render call (around line 530):
```tsx
<SortableCard key={id} id={id} span={spans[id] ?? DEFAULT_SPANS[id] ?? 3} onResizeStart={e => handleResizeStart(e, id)}>{widgets[id]}</SortableCard>
```

Update it to:
```tsx
<SortableCard
  key={id}
  id={id}
  span={spans[id] ?? DEFAULT_SPANS[id] ?? 3}
  height={heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1}
  onResizeStart={e => handleResizeStart(e, id)}
  onHeightResizeStart={e => handleHeightResizeStart(e, id)}
>
  {widgets[id]}
</SortableCard>
```

- [ ] **Step 10: Run the dev server and manually verify**

```bash
cd FridayV2/frontend && npm run dev
```

Open http://localhost:3000/overview. Check:
- Widgets render at their default row heights (upcoming_events taller, others 1 row)
- Dragging the bottom cyan pill resizes height and snaps
- Width resize (right handle) still works
- DnD reorder still works
- Refresh retains heights

- [ ] **Step 11: Commit**

```bash
git add FridayV2/frontend/app/(dashboard)/overview/page.tsx
git commit -m "feat(overview): add row-snapped height resize to widgets"
```

---

## Task 3 — Productivity page

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/productivity/page.tsx`

Context: Uses `SortableWidget` (not `SortableCard`). 2-column grid. No shared Widget component — each widget renders its own `glass` div.

- [ ] **Step 1: Add height constants after existing constants (around line 13)**

```ts
const HEIGHTS_KEY   = "heights_productivity"
const ROW_HEIGHT    = 220
const MIN_ROWS      = 1
const MAX_ROWS      = 6

const DEFAULT_HEIGHTS: Record<string, number> = {
  tasks:    2,
  routines: 2,
  calendar: 2,
}
```

- [ ] **Step 2: Add heights state to `ProductivityPage` component**

Add alongside `const [spans, setSpans] = useState(...)`:

```ts
const [heights, setHeights] = useState<Record<string, number>>(DEFAULT_HEIGHTS)
```

- [ ] **Step 3: Load heights from localStorage in the existing startup `useEffect`**

The existing effect (around line 61) loads `order` and `spans`. Add heights:

```ts
useEffect(() => {
  const o  = localStorage.getItem(LAYOUT_KEY)
  const s  = localStorage.getItem(SPANS_KEY)
  const ht = localStorage.getItem(HEIGHTS_KEY)
  if (o)  setOrder(JSON.parse(o))
  if (s)  setSpans(JSON.parse(s))
  if (ht) setHeights(JSON.parse(ht))
}, [])
```

- [ ] **Step 4: Add `BottomResizeHandle` component after the existing `ResizeHandle` component (around line 44)**

```tsx
function BottomResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 8,
        cursor: "ns-resize", zIndex: 9,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseEnter={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h")
        if (p) { p.style.opacity = "1"; p.style.boxShadow = "0 0 6px var(--cyan)" }
      }}
      onMouseLeave={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h")
        if (p) { p.style.opacity = "0.3"; p.style.boxShadow = "none" }
      }}
    >
      <div
        className="resize-pill-h"
        style={{ width: 32, height: 2, borderRadius: 4, background: "var(--cyan)", opacity: 0.3, transition: "opacity 0.15s, box-shadow 0.15s" }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Update `SortableWidget` to accept `height` and `onHeightResizeStart` props**

Replace the existing `SortableWidget` function:

```tsx
function SortableWidget({ id, span = 1, height = 1, onResizeStart, onHeightResizeStart, children }: {
  id: string; span?: number; height?: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onHeightResizeStart: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        position: "relative",
        gridColumn: `span ${span}`,
        gridRow: `span ${height}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div {...attributes} {...listeners} className="drag-handle">⠿</div>
      <div className="widget-slot">
        {children}
      </div>
      <ResizeHandle onMouseDown={onResizeStart} />
      <BottomResizeHandle onMouseDown={onHeightResizeStart} />
    </div>
  )
}
```

- [ ] **Step 6: Add `handleHeightChange` and `handleHeightResizeStart` functions**

Add these after the existing `handleResizeStart` function:

```ts
function handleHeightChange(id: string, newHeight: number) {
  setHeights(prev => {
    const next = { ...prev, [id]: newHeight }
    localStorage.setItem(HEIGHTS_KEY, JSON.stringify(next))
    return next
  })
}

function handleHeightResizeStart(e: React.MouseEvent, id: string) {
  e.preventDefault()
  e.stopPropagation()
  const startY      = e.clientY
  const startHeight = heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1
  function onMove(mv: MouseEvent) {
    const delta = Math.round((mv.clientY - startY) / (ROW_HEIGHT + GRID_GAP))
    handleHeightChange(id, Math.max(MIN_ROWS, Math.min(MAX_ROWS, startHeight + delta)))
  }
  function onUp() {
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}
```

- [ ] **Step 7: Add `gridAutoRows` to the grid container**

Find the grid div (around line 353):
```tsx
<div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
```

Update it to:
```tsx
<div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, gridAutoRows: `${ROW_HEIGHT}px` }}>
```

- [ ] **Step 8: Update the `SortableWidget` render call**

Find the render call (around line 355):
```tsx
<SortableWidget key={id} id={id} span={spans[id] ?? DEFAULT_SPANS[id] ?? 1} onResizeStart={e => handleResizeStart(e, id)}>{widgets[id]}</SortableWidget>
```

Update it to:
```tsx
<SortableWidget
  key={id}
  id={id}
  span={spans[id] ?? DEFAULT_SPANS[id] ?? 1}
  height={heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1}
  onResizeStart={e => handleResizeStart(e, id)}
  onHeightResizeStart={e => handleHeightResizeStart(e, id)}
>
  {widgets[id]}
</SortableWidget>
```

- [ ] **Step 9: Manually verify at http://localhost:3000/productivity**

Check that widgets resize vertically, snap to rows, persist on refresh. Width resize and DnD still work.

- [ ] **Step 10: Commit**

```bash
git add FridayV2/frontend/app/(dashboard)/productivity/page.tsx
git commit -m "feat(productivity): add row-snapped height resize to widgets"
```

---

## Task 4 — Fitness page

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/fitness/page.tsx`

Context: Uses `SortableWidget`. 2-column grid. Chart widgets have hard-coded `height={160}` on `ResponsiveContainer` — leave those unchanged; they'll sit at the top of their grid cell.

- [ ] **Step 1: Add height constants after existing constants (around line 14)**

```ts
const HEIGHTS_KEY   = "heights_fitness"
const ROW_HEIGHT    = 220
const MIN_ROWS      = 1
const MAX_ROWS      = 6

const DEFAULT_HEIGHTS: Record<string, number> = {
  metrics_grid:  1,
  steps_chart:   2,
  sleep_chart:   2,
  hrv_chart:     2,
  battery_chart: 2,
  history_table: 3,
}
```

- [ ] **Step 2: Add heights state to `FitnessPage` component**

Add alongside `const [spans, setSpans] = useState(...)`:

```ts
const [heights, setHeights] = useState<Record<string, number>>(DEFAULT_HEIGHTS)
```

- [ ] **Step 3: Load heights from localStorage in the existing startup `useEffect`**

The existing effect (around line 87) loads `order` and `spans`. Update it:

```ts
useEffect(() => {
  const o  = localStorage.getItem(LAYOUT_KEY)
  const s  = localStorage.getItem(SPANS_KEY)
  const ht = localStorage.getItem(HEIGHTS_KEY)
  if (o)  setOrder(JSON.parse(o))
  if (s)  setSpans(JSON.parse(s))
  if (ht) setHeights(JSON.parse(ht))
}, [])
```

- [ ] **Step 4: Add `BottomResizeHandle` component after the existing `ResizeHandle` component**

```tsx
function BottomResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 8,
        cursor: "ns-resize", zIndex: 9,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseEnter={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h")
        if (p) { p.style.opacity = "1"; p.style.boxShadow = "0 0 6px var(--cyan)" }
      }}
      onMouseLeave={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h")
        if (p) { p.style.opacity = "0.3"; p.style.boxShadow = "none" }
      }}
    >
      <div
        className="resize-pill-h"
        style={{ width: 32, height: 2, borderRadius: 4, background: "var(--cyan)", opacity: 0.3, transition: "opacity 0.15s, box-shadow 0.15s" }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Update `SortableWidget` to accept `height` and `onHeightResizeStart` props**

Replace the existing `SortableWidget` function:

```tsx
function SortableWidget({ id, span = 1, height = 1, onResizeStart, onHeightResizeStart, children }: {
  id: string; span?: number; height?: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onHeightResizeStart: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        position: "relative",
        gridColumn: `span ${span}`,
        gridRow: `span ${height}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div {...attributes} {...listeners} className="drag-handle">⠿</div>
      <div className="widget-slot">
        {children}
      </div>
      <ResizeHandle onMouseDown={onResizeStart} />
      <BottomResizeHandle onMouseDown={onHeightResizeStart} />
    </div>
  )
}
```

- [ ] **Step 6: Add `handleHeightChange` and `handleHeightResizeStart` functions after `handleResizeStart`**

```ts
function handleHeightChange(id: string, newHeight: number) {
  setHeights(prev => {
    const next = { ...prev, [id]: newHeight }
    localStorage.setItem(HEIGHTS_KEY, JSON.stringify(next))
    return next
  })
}

function handleHeightResizeStart(e: React.MouseEvent, id: string) {
  e.preventDefault()
  e.stopPropagation()
  const startY      = e.clientY
  const startHeight = heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1
  function onMove(mv: MouseEvent) {
    const delta = Math.round((mv.clientY - startY) / (ROW_HEIGHT + GRID_GAP))
    handleHeightChange(id, Math.max(MIN_ROWS, Math.min(MAX_ROWS, startHeight + delta)))
  }
  function onUp() {
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}
```

- [ ] **Step 7: Add `gridAutoRows` to the grid container**

Find the grid div (around line 226):
```tsx
<div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
```

Update it to:
```tsx
<div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, gridAutoRows: `${ROW_HEIGHT}px` }}>
```

- [ ] **Step 8: Update the `SortableWidget` render call**

Find the render call (around line 228):
```tsx
<SortableWidget key={id} id={id} span={spans[id] ?? DEFAULT_SPANS[id] ?? 1} onResizeStart={e => handleResizeStart(e, id)}>{widgets[id]}</SortableWidget>
```

Update it to:
```tsx
<SortableWidget
  key={id}
  id={id}
  span={spans[id] ?? DEFAULT_SPANS[id] ?? 1}
  height={heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1}
  onResizeStart={e => handleResizeStart(e, id)}
  onHeightResizeStart={e => handleHeightResizeStart(e, id)}
>
  {widgets[id]}
</SortableWidget>
```

- [ ] **Step 9: Manually verify at http://localhost:3000/fitness**

Check that widgets resize vertically, snap to rows, persist on refresh. Width resize and DnD still work.

- [ ] **Step 10: Commit**

```bash
git add FridayV2/frontend/app/(dashboard)/fitness/page.tsx
git commit -m "feat(fitness): add row-snapped height resize to widgets"
```

---

## Task 5 — Finance page

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/finance/page.tsx`

Context: Uses `SortableWidget`. 2-column grid with tab navigation (overview/savings/fixed/variable). A single `HEIGHTS_KEY` covers all tabs since widget IDs are unique across tabs.

- [ ] **Step 1: Add height constants after existing constants (around line 15)**

```ts
const HEIGHTS_KEY   = "heights_finance"
const ROW_HEIGHT    = 220
const MIN_ROWS      = 1
const MAX_ROWS      = 6

const DEFAULT_HEIGHTS: Record<string, number> = {
  summary:             1,
  spending_breakdown:  2,
  spending_trend:      2,
  spending_frequency:  2,
  savings_trend:       2,
  savings:             2,
  variable_expenses:   3,
  fixed_expenses:      3,
}
```

- [ ] **Step 2: Add heights state to the `FinancePage` component**

Add alongside the spans state initialization:

```ts
const [heights, setHeights] = useState<Record<string, number>>(DEFAULT_HEIGHTS)
```

- [ ] **Step 3: Load heights from localStorage in the existing startup `useEffect`**

The existing effect loads spans. Update it (around line 123):

```ts
useEffect(() => {
  const s  = localStorage.getItem(SPANS_KEY)
  const ht = localStorage.getItem(HEIGHTS_KEY)
  if (s)  setSpans(JSON.parse(s))
  if (ht) setHeights(JSON.parse(ht))
}, [])
```

- [ ] **Step 4: Add `BottomResizeHandle` component after the existing `ResizeHandle` component**

```tsx
function BottomResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 8,
        cursor: "ns-resize", zIndex: 9,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseEnter={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h")
        if (p) { p.style.opacity = "1"; p.style.boxShadow = "0 0 6px var(--cyan)" }
      }}
      onMouseLeave={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h")
        if (p) { p.style.opacity = "0.3"; p.style.boxShadow = "none" }
      }}
    >
      <div
        className="resize-pill-h"
        style={{ width: 32, height: 2, borderRadius: 4, background: "var(--cyan)", opacity: 0.3, transition: "opacity 0.15s, box-shadow 0.15s" }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Update `SortableWidget` to accept `height` and `onHeightResizeStart` props**

Replace the existing `SortableWidget` function (around line 63):

```tsx
function SortableWidget({ id, span = 1, height = 1, onResizeStart, onHeightResizeStart, children }: {
  id: string; span?: number; height?: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onHeightResizeStart: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        position: "relative",
        gridColumn: `span ${span}`,
        gridRow: `span ${height}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div {...attributes} {...listeners} className="drag-handle">⠿</div>
      <div className="widget-slot">
        {children}
      </div>
      <ResizeHandle onMouseDown={onResizeStart} />
      <BottomResizeHandle onMouseDown={onHeightResizeStart} />
    </div>
  )
}
```

- [ ] **Step 6: Add `handleHeightChange` and `handleHeightResizeStart` functions after `handleResizeStart`**

```ts
function handleHeightChange(id: string, newHeight: number) {
  setHeights(prev => {
    const next = { ...prev, [id]: newHeight }
    localStorage.setItem(HEIGHTS_KEY, JSON.stringify(next))
    return next
  })
}

function handleHeightResizeStart(e: React.MouseEvent, id: string) {
  e.preventDefault()
  e.stopPropagation()
  const startY      = e.clientY
  const startHeight = heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1
  function onMove(mv: MouseEvent) {
    const delta = Math.round((mv.clientY - startY) / (ROW_HEIGHT + GRID_GAP))
    handleHeightChange(id, Math.max(MIN_ROWS, Math.min(MAX_ROWS, startHeight + delta)))
  }
  function onUp() {
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}
```

- [ ] **Step 7: Add `gridAutoRows` to the grid container**

Find the grid div (around line 658):
```tsx
<div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
```

Update it to:
```tsx
<div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, gridAutoRows: `${ROW_HEIGHT}px` }}>
```

- [ ] **Step 8: Update the `SortableWidget` render call**

Find the render call (around line 660):
```tsx
<SortableWidget key={id} id={id} span={spans[id] ?? DEFAULT_SPANS[id] ?? 1} onResizeStart={e => handleResizeStart(e, id)}>{widgets[id]}</SortableWidget>
```

Update it to:
```tsx
<SortableWidget
  key={id}
  id={id}
  span={spans[id] ?? DEFAULT_SPANS[id] ?? 1}
  height={heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1}
  onResizeStart={e => handleResizeStart(e, id)}
  onHeightResizeStart={e => handleHeightResizeStart(e, id)}
>
  {widgets[id]}
</SortableWidget>
```

- [ ] **Step 9: Manually verify at http://localhost:3000/finance**

Switch between tabs. Check that widgets resize vertically, snap to rows, persist on refresh across tab switches.

- [ ] **Step 10: Commit**

```bash
git add FridayV2/frontend/app/(dashboard)/finance/page.tsx
git commit -m "feat(finance): add row-snapped height resize to widgets"
```

---

## Final Verification Checklist

- [ ] All 4 pages: bottom drag handle visible on hover, snaps height in row increments
- [ ] All 4 pages: heights persist on page refresh (localStorage)
- [ ] All 4 pages: existing width resize (right handle) unaffected
- [ ] All 4 pages: DnD reorder (where applicable) unaffected
- [ ] Overview: Widget content scrolls when taller than grid cell
- [ ] Finance: heights persist when switching between tabs
- [ ] Min 1 row enforced (can't drag above 1 row)
- [ ] Max 6 rows enforced (can't drag beyond 6 rows)
