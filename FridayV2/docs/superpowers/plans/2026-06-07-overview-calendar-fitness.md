# Overview Calendar Widget + Fitness Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "Upcoming Events" to "Calendar", add month navigation with per-month event fetching, and remove Body Battery from Fitness Snapshot.

**Architecture:** All changes are in a single file (`overview/page.tsx`). `calYear`/`calMonth` derived constants become `viewYear`/`viewMonth` React state. A new `fetchCalendarMonth` callback replaces the inline calendar fetch inside `load()` and re-runs whenever the view month changes via a dedicated `useEffect`. The widget title and event list JSX are updated to reflect the viewed month.

**Tech Stack:** TypeScript, React (`useState`, `useCallback`, `useEffect`), Next.js

---

### Task 1: Remove Body Battery from Fitness Snapshot

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/overview/page.tsx`

- [ ] **Step 1: Update the Supabase select query**

Find this line (around line 236):

```ts
.select("steps,sleep_duration_min,body_battery_high,hrv_score")
```

Replace with:

```ts
.select("steps,sleep_duration_min,hrv_score")
```

- [ ] **Step 2: Remove Body Battery from the metrics array**

Find the `fitness_snapshot` widget metrics array (around line 377):

```ts
{[
  { label: "Steps",        value: fitness.steps?.toLocaleString(),                         unit: "" },
  { label: "Sleep",        value: sleepH !== null ? `${sleepH}h ${sleepM}m` : null,        unit: "" },
  { label: "Body Battery", value: fitness.body_battery_high,                               unit: "%" },
  { label: "HRV",          value: fitness.hrv_score,                                       unit: "ms" },
].map(({ label, value, unit }) => (
```

Replace with:

```ts
{[
  { label: "Steps", value: fitness.steps?.toLocaleString(),                  unit: "" },
  { label: "Sleep", value: sleepH !== null ? `${sleepH}h ${sleepM}m` : null, unit: "" },
  { label: "HRV",   value: fitness.hrv_score,                                unit: "ms" },
].map(({ label, value, unit }) => (
```

The `1fr 1fr` grid is unchanged — Steps and Sleep fill row 1, HRV sits in row 2 left.

- [ ] **Step 3: Run the build**

```bash
cd FridayV2/frontend
npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/overview/page.tsx
git commit -m "feat(overview): remove Body Battery from Fitness Snapshot

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add view-month state

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/overview/page.tsx`

- [ ] **Step 1: Add viewYear and viewMonth state**

The component already has a block of `useState` declarations (lines 183–202). Add these two **with the existing state declarations** (before `const now = new Date()`):

```ts
const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear());
const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
```

- [ ] **Step 2: Remove the old derived constants**

Find and delete these two lines (around line 208):

```ts
const calYear  = now.getFullYear();
const calMonth = now.getMonth();
```

`todayStr` stays — it is still used for highlighting today's date.

- [ ] **Step 3: Run the build**

```bash
npm run build
```

Expected: TypeScript errors for `calYear`/`calMonth` not found — that is expected and will be fixed in the next tasks.

---

### Task 3: Add fetchCalendarMonth, prevMonth, nextMonth

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/overview/page.tsx`

- [ ] **Step 1: Add fetchCalendarMonth callback**

Add this after the existing `load` callback (around line 252):

```ts
const fetchCalendarMonth = useCallback(async (year: number, month: number) => {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  try {
    const c = await apiFetch<CalEvent[]>(`/calendar?month=${ym}`);
    setEvents(c);
  } catch { /* offline */ }
}, []);
```

- [ ] **Step 2: Replace the inline calendar fetch inside load() with fetchCalendarMonth**

Inside `load()`, find:

```ts
const ym  = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
try { const c = await apiFetch<CalEvent[]>(`/calendar?month=${ym}`); setEvents(c); } catch { /* offline */ }
```

Remove those two lines entirely. Also remove the `const n = new Date()` line above them if it is only used for `ym` (check — if `n` is used elsewhere in `load()`, keep it; otherwise delete it).

- [ ] **Step 3: Add a useEffect that fetches the correct month whenever viewYear/viewMonth change**

Add this after the `useEffect(() => { load(); }, [load])` line:

```ts
useEffect(() => {
  fetchCalendarMonth(viewYear, viewMonth);
}, [viewYear, viewMonth, fetchCalendarMonth]);
```

- [ ] **Step 4: Add prevMonth and nextMonth handlers**

Add these two functions alongside the other handlers (e.g. after `completeTask`):

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

- [ ] **Step 5: Run the build**

```bash
npm run build
```

Expected: errors for `calYear`/`calMonth` still used in JSX — will be fixed in the next task.

---

### Task 4: Update calendar helpers and event list logic

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/overview/page.tsx`

- [ ] **Step 1: Update the calendar helpers block**

Find this section (around line 352):

```ts
const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
const firstWeekday = new Date(calYear, calMonth, 1).getDay();
const eventDates   = new Set(events.map(e => e.start.slice(0, 10)));
const upcomingEvents = events
  .filter(e => e.start.slice(0, 10) >= todayStr)
  .sort((a, b) => a.start.localeCompare(b.start))
  .slice(0, 5);
```

Replace with:

```ts
const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
const eventDates   = new Set(events.map(e => e.start.slice(0, 10)));

const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
const visibleEvents = events
  .filter(e => isCurrentMonth ? e.start.slice(0, 10) >= todayStr : true)
  .sort((a, b) => a.start.localeCompare(b.start));
```

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: 0 TypeScript errors. All `calYear`/`calMonth` references are gone; JSX errors from the next task are fine at this point (widget JSX not yet updated).

---

### Task 5: Update Calendar widget JSX

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/overview/page.tsx`

- [ ] **Step 1: Rename the widget title**

Find:

```ts
<Widget title="◷ Upcoming Events" accent="var(--violet)">
```

Replace with:

```ts
<Widget title="◷ Calendar" accent="var(--violet)">
```

- [ ] **Step 2: Add month nav bar above the day-of-week row**

Inside the `upcoming_events` widget, find the opening of the left column (the mini calendar):

```tsx
<div style={{ flexShrink: 0, width: 200 }}>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
    {["Su", "Mo", ...
```

Add the month nav bar **above** that first `<div style={{ display: "grid"...`:

```tsx
<div style={{ flexShrink: 0, width: 200 }}>
  {/* Month nav bar */}
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
    <button
      onClick={prevMonth}
      style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px", transition: "color 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.color = "var(--cyan)")}
      onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
    >‹</button>
    <span style={{ fontFamily: "var(--font-space)", fontSize: 11, fontWeight: 600, color: "var(--text-2)", letterSpacing: "0.04em" }}>
      {new Date(viewYear, viewMonth).toLocaleDateString("en-SG", { month: "long", year: "numeric" })}
    </span>
    <button
      onClick={nextMonth}
      style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px", transition: "color 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.color = "var(--cyan)")}
      onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
    >›</button>
  </div>

  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
    {["Su", "Mo", ...
```

- [ ] **Step 3: Update the right-panel event list**

Find the right panel section:

```tsx
{/* Right: Upcoming event list */}
<div style={{ flex: 1, minWidth: 0 }}>
  {upcomingEvents.length > 0 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {upcomingEvents.map(e => (
```

Replace with:

```tsx
{/* Right: Event list for viewed month */}
<div style={{ flex: 1, minWidth: 0 }}>
  {visibleEvents.length > 0 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {visibleEvents.map(e => (
```

Also update the empty-state message:

```tsx
// From:
<p style={{ color: "var(--text-3)", fontSize: 13 }}>No upcoming events this month.</p>

// To:
<p style={{ color: "var(--text-3)", fontSize: 13 }}>
  No events in {new Date(viewYear, viewMonth).toLocaleDateString("en-SG", { month: "long" })}.
</p>
```

- [ ] **Step 4: Run the build**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 5: Visual check**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
- Widget title reads "◷ Calendar"
- Month nav bar shows e.g. "June 2026" with `‹` and `›` buttons
- Click `‹` — mini calendar updates to May, right panel shows May events (fetched from API)
- Click `›` twice — shows July 2026
- Return to June — today's date is highlighted with cyan border, events from today onward shown
- Fitness Snapshot shows only Steps, Sleep, HRV (no Body Battery row)

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/overview/page.tsx
git commit -m "feat(overview): Calendar widget with month navigation, remove Body Battery

- Rename Upcoming Events → Calendar
- Add viewYear/viewMonth state with prev/next month nav buttons
- fetchCalendarMonth fetches events per viewed month; separated from load()
- Current month shows events from today; other months show all events
- Remove Body Battery from Fitness Snapshot

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
