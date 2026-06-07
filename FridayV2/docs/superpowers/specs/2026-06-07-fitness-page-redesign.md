# Fitness Page Redesign — Design Spec

## Overview

Six changes to the Fitness dashboard:
1. Remove the 7-day history table widget and Body Battery chart widget
2. Add a new Stress Average widget (line + 7-day personal average reference line)
3. Debug and fix Garmin sync for resting_hr, hrv_score, and vo2max
4. Sleep Duration widget: stacked bar chart (Deep / Light / REM) replacing the single sleep-hours line
5. Heart Rate widget: resting HR line + 7-day average reference line, replacing the HRV line chart
6. Step Count widget: bar chart with Week / Month toggle, replacing the steps line chart

All frontend changes are in a single file: `FridayV2/frontend/app/(dashboard)/fitness/page.tsx`.  
Backend changes are in `FridayV2/backend/integrations/garmin.py` and `FridayV2/backend/integrations/fitness.py`.

---

## 1. Remove Battery + History Widgets

**Widgets removed:**
- `battery_chart` — "Body Battery Peak — 7 days"
- `history_table` — "7-day History"

**What changes:**
- Remove both IDs from `DEFAULT_ORDER`, `DEFAULT_SPANS`, `DEFAULT_HEIGHTS`
- Delete their entries from the `widgets` object
- Remove `battery` field from `chartData` mapping (no longer consumed)

**New DEFAULT_ORDER:**
```ts
["metrics_grid", "steps_chart", "sleep_chart", "hrv_chart", "stress_chart"]
```

**New DEFAULT_SPANS:**
```ts
{ metrics_grid: 2, steps_chart: 2, sleep_chart: 1, hrv_chart: 1, stress_chart: 2 }
```

**New DEFAULT_HEIGHTS:**
```ts
{ metrics_grid: 220, steps_chart: 440, sleep_chart: 440, hrv_chart: 440, stress_chart: 440 }
```

---

## 2. Add Stress Average Widget (`stress_chart`)

**New widget** rendered as a `LineChart` from recharts.

**Data:** `stress_avg` field, already in `FitnessRow` and returned by `select("*")`.

**chartData** gets one new field:
```ts
stress: r.stress_avg,
```

**Reference line:** Computed in the component render:
```ts
const stressAvg = chartData.filter(d => d.stress != null).length
  ? Math.round(chartData.reduce((s, d) => s + (d.stress ?? 0), 0) / chartData.filter(d => d.stress != null).length)
  : null;
```

**Widget JSX structure:**
- `LineChart` with `Line` for `stress` (color `#fb923c`)
- `ReferenceLine` at `y={stressAvg}` with `stroke="rgba(251,146,60,0.4)"` and `strokeDasharray="4 4"` — labeled "avg"
- Standard `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`
- Widget title: `"◎ Stress Average"`

**New recharts imports needed:** `ReferenceLine` (added to existing import)

---

## 3. Sleep Duration Widget (ID: `sleep_chart`)

**Replace** the `<ChartCard>` with a custom `BarChart` showing stacked sleep stages.

**New chartData fields:**
```ts
sleepDeep:  r.sleep_deep_min,
sleepLight: r.sleep_light_min,
sleepRem:   r.sleep_rem_min,
```

**Widget JSX structure:**
- `BarChart` with three `Bar` components, `stackId="sleep"`:
  - Deep: `dataKey="sleepDeep"` fill `#7c3aed`
  - Light: `dataKey="sleepLight"` fill `#a855f7`
  - REM: `dataKey="sleepRem"` fill `#c084fc`
- `XAxis dataKey="date"`, `YAxis` with tick formatter `v => v + "m"`
- Inline legend row below chart: Deep / Light / REM color swatches
- Widget title: `"◑ Sleep Duration"`

**New recharts imports needed:** `BarChart, Bar` (added to existing import)

---

## 4. Heart Rate Widget (ID: `hrv_chart`)

**Replace** the `<ChartCard hrv>` with a custom `LineChart` showing resting HR.

**New chartData field:**
```ts
resting_hr: r.resting_hr,
```

**Reference line:** Computed in the component render:
```ts
const hrAvg = chartData.filter(d => d.resting_hr != null).length
  ? Math.round(chartData.reduce((s, d) => s + (d.resting_hr ?? 0), 0) / chartData.filter(d => d.resting_hr != null).length)
  : null;
```

**Widget JSX structure:**
- `LineChart` with `Line` for `resting_hr` (color `#f87171`)
- `ReferenceLine` at `y={hrAvg}` with `stroke="rgba(248,113,113,0.4)"` and `strokeDasharray="4 4"` — labeled "avg"
- `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`
- Widget title: `"♡ Heart Rate"`

`ReferenceLine` is already imported for the Stress widget — no new import needed here.

---

## 5. Step Count Widget (ID: `steps_chart`)

**Replace** the `<ChartCard steps>` with a custom `BarChart` plus Week / Month toggle.

**New state:**
```ts
const [stepView,   setStepView]   = useState<"week" | "month">("week");
const [monthSteps, setMonthSteps] = useState<FitnessRow[]>([]);
```

**Month fetch** — triggered only when the user switches to "month":
```ts
async function loadMonthSteps() {
  const from = new Date(); from.setDate(from.getDate() - 29);
  const { data } = await supabase.from("fitness_daily")
    .select("date,steps")
    .gte("date", from.toISOString().slice(0, 10))
    .order("date", { ascending: true });
  if (data) setMonthSteps(data as FitnessRow[]);
}
```

Called on toggle button click:
```ts
onClick={() => { setStepView("month"); if (monthSteps.length === 0) loadMonthSteps(); }}
```

**Chart data source:**
```ts
const stepData = stepView === "week"
  ? chartData.map(d => ({ date: d.date, steps: d.steps }))
  : monthSteps.map(r => ({ date: r.date.slice(5), steps: r.steps }));
```

**Widget JSX structure:**
- Toggle row: `Week | Month` buttons (active = cyan tint, inactive = dim)
- `BarChart` with single `Bar dataKey="steps"` fill `"var(--cyan)"` opacity `0.8`
- `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`
- Widget title: `"⬡ Step Count"`

`BarChart` and `Bar` are already imported for the Sleep widget — no new import needed here.

---

## 6. Backend: Debug Garmin Sync for resting_hr / hrv_score / vo2max

The backend already calls `fetch_resting_hr`, `fetch_hrv`, and `fetch_vo2max` inside `sync_today()` and writes them to Supabase. The data shows as null, indicating the API calls are silently failing (the `_safe` wrapper swallows all exceptions with just a `logger.warning`).

**Fix approach:**
1. Add `logger.debug` lines after each fetch in `sync_today()` to print the raw return value
2. Run `sync_today()` manually (call `/fitness/sync` POST from the browser or curl)
3. Check terminal logs to see which fetcher returns `{}`
4. For each failing fetcher, add a temporary `print(raw)` before the `return {}` in `garmin.py` to inspect the actual Garmin API response
5. Fix the field extraction to match the actual response shape

**Most likely culprits:**
- `fetch_resting_hr`: The key path `allMetrics.metricsMap.WELLNESS_RESTING_HEART_RATE` is fragile — Garmin may return the value at a different path or under a different key
- `fetch_vo2max`: `vo2MaxPreciseValue` may not be present; there may be an alternative field like `vo2Max`
- `fetch_hrv`: `hrvSummary.lastNight` may be `None` for same-day syncs (HRV is computed overnight)

**No Supabase schema changes needed** — all three columns already exist in `fitness_daily`.

---

## Architecture Summary

| Layer | File | Change type |
|-------|------|-------------|
| Frontend | `fitness/page.tsx` | Widget overhaul (remove 2, add 1, rewrite 3) |
| Frontend | `fitness/page.tsx` | New recharts imports: `BarChart`, `Bar`, `ReferenceLine` |
| Frontend | `fitness/page.tsx` | New state: `stepView`, `monthSteps` |
| Backend | `garmin.py` | Debug logging + field extraction fix |
| Backend | `fitness.py` | Debug logging in `sync_today()` |

Widget IDs are preserved (`steps_chart`, `sleep_chart`, `hrv_chart`) so existing localStorage layouts remain valid. Only `battery_chart` and `history_table` are removed — users with those in their saved layout will have them silently dropped on next load (the `widgets[id]` lookup returns `undefined`, which React skips).
