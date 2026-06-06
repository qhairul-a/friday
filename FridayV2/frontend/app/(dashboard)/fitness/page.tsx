"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const LAYOUT_KEY  = "layout_fitness";
const SPANS_KEY   = "spans_fitness";
const NUM_COLS    = 2;
const GRID_GAP    = 20;
const DEFAULT_ORDER = ["metrics_grid", "steps_chart", "sleep_chart", "hrv_chart", "battery_chart", "history_table"];
const DEFAULT_SPANS: Record<string, number> = { metrics_grid: 2, steps_chart: 2, sleep_chart: 1, hrv_chart: 1, battery_chart: 1, history_table: 2 };

const HEIGHTS_KEY   = "heights_fitness";
const ROW_HEIGHT    = 220;
const MIN_ROWS      = 1;
const MAX_ROWS      = 6;

const DEFAULT_HEIGHTS: Record<string, number> = {
  metrics_grid:  1,
  steps_chart:   2,
  sleep_chart:   2,
  hrv_chart:     2,
  battery_chart: 2,
  history_table: 3,
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

function ChartCard({ title, color, data, dataKey }: { title: string; color: string; data: object[]; dataKey: string }) {
  return (
    <div className="glass" style={{ padding: "24px" }}>
      <div className="label-cyan" style={{ marginBottom: 16 }}>{title}</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="2 6" stroke="rgba(34,211,238,0.06)" />
          <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11 }} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FitnessPage() {
  const [today, setToday] = useState<FitnessRow | null>(null);
  const [history, setHistory] = useState<FitnessRow[]>([]);
  const [syncing, setSyncing] = useState(false);
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
    const from = new Date(); from.setDate(from.getDate() - 6);
    const { data } = await supabase.from("fitness_daily").select("*").gte("date", from.toISOString().slice(0, 10)).order("date", { ascending: true });
    if (data?.length) { setHistory(data as FitnessRow[]); setToday(data[data.length - 1] as FitnessRow); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sync() {
    setSyncing(true);
    try { await apiFetch("/fitness/sync", { method: "POST" }); await load(); } catch { /* ignore */ }
    setSyncing(false);
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
      const delta = Math.round((mv.clientY - startY) / (ROW_HEIGHT + GRID_GAP));
      handleHeightChange(id, Math.max(MIN_ROWS, Math.min(MAX_ROWS, startHeight + delta)));
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
    date: r.date.slice(5),
    steps: r.steps,
    sleep: r.sleep_duration_min ? Math.round(r.sleep_duration_min / 6) / 10 : null,
    hrv: r.hrv_score,
    battery: r.body_battery_high,
  }));

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
    steps_chart:   <ChartCard title="⬡ Steps — 7 days"             color="var(--cyan)"   data={chartData} dataKey="steps" />,
    sleep_chart:   <ChartCard title="◑ Sleep — 7 days (hrs)"       color="var(--violet)" data={chartData} dataKey="sleep" />,
    hrv_chart:     <ChartCard title="♡ HRV — 7 days (ms)"          color="#34d399"       data={chartData} dataKey="hrv" />,
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
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <div className="label-cyan" style={{ marginBottom: 8 }}>◈ Health Intelligence</div>
          <h1 style={{ fontFamily: "var(--font-space)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>Fitness</h1>
        </div>
        <button onClick={sync} disabled={syncing} className="btn-ghost" style={{ marginTop: 8 }}>
          {syncing ? "Syncing…" : "↻ Sync Garmin"}
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, gridAutoRows: `${ROW_HEIGHT}px` }}>
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
