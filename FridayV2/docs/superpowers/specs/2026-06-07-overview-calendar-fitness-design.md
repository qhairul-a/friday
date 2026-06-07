# Overview Page: Calendar Widget + Fitness Snapshot — Design

**Date:** 2026-06-07
**Status:** Approved

## Goals

1. Rename "Upcoming Events" widget to "Calendar" and add month navigation.
2. Remove Body Battery from the Fitness Snapshot widget.

## Scope

Frontend only. One file: `FridayV2/frontend/app/(dashboard)/overview/page.tsx`.

---

## Change 1 — Calendar Widget

### Rename

Widget title changes from `"◷ Upcoming Events"` to `"◷ Calendar"`. The widget ID in layout state (`upcoming_events`) and `DEFAULT_ORDER`/`DEFAULT_SPANS`/`DEFAULT_HEIGHTS` keys stay unchanged to preserve saved user layouts.

### Month navigation state

Replace the derived constants:

```ts
const calYear  = now.getFullYear();
const calMonth = now.getMonth();
```

With state:

```ts
const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear());
const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
```

### Month navigation handlers

```ts
function prevMonth() {
  if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
  else { setViewMonth(m => m - 1); }
}
function nextMonth() {
  if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
  else { setViewMonth(m => m + 1); }
}
```

### Calendar fetch — separated from load()

A new `fetchCalendarMonth(year, month)` function fetches only the calendar endpoint and updates `events`. It is called on mount (replacing the inline call inside `load()`) and whenever `viewYear`/`viewMonth` change:

```ts
const fetchCalendarMonth = useCallback(async (year: number, month: number) => {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  try { const c = await apiFetch<CalEvent[]>(`/calendar?month=${ym}`); setEvents(c); } catch { /* offline */ }
}, []);

useEffect(() => { fetchCalendarMonth(viewYear, viewMonth); }, [viewYear, viewMonth, fetchCalendarMonth]);
```

`load()` keeps all other fetches (tasks, routines, last expense, fitness) but no longer fetches calendar events.

### Mini calendar grid

The existing day grid renders using `viewYear`/`viewMonth` instead of the old derived constants:

```ts
const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
const eventDates   = new Set(events.map(e => e.start.slice(0, 10)));
```

Above the day-of-week header row, add a month nav bar:

```tsx
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
  <button onClick={prevMonth}>‹</button>
  <span>{new Date(viewYear, viewMonth).toLocaleDateString("en-SG", { month: "long", year: "numeric" })}</span>
  <button onClick={nextMonth}>›</button>
</div>
```

Buttons styled subtly (transparent background, `var(--text-3)` colour, hover brightens to `var(--cyan)`).

### Event list (right panel)

Show all events in the viewed month, sorted chronologically. When viewing the current month, filter from today onward (preserve existing "upcoming" behaviour). When viewing any other month, show all events in that month.

```ts
const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
const visibleEvents = events
  .filter(e => isCurrentMonth ? e.start.slice(0, 10) >= todayStr : true)
  .sort((a, b) => a.start.localeCompare(b.start));
```

Right panel section label becomes the viewed month name (e.g. "June") instead of a hardcoded string.

---

## Change 2 — Fitness Snapshot: Remove Body Battery

Remove the Body Battery entry from the metrics array:

```ts
// Remove this line:
{ label: "Body Battery", value: fitness.body_battery_high, unit: "%" },
```

The remaining three metrics (Steps, Sleep, HRV) display in a 3-column grid or keep the 2-column layout with the last cell spanning — preference is to keep `gridTemplateColumns: "1fr 1fr"` and let Steps + Sleep sit on row 1, HRV on row 2 left (cell spans naturally).

Also remove `body_battery_high` from the Supabase select query:

```ts
.select("steps,sleep_duration_min,hrv_score")
```

---

## Data flow summary

```
viewYear / viewMonth state
        │
        ▼
fetchCalendarMonth(year, month)  ──► GET /calendar?month=YYYY-MM  ──► setEvents()
                                                                         │
                                                              mini calendar grid + event list
```

All other widget data (tasks, routines, last expense, fitness) continues to load once on mount via `load()`.
