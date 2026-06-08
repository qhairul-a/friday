# Widget Height Resize — Design Spec
Date: 2026-06-05

## Overview

Add row-snapped height adjustment to all widgets across the four FridayV2 dashboard pages (Overview, Productivity, Fitness, Finance). Height behaves exactly like width: stored as an integer row count, persisted in localStorage, adjusted via a bottom drag handle that snaps to row units.

## Scope

**Pages affected:** `app/(dashboard)/overview/page.tsx`, `app/(dashboard)/productivity/page.tsx`, `app/(dashboard)/fitness/page.tsx`, `app/(dashboard)/finance/page.tsx`

**Out of scope:** `friday-dashboard` (legacy app), mobile layout, shared-component refactor.

## Constants

Each page gains two new constants alongside its existing `NUM_COLS` / `GRID_GAP`:

```ts
const ROW_HEIGHT = 220   // px — one row unit
const MIN_ROWS   = 1
const MAX_ROWS   = 6
```

## State & Persistence

Each page gains:

```ts
const HEIGHTS_KEY = "heights_<page>"   // e.g. "heights_overview_v2"

const DEFAULT_HEIGHTS: Record<string, number> = { /* per-widget defaults below */ }

const [heights, setHeights] = useState<Record<string, number>>(DEFAULT_HEIGHTS)
```

Loaded from localStorage on mount (same pattern as `spans`):

```ts
useEffect(() => {
  const h = localStorage.getItem(HEIGHTS_KEY)
  if (h) setHeights(JSON.parse(h))
}, [])
```

### Default heights per page

| Page | Widget | Default rows |
|------|--------|-------------|
| Overview | upcoming_events | 2 |
| Overview | world_clock | 1 |
| Overview | tasks_due | 1 |
| Overview | routines | 1 |
| Overview | fitness_snapshot | 1 |
| Overview | last_expense | 1 |
| Productivity | tasks | 2 |
| Productivity | routines | 2 |
| Productivity | calendar | 2 |
| Fitness | metrics_grid | 1 |
| Fitness | steps_chart | 2 |
| Fitness | sleep_chart | 2 |
| Fitness | hrv_chart | 2 |
| Fitness | battery_chart | 2 |
| Fitness | history_table | 3 |
| Finance | summary | 1 |
| Finance | spending_breakdown | 2 |
| Finance | spending_trend | 2 |
| Finance | spending_frequency | 2 |
| Finance | savings_trend | 2 |
| Finance | savings | 2 |
| Finance | variable_expenses | 3 |
| Finance | fixed_expenses | 3 |

## Grid Container

Each page's outer grid div gains `gridAutoRows`:

```tsx
// before
style={{ display: "grid", gridTemplateColumns: "repeat(N, 1fr)", gap: 20 }}

// after
style={{ display: "grid", gridTemplateColumns: "repeat(N, 1fr)", gap: 20, gridAutoRows: `${ROW_HEIGHT}px` }}
```

## SortableCard / SortableWidget Changes

Each page's sortable wrapper component gains a `height` prop and applies `gridRow: span N`:

```tsx
function SortableCard({ id, span = 3, height = 1, onResizeStart, onHeightResizeStart, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        gridColumn: `span ${span}`,
        gridRow: `span ${height}`,
      }}
    >
      <div {...attributes} {...listeners} className="drag-handle">⠿</div>
      {children}
      <ResizeHandle onMouseDown={onResizeStart} />
      <BottomResizeHandle onMouseDown={onHeightResizeStart} />
    </div>
  )
}
```

## BottomResizeHandle Component

Positioned at the bottom of each card. Mirrors `ResizeHandle` on the vertical axis:

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

## Height Resize Logic

Two new functions added to each page alongside the existing `handleSpanChange` / `handleResizeStart`:

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

## Widget Content Overflow

The `Widget` component in each page updates its inner layout so content scrolls within the fixed height rather than overflowing:

```tsx
// Widget glass div — add height + flex column
style={{ ..., height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}

// Content area (wraps `children`) — new div
<div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
  {children}
</div>
```

The title/label row remains fixed at the top; the content area scrolls independently.

## Render Changes

Each page's widget render call gains the `height` and `onHeightResizeStart` props:

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

## Data Flow

```
drag bottom handle
  → handleHeightResizeStart captures startY + startHeight
  → mousemove: delta = round(deltaY / (ROW_HEIGHT + GAP))
  → handleHeightChange clamps to [MIN_ROWS, MAX_ROWS]
  → heights state updated → gridRow: span N re-renders
  → localStorage[HEIGHTS_KEY] updated
```

## Error Handling

- Corrupt localStorage values (non-JSON) fall back to `DEFAULT_HEIGHTS` — same `try/catch` pattern as `spans`.
- `Math.max(MIN_ROWS, Math.min(MAX_ROWS, ...))` clamps out-of-range values from old persisted state.

## Testing Checklist

- [ ] Drag bottom handle on each of the 4 pages — height snaps correctly
- [ ] Heights persist on page refresh
- [ ] Width resize (existing) unaffected
- [ ] Drag-to-sort (DnD) unaffected
- [ ] Content scrolls inside a short widget without overflowing the card border
- [ ] Min (1 row) and max (6 rows) bounds enforced
- [ ] Two widgets side-by-side at the same row count align vertically
