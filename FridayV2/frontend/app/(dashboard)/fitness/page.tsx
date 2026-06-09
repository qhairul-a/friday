"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, LabelList } from "recharts";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function toLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const LAYOUT_KEY  = "layout_fitness";
const SPANS_KEY   = "spans_fitness";
const NUM_COLS    = 2;
const GRID_GAP    = 20;
const DEFAULT_ORDER = ["metrics_grid", "steps_chart", "sleep_chart", "hrv_chart", "stress_chart"];
const DEFAULT_SPANS: Record<string, number> = { metrics_grid: 2, steps_chart: 2, sleep_chart: 1, hrv_chart: 1, stress_chart: 2 };

const HEIGHTS_KEY   = "heights_fitness_px";
const MIN_HEIGHT    = 120;
const MAX_HEIGHT    = 1400;

const DEFAULT_HEIGHTS: Record<string, number> = {
  metrics_grid: 220,
  steps_chart:  440,
  sleep_chart:  440,
  hrv_chart:    440,
  stress_chart: 440,
};

interface FitnessRow {
  date: string; steps: number|null; active_minutes: number|null; calories: number|null;
  resting_hr: number|null; sleep_duration_min: number|null; sleep_score: number|null;
  sleep_deep_min: number|null; sleep_light_min: number|null; sleep_rem_min: number|null;
  hrv_score: number|null; hrv_status: string|null; body_battery_low: number|null;
  body_battery_high: number|null; stress_avg: number|null; vo2max: number|null;
}

function SortableWidget({ id, span = 1, height = 1, onResizeStart, onHeightResizeStart, children }: {
  id: string; span?: number; height?: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onHeightResizeStart: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        position: "relative",
        gridColumn: `span ${span}`,
        height: `${height}px`,
        alignSelf: "start",
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
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "col-resize", zIndex: 9, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={e => { const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill"); if (p) { p.style.opacity = "1"; p.style.boxShadow = "0 0 6px var(--cyan)"; } }}
      onMouseLeave={e => { const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill"); if (p) { p.style.opacity = "0.3"; p.style.boxShadow = "none"; } }}
    >
      <div className="resize-pill" style={{ width: 2, height: 32, borderRadius: 4, background: "var(--cyan)", opacity: 0.3, transition: "opacity 0.15s, box-shadow 0.15s" }} />
    </div>
  );
}

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
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h");
        if (p) { p.style.opacity = "1"; p.style.boxShadow = "0 0 6px var(--cyan)"; }
      }}
      onMouseLeave={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h");
        if (p) { p.style.opacity = "0.3"; p.style.boxShadow = "none"; }
      }}
    >
      <div
        className="resize-pill-h"
        style={{ width: 32, height: 2, borderRadius: 4, background: "var(--cyan)", opacity: 0.3, transition: "opacity 0.15s, box-shadow 0.15s" }}
      />
    </div>
  );
}

function MetricTile({ label, value, unit = "", accent = "var(--cyan)" }: { label: string; value: string | number | null; unit?: string; accent?: string }) {
  return (
    <div className="glass" style={{ padding: "16px 18px", borderLeft: `2px solid ${accent}` }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="metric-value" style={{ fontSize: 24 }}>{value !== null && value !== undefined ? String(value) : "—"}</span>
        {value != null && unit && <span className="metric-unit">{unit}</span>}
      </div>
    </div>
  );
}

export default function FitnessPage() {
  const [today, setToday] = useState<FitnessRow | null>(null);
  const [history, setHistory] = useState<FitnessRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [stepView,    setStepView]    = useState<"week" | "month">("week");
  const [monthSteps,  setMonthSteps]  = useState<FitnessRow[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [spans, setSpans] = useState<Record<string, number>>(DEFAULT_SPANS);
  const [heights, setHeights] = useState<Record<string, number>>(DEFAULT_HEIGHTS);
  const gridRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o  = localStorage.getItem(LAYOUT_KEY);
    const s  = localStorage.getItem(SPANS_KEY);
    const ht = localStorage.getItem(HEIGHTS_KEY);
    if (o)  setOrder(JSON.parse(o));
    if (s)  setSpans(JSON.parse(s));
    if (ht) setHeights(JSON.parse(ht));
  }, []);

  const load = useCallback(async () => {
    const todayStr = toLocalDate();
    const from = new Date(); from.setDate(from.getDate() - 6);
    const { data } = await supabase.from("fitness_daily").select("*").gte("date", toLocalDate(from)).order("date", { ascending: true });
    if (data?.length) {
      setHistory(data as FitnessRow[]);
      const todayRow = (data as FitnessRow[]).find(r => r.date === todayStr) ?? data[data.length - 1] as FitnessRow;
      setToday(todayRow);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sync() {
    setSyncing(true);
    setSyncError(null);
    try {
      await apiFetch("/fitness/sync", { method: "POST" });
      await load();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function loadMonthSteps() {
    setMonthLoading(true);
    const from = new Date(); from.setDate(from.getDate() - 29);
    try {
      const { data, error } = await supabase.from("fitness_daily")
        .select("date,steps")
        .gte("date", toLocalDate(from))
        .order("date", { ascending: true });
      if (error) throw error;
      if (data) setMonthSteps(data as FitnessRow[]);
    } catch (err) {
      console.error("loadMonthSteps failed:", err);
    } finally {
      setMonthLoading(false);
    }
  }

  function getColWidth(): number {
    if (!gridRef.current) return 200;
    return (gridRef.current.offsetWidth - GRID_GAP * (NUM_COLS - 1)) / NUM_COLS;
  }

  function handleSpanChange(id: string, newSpan: number) {
    setSpans(prev => {
      const next = { ...prev, [id]: newSpan };
      localStorage.setItem(SPANS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleResizeStart(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startSpan = spans[id] ?? DEFAULT_SPANS[id] ?? 1;
    const colWidth = getColWidth();
    function onMove(mv: MouseEvent) {
      const delta = Math.round((mv.clientX - startX) / (colWidth + GRID_GAP));
      handleSpanChange(id, Math.max(1, Math.min(NUM_COLS, startSpan + delta)));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleHeightChange(id: string, newHeight: number) {
    setHeights(prev => {
      const next = { ...prev, [id]: newHeight };
      localStorage.setItem(HEIGHTS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleHeightResizeStart(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const startY      = e.clientY;
    const startHeight = heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1;
    function onMove(mv: MouseEvent) {
      handleHeightChange(id, Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + (mv.clientY - startY))));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const next = arrayMove(order, order.indexOf(active.id as string), order.indexOf(over.id as string));
      setOrder(next); localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    }
  }

  const sleepH = today?.sleep_duration_min ? Math.floor(today.sleep_duration_min / 60) : null;
  const sleepM = today?.sleep_duration_min ? today.sleep_duration_min % 60 : null;

  const chartData = history.map(r => ({
    date:       r.date.slice(5),
    steps:      r.steps,
    sleepDeep:  r.sleep_deep_min,
    sleepLight: r.sleep_light_min,
    sleepRem:   r.sleep_rem_min,
    sleepTotal: r.sleep_duration_min,
    resting_hr: r.resting_hr,
    hrv_score:  r.hrv_score,
    stress:     r.stress_avg,
  }));

  const stepData = stepView === "week"
    ? chartData.map(d => ({ date: d.date, steps: d.steps }))
    : monthSteps.map(r => ({ date: r.date.slice(5), steps: r.steps }));

  const hrAvg = chartData.filter(d => d.resting_hr != null).length
    ? Math.round(chartData.reduce((s, d) => s + (d.resting_hr ?? 0), 0) / chartData.filter(d => d.resting_hr != null).length)
    : null;

  const hrvAvg = chartData.filter(d => d.hrv_score != null).length
    ? Math.round(chartData.reduce((s, d) => s + (d.hrv_score ?? 0), 0) / chartData.filter(d => d.hrv_score != null).length)
    : null;

  const stressAvg = chartData.filter(d => d.stress != null).length
    ? Math.round(chartData.reduce((s, d) => s + (d.stress ?? 0), 0) / chartData.filter(d => d.stress != null).length)
    : null;

  const widgets: Record<string, React.ReactNode> = {
    metrics_grid: (
      <div className="glass" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div className="label-cyan" style={{ marginBottom: 4 }}>◈ Today's Metrics</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{today?.date ?? "—"}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <MetricTile label="Steps"         value={today?.steps?.toLocaleString() ?? null} />
          <MetricTile label="Calories"      value={today?.calories ?? null}        unit="kcal" accent="var(--orange)" />
          <MetricTile label="Active"        value={today?.active_minutes ?? null}  unit="min" />
          <MetricTile label="Resting HR"    value={today?.resting_hr ?? null}      unit="bpm" accent="var(--violet)" />
          <MetricTile label="Sleep"         value={sleepH !== null ? `${sleepH}h ${sleepM}m` : null} accent="var(--violet)" />
          <MetricTile label="Sleep Score"   value={today?.sleep_score ?? null} />
          <MetricTile label="HRV"           value={today?.hrv_score ?? null}       unit="ms"  accent="var(--cyan)" />
          <MetricTile label="HRV Status"    value={today?.hrv_status ?? null} />
          <MetricTile label="Body Battery"  value={today?.body_battery_low != null ? `${today.body_battery_low}–${today.body_battery_high}` : null} accent="var(--orange)" />
          <MetricTile label="Stress Avg"    value={today?.stress_avg ?? null} />
          <MetricTile label="VO2 Max"       value={today?.vo2max?.toFixed(1) ?? null} accent="var(--cyan)" />
          <MetricTile label="Deep Sleep"    value={today?.sleep_deep_min ?? null}  unit="min" accent="var(--violet)" />
        </div>
      </div>
    ),
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
                  transition:  "all 0.15s",
                }}
              >
                {v === "week" ? "Week" : monthLoading ? "Loading…" : "Month"}
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
    sleep_chart: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>◑ Sleep</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 18, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 6" stroke="rgba(34,211,238,0.06)" />
            <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => `${v}m`} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11 }} />
            <Bar dataKey="sleepDeep"  stackId="sleep" fill="#7c3aed" />
            <Bar dataKey="sleepLight" stackId="sleep" fill="#a855f7" />
            <Bar dataKey="sleepRem"   stackId="sleep" fill="#c084fc" radius={[2, 2, 0, 0]}>
              <LabelList dataKey="sleepTotal" position="top"
                formatter={(v) => { const n = Number(v); return n ? `${(n / 60).toFixed(1)}h` : ""; }}
                style={{ fill: "var(--text-3)", fontSize: 9, fontFamily: "var(--font-mono)" }}
              />
            </Bar>
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
    hrv_chart: (
      <div className="glass" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="label-cyan">◈ HRV</div>
          <div style={{ display: "flex", gap: 14 }}>
            {([["#22d3ee", "HRV (ms)"], ["#f87171", "Resting HR (bpm)"]] as const).map(([color, label]) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--text-3)" }}>
                <span style={{ width: 18, height: 2, background: color, borderRadius: 2, display: "inline-block" }} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="2 6" stroke="rgba(34,211,238,0.06)" />
            <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="hrv" orientation="left"  tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={32} />
            <YAxis yAxisId="hr"  orientation="right" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11 }} />
            {hrvAvg !== null && (
              <ReferenceLine yAxisId="hrv" y={hrvAvg} stroke="rgba(34,211,238,0.35)" strokeDasharray="4 4"
                label={{ value: "avg", position: "insideTopLeft", fill: "rgba(34,211,238,0.5)", fontSize: 8 }} />
            )}
            {hrAvg !== null && (
              <ReferenceLine yAxisId="hr" y={hrAvg} stroke="rgba(248,113,113,0.35)" strokeDasharray="4 4"
                label={{ value: "avg", position: "insideTopRight", fill: "rgba(248,113,113,0.5)", fontSize: 8 }} />
            )}
            <Line yAxisId="hrv" type="monotone" dataKey="hrv_score"  stroke="#22d3ee" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#22d3ee" }} />
            <Line yAxisId="hr"  type="monotone" dataKey="resting_hr" stroke="#f87171" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#f87171" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ),
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
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <div className="label-cyan" style={{ marginBottom: 8 }}>◈ Health Intelligence</div>
          <h1 style={{ fontFamily: "var(--font-space)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>Fitness</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button onClick={sync} disabled={syncing} className="btn-ghost" style={{ marginTop: 8 }}>
            {syncing ? "Syncing…" : "↻ Sync Garmin"}
          </button>
          {syncError && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#f87171" }}>{syncError}</div>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
            {order.map(id => (
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
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
