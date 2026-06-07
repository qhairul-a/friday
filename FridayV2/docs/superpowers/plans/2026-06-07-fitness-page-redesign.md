# Fitness Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Fitness dashboard — remove 2 widgets, add Stress Average, rewrite 3 chart widgets (Sleep as stacked bar, Heart Rate as resting-HR line, Steps as bar with week/month toggle), and fix silent Garmin sync failures for resting_hr/hrv_score/vo2max.

**Architecture:** All frontend changes are in one file (`fitness/page.tsx`). New recharts primitives (`BarChart`, `Bar`, `ReferenceLine`) are added to the existing import. The `chartData` array gains `sleepDeep`, `sleepLight`, `sleepRem`, `resting_hr`, `stress` fields and loses `battery`. Step Count month data is fetched on demand into a separate `monthSteps` state. Backend adds `logger.debug` calls to `garmin.py` and `fitness.py` to surface silent failures, then fixes any broken field extractions based on the actual Garmin API responses.

**Tech Stack:** TypeScript, React (`useState`, `useCallback`, `useEffect`), Next.js 15, recharts, Supabase JS client, Python / `garminconnect` library

---

### Task 1: Remove battery_chart and history_table

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/fitness/page.tsx:15-29`

- [ ] **Step 1: Update DEFAULT_ORDER, DEFAULT_SPANS, DEFAULT_HEIGHTS**

Find these three constants (lines 15–29):

```ts
const DEFAULT_ORDER = ["metrics_grid", "steps_chart", "sleep_chart", "hrv_chart", "battery_chart", "history_table"];
const DEFAULT_SPANS: Record<string, number> = { metrics_grid: 2, steps_chart: 2, sleep_chart: 1, hrv_chart: 1, battery_chart: 1, history_table: 2 };

const DEFAULT_HEIGHTS: Record<string, number> = {
  metrics_grid:  220,
  steps_chart:   440,
  sleep_chart:   440,
  hrv_chart:     440,
  battery_chart: 440,
  history_table: 660,
};
```

Replace with:

```ts
const DEFAULT_ORDER = ["metrics_grid", "steps_chart", "sleep_chart", "hrv_chart", "stress_chart"];
const DEFAULT_SPANS: Record<string, number> = { metrics_grid: 2, steps_chart: 2, sleep_chart: 1, hrv_chart: 1, stress_chart: 2 };

const DEFAULT_HEIGHTS: Record<string, number> = {
  metrics_grid: 220,
  steps_chart:  440,
  sleep_chart:  440,
  hrv_chart:    440,
  stress_chart: 440,
};
```

- [ ] **Step 2: Delete battery_chart and history_table from the widgets object**

Find the `battery_chart` entry in the `widgets` object (around line 272):

```ts
    battery_chart: <ChartCard title="◉ Body Battery Peak — 7 days" color="var(--orange)" data={chartData} dataKey="battery" />,
    history_table: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>◈ 7-day History</div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Steps</th><th>Sleep</th><th>HRV</th><th>Battery</th><th>Stress</th></tr></thead>
            <tbody>
              {history.map(r => (
                <tr key={r.date}>
                  <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>{r.date}</td>
                  <td style={{ textAlign: "right" }}>{r.steps?.toLocaleString() ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{r.sleep_duration_min ? `${Math.floor(r.sleep_duration_min/60)}h${r.sleep_duration_min%60}m` : "—"}</td>
                  <td style={{ textAlign: "right", color: "var(--cyan)" }}>{r.hrv_score ?? "—"}</td>
                  <td style={{ textAlign: "right", color: "var(--orange)" }}>{r.body_battery_high ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{r.stress_avg ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
```

Delete both entries entirely.

- [ ] **Step 3: Commit**

```bash
cd FridayV2/frontend
git add app/\(dashboard\)/fitness/page.tsx
git commit -m "feat(fitness): remove battery and history table widgets

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Update recharts imports and chartData

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/fitness/page.tsx:6` (imports)
- Modify: `FridayV2/frontend/app/(dashboard)/fitness/page.tsx` (`chartData` mapping)

- [ ] **Step 1: Update recharts import**

Find (line 6):

```ts
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
```

Replace with:

```ts
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
```

- [ ] **Step 2: Update chartData**

Find (around line 236):

```ts
  const chartData = history.map(r => ({
    date: r.date.slice(5),
    steps: r.steps,
    sleep: r.sleep_duration_min ? Math.round(r.sleep_duration_min / 6) / 10 : null,
    hrv: r.hrv_score,
    battery: r.body_battery_high,
  }));
```

Replace with:

```ts
  const chartData = history.map(r => ({
    date:       r.date.slice(5),
    steps:      r.steps,
    sleepDeep:  r.sleep_deep_min,
    sleepLight: r.sleep_light_min,
    sleepRem:   r.sleep_rem_min,
    resting_hr: r.resting_hr,
    stress:     r.stress_avg,
  }));
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd FridayV2/frontend
npx tsc --noEmit
```

Expected: Errors referencing `battery`, `hrv`, `sleep` dataKeys in the old `ChartCard` widgets — those will be fixed in the next tasks. Errors about `BarChart`, `Bar`, `ReferenceLine` should NOT appear (they're now imported).

---

### Task 3: Add stepView state + loadMonthSteps + rewrite steps_chart

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/fitness/page.tsx`

- [ ] **Step 1: Add stepView and monthSteps state**

Find the existing state declarations block (around line 138–143):

```ts
  const [today, setToday] = useState<FitnessRow | null>(null);
  const [history, setHistory] = useState<FitnessRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [spans, setSpans] = useState<Record<string, number>>(DEFAULT_SPANS);
  const [heights, setHeights] = useState<Record<string, number>>(DEFAULT_HEIGHTS);
```

Add two new lines immediately after the `syncing` line:

```ts
  const [today, setToday] = useState<FitnessRow | null>(null);
  const [history, setHistory] = useState<FitnessRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [stepView,   setStepView]   = useState<"week" | "month">("week");
  const [monthSteps, setMonthSteps] = useState<FitnessRow[]>([]);
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [spans, setSpans] = useState<Record<string, number>>(DEFAULT_SPANS);
  const [heights, setHeights] = useState<Record<string, number>>(DEFAULT_HEIGHTS);
```

- [ ] **Step 2: Add loadMonthSteps function**

Find the `sync` function (around line 163):

```ts
  async function sync() {
    setSyncing(true);
    try { await apiFetch("/fitness/sync", { method: "POST" }); await load(); } catch { /* ignore */ }
    setSyncing(false);
  }
```

Add `loadMonthSteps` immediately after `sync`:

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

- [ ] **Step 3: Add stepData derived value**

Find the `chartData` block (just updated in Task 2). Add `stepData` directly below it:

```ts
  const stepData = stepView === "week"
    ? chartData.map(d => ({ date: d.date, steps: d.steps }))
    : monthSteps.map(r => ({ date: r.date.slice(5), steps: r.steps }));
```

- [ ] **Step 4: Rewrite steps_chart widget**

Find the current `steps_chart` entry in the `widgets` object:

```ts
    steps_chart:   <ChartCard title="⬡ Steps — 7 days"             color="var(--cyan)"   data={chartData} dataKey="steps" />,
```

Replace with:

```tsx
    steps_chart: (
      <div className="glass" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="label-cyan">⬡ Step Count</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["week", "month"] as const).map(v => (
              <button
                key={v}
                onClick={() => { setStepView(v); if (v === "month" && monthSteps.length === 0) loadMonthSteps(); }}
                style={{
                  padding: "3px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                  border: "1px solid",
                  borderColor: stepView === v ? "var(--cyan)" : "rgba(255,255,255,0.15)",
                  background:  stepView === v ? "rgba(34,211,238,0.15)" : "transparent",
                  color:       stepView === v ? "var(--cyan)" : "var(--text-3)",
                }}
              >
                {v === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stepData}>
            <CartesianGrid strokeDasharray="2 6" stroke="rgba(34,211,238,0.06)" />
            <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11 }} />
            <Bar dataKey="steps" fill="var(--cyan)" opacity={0.8} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ),
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors for the `steps_chart` widget. Remaining errors for `sleep_chart`, `hrv_chart` old `ChartCard` refs are fine — fixed in the next tasks.

---

### Task 4: Rewrite sleep_chart as stacked bar

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/fitness/page.tsx`

- [ ] **Step 1: Replace sleep_chart widget**

Find the current `sleep_chart` entry:

```ts
    sleep_chart:   <ChartCard title="◑ Sleep — 7 days (hrs)"       color="var(--violet)" data={chartData} dataKey="sleep" />,
```

Replace with:

```tsx
    sleep_chart: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>◑ Sleep Duration</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="2 6" stroke="rgba(34,211,238,0.06)" />
            <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => `${v}m`} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11 }} />
            <Bar dataKey="sleepDeep"  stackId="sleep" fill="#7c3aed" />
            <Bar dataKey="sleepLight" stackId="sleep" fill="#a855f7" />
            <Bar dataKey="sleepRem"   stackId="sleep" fill="#c084fc" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
          {([["#7c3aed", "Deep"], ["#a855f7", "Light"], ["#c084fc", "REM"]] as const).map(([color, label]) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--text-3)" }}>
              <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: "inline-block" }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    ),
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: `sleep_chart` is clean. Remaining error may be `hrv_chart` — fixed next.

---

### Task 5: Rewrite hrv_chart as Heart Rate

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/fitness/page.tsx`

- [ ] **Step 1: Add hrAvg computed value**

Find the `stepData` line added in Task 3 Step 3. Add `hrAvg` directly below it:

```ts
  const hrAvg = chartData.filter(d => d.resting_hr != null).length
    ? Math.round(chartData.reduce((s, d) => s + (d.resting_hr ?? 0), 0) / chartData.filter(d => d.resting_hr != null).length)
    : null;
```

- [ ] **Step 2: Replace hrv_chart widget**

Find the current `hrv_chart` entry:

```ts
    hrv_chart:     <ChartCard title="♡ HRV — 7 days (ms)"          color="#34d399"       data={chartData} dataKey="hrv" />,
```

Replace with:

```tsx
    hrv_chart: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>♡ Heart Rate</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="2 6" stroke="rgba(34,211,238,0.06)" />
            <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11 }} />
            {hrAvg !== null && (
              <ReferenceLine y={hrAvg} stroke="rgba(248,113,113,0.4)" strokeDasharray="4 4"
                label={{ value: "avg", position: "insideTopRight", fill: "rgba(248,113,113,0.6)", fontSize: 8 }} />
            )}
            <Line type="monotone" dataKey="resting_hr" stroke="#f87171" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#f87171" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ),
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (or only the `stress_chart` key not found in `widgets` — fixed next).

---

### Task 6: Add stress_chart widget

**Files:**
- Modify: `FridayV2/frontend/app/(dashboard)/fitness/page.tsx`

- [ ] **Step 1: Add stressAvg computed value**

Find the `hrAvg` line added in Task 5 Step 1. Add `stressAvg` directly below it:

```ts
  const stressAvg = chartData.filter(d => d.stress != null).length
    ? Math.round(chartData.reduce((s, d) => s + (d.stress ?? 0), 0) / chartData.filter(d => d.stress != null).length)
    : null;
```

- [ ] **Step 2: Add stress_chart to widgets object**

Inside the `widgets` object, add the new entry after `hrv_chart`:

```tsx
    stress_chart: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>◎ Stress Average</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="2 6" stroke="rgba(34,211,238,0.06)" />
            <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11 }} />
            {stressAvg !== null && (
              <ReferenceLine y={stressAvg} stroke="rgba(251,146,60,0.4)" strokeDasharray="4 4"
                label={{ value: "avg", position: "insideTopRight", fill: "rgba(251,146,60,0.6)", fontSize: 8 }} />
            )}
            <Line type="monotone" dataKey="stress" stroke="#fb923c" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#fb923c" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ),
```

- [ ] **Step 3: Run TypeScript build**

```bash
cd FridayV2/frontend
npm run build
```

Expected: 0 errors, 0 warnings about missing types.

- [ ] **Step 4: Visual check**

Start the dev server if not already running:

```bash
npm run dev
```

Open `http://localhost:3000/fitness`. Verify:

- **Step Count** shows cyan bars; "Week" button active by default; clicking "Month" fetches and renders 30 bars
- **Sleep Duration** shows stacked violet bars with Deep / Light / REM legend below
- **Heart Rate** shows a red resting-HR line with a dashed average reference line; label "avg" appears on right
- **Stress Average** shows an orange line with dashed average reference; label "avg" on right
- Body Battery and 7-day History table are gone

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/fitness/page.tsx
git commit -m "feat(fitness): overhaul chart widgets — Step Count bar+toggle, Sleep stacked bar, Heart Rate line, Stress Average

- Remove battery_chart and history_table widgets
- Step Count: bar chart with Week/Month toggle (month fetches 30 days on demand)
- Sleep Duration: stacked BarChart (Deep/Light/REM) replacing single line
- Heart Rate: resting_hr line + 7-day avg ReferenceLine replacing HRV chart
- Stress Average: new widget — stress line + personal avg ReferenceLine

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Backend — add debug logging to surface silent sync failures

**Files:**
- Modify: `FridayV2/backend/integrations/garmin.py`
- Modify: `FridayV2/backend/integrations/fitness.py`

- [ ] **Step 1: Add debug logging to fetch_resting_hr in garmin.py**

Find `fetch_resting_hr` (around line 124):

```python
def fetch_resting_hr(date: str) -> dict:
    """Return resting heart rate for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_rhr_day, date)
    if not raw:
        return {}
    value = raw.get("allMetrics", {}).get("metricsMap", {}).get("WELLNESS_RESTING_HEART_RATE", [{}])
    if isinstance(value, list) and value:
        return {"resting_hr": value[0].get("metricValue")}
    return {}
```

Replace with:

```python
def fetch_resting_hr(date: str) -> dict:
    """Return resting heart rate for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_rhr_day, date)
    logger.debug("fetch_resting_hr raw keys=%s", list(raw.keys()) if isinstance(raw, dict) else raw)
    if not raw:
        return {}
    value = raw.get("allMetrics", {}).get("metricsMap", {}).get("WELLNESS_RESTING_HEART_RATE", [{}])
    logger.debug("fetch_resting_hr WELLNESS_RESTING_HEART_RATE value=%s", value)
    if isinstance(value, list) and value:
        return {"resting_hr": value[0].get("metricValue")}
    return {}
```

- [ ] **Step 2: Add debug logging to fetch_hrv in garmin.py**

Find `fetch_hrv` (around line 86):

```python
def fetch_hrv(date: str) -> dict:
    """Return HRV score and status for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_hrv_data, date)
    if not raw:
        return {}
    summary = raw.get("hrvSummary", {})
    return {
        "hrv_score": summary.get("lastNight"),
        "hrv_status": summary.get("status"),
    }
```

Replace with:

```python
def fetch_hrv(date: str) -> dict:
    """Return HRV score and status for the given YYYY-MM-DD date."""
    raw = _safe(_client().get_hrv_data, date)
    logger.debug("fetch_hrv raw keys=%s", list(raw.keys()) if isinstance(raw, dict) else raw)
    if not raw:
        return {}
    summary = raw.get("hrvSummary", {})
    logger.debug("fetch_hrv summary=%s", summary)
    return {
        "hrv_score": summary.get("lastNight"),
        "hrv_status": summary.get("status"),
    }
```

- [ ] **Step 3: Add debug logging to fetch_vo2max in garmin.py**

Find `fetch_vo2max` (around line 135):

```python
def fetch_vo2max() -> float | None:
    """Return the latest VO2 max estimate."""
    raw = _safe(_client().get_max_metrics, datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m-%d"))
    if not raw or not isinstance(raw, list):
        return None
    for item in raw:
        if item.get("vo2MaxPreciseValue"):
            return item["vo2MaxPreciseValue"]
        if item.get("generic", {}).get("vo2MaxPreciseValue"):
            return item["generic"]["vo2MaxPreciseValue"]
    return None
```

Replace with:

```python
def fetch_vo2max() -> float | None:
    """Return the latest VO2 max estimate."""
    raw = _safe(_client().get_max_metrics, datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m-%d"))
    logger.debug("fetch_vo2max raw=%s", raw)
    if not raw or not isinstance(raw, list):
        return None
    for item in raw:
        logger.debug("fetch_vo2max item keys=%s", list(item.keys()) if isinstance(item, dict) else item)
        if item.get("vo2MaxPreciseValue"):
            return item["vo2MaxPreciseValue"]
        if item.get("generic", {}).get("vo2MaxPreciseValue"):
            return item["generic"]["vo2MaxPreciseValue"]
    return None
```

- [ ] **Step 4: Add info logging to sync_today in fitness.py**

Find `sync_today` (around line 31). After the seven fetch calls and before the `row = {` dict, add:

```python
    stats = fetch_daily_stats(date)
    sleep = fetch_sleep(date)
    hrv = fetch_hrv(date)
    battery = fetch_body_battery(date)
    stress = fetch_stress(date)
    rhr = fetch_resting_hr(date)
    vo2 = fetch_vo2max()

    logger.info("sync_today fetch results — rhr=%s  hrv=%s  vo2=%s", rhr, hrv, vo2)
```

The exact insertion point is the blank line between `vo2 = fetch_vo2max()` and `row = {`. Add the `logger.info` line there.

- [ ] **Step 5: Enable DEBUG logging for the garmin module**

In `FridayV2/backend/api.py`, find where logging is configured (or the top of the file). Add after any existing `logging.basicConfig` call, or at the top after the imports:

First check if `api.py` already calls `basicConfig`. If it does, change the level to `DEBUG`:

```python
logging.basicConfig(level=logging.DEBUG)
```

If there is no `basicConfig` call, add it near the top (after imports):

```python
import logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
```

- [ ] **Step 6: Commit**

```bash
cd ../../..   # back to repo root
git add FridayV2/backend/integrations/garmin.py FridayV2/backend/integrations/fitness.py FridayV2/backend/api.py
git commit -m "debug(fitness): add logging to Garmin sync fetchers to surface silent failures

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Run sync, read logs, fix broken field extractions

**Files:**
- Modify: `FridayV2/backend/integrations/garmin.py` (field extraction fixes based on logs)

- [ ] **Step 1: Restart the backend with the new logging**

Stop any running uvicorn process, then:

```bash
cd FridayV2/backend
python -m uvicorn api:app --host 0.0.0.0 --port 8001 --log-level debug
```

- [ ] **Step 2: Trigger a sync and read the logs**

In a second terminal:

```bash
curl -X POST http://localhost:8001/fitness/sync
```

Watch the uvicorn terminal. You will see lines like:

```
DEBUG garmin fetch_resting_hr raw keys=[...]
DEBUG garmin fetch_resting_hr WELLNESS_RESTING_HEART_RATE value=...
DEBUG garmin fetch_hrv summary={...}
DEBUG garmin fetch_vo2max raw=[{...}]
INFO  fitness sync_today fetch results — rhr={} hrv={...} vo2=None
```

- [ ] **Step 3: Fix fetch_resting_hr if rhr={}**

If `rhr={}`, the `WELLNESS_RESTING_HEART_RATE` key lookup is failing. Look at the logged `raw keys` to find the actual structure. Common alternatives:

**If `raw` has a top-level `value` or `restingHeartRate` key:**
```python
# Replace the extraction block with:
value = raw.get("value") or raw.get("restingHeartRate")
if value is not None:
    return {"resting_hr": int(value)}
return {}
```

**If `raw` is a list:**
```python
if not raw or not isinstance(raw, list):
    return {}
entry = raw[0] if raw else {}
rhr = entry.get("value") or entry.get("restingHeartRate") or entry.get("metricValue")
return {"resting_hr": int(rhr)} if rhr is not None else {}
```

Use whichever matches the logged keys. If `rhr` is already populated correctly, skip this step.

- [ ] **Step 4: Fix fetch_vo2max if vo2=None**

If `vo2=None`, look at the logged item keys. Common alternative field names:

```python
# Replace the inner loop with:
for item in raw:
    logger.debug("fetch_vo2max item=%s", item)
    # try precise value first, then generic, then rounded
    v = (item.get("vo2MaxPreciseValue")
         or item.get("generic", {}).get("vo2MaxPreciseValue")
         or item.get("vo2Max")
         or item.get("generic", {}).get("vo2Max"))
    if v:
        return float(v)
return None
```

- [ ] **Step 5: Fix fetch_hrv if hrv_score is None**

If `hrv={hrv_score: None}`, check the logged `summary`. The field might be `"weeklyAvg"` or `"balanced"` instead of `"lastNight"`. Update accordingly:

```python
return {
    "hrv_score": summary.get("lastNight") or summary.get("weeklyAvg"),
    "hrv_status": summary.get("status"),
}
```

Note: HRV is often only available for past dates (computed overnight). If syncing mid-day, `lastNight` may be legitimately `None` — this is not a bug. Confirm by syncing for yesterday:

```bash
# Check if yesterday has HRV data in Supabase already
curl http://localhost:8001/fitness/sync  # syncs today only
```

If HRV works for past dates but not today, the data is correct and no fix is needed.

- [ ] **Step 6: Re-run sync and verify in Supabase**

After any fixes, trigger sync again and check the Supabase `fitness_daily` table for today's row — `resting_hr`, `hrv_score`, and `vo2max` columns should now be non-null.

You can check via the Supabase dashboard or:

```bash
curl http://localhost:8001/fitness/sync
```

Then refresh `http://localhost:3000/fitness` — the Today's Metrics tiles for Resting HR, HRV, and VO2 Max should display values instead of `—`.

- [ ] **Step 7: Remove DEBUG logging from api.py**

Change `logging.basicConfig(level=logging.DEBUG)` back to `INFO` to avoid noisy logs in production:

```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
```

Keep the `logger.debug` calls in `garmin.py` — they're silent at INFO level and useful for future debugging.

- [ ] **Step 8: Commit**

```bash
git add FridayV2/backend/integrations/garmin.py FridayV2/backend/integrations/fitness.py FridayV2/backend/api.py
git commit -m "fix(fitness): fix Garmin sync for resting_hr, hrv_score, vo2max field extractions

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
