"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useFinanceVisibility } from "@/lib/finance-visibility";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const LAYOUT_KEY = "layout_overview_v2";
const HIDDEN_KEY = "hidden_overview";
const CLOCK_KEY  = "world_clock_cities";
const SPANS_KEY   = "spans_overview_v2";
const HEIGHTS_KEY = "heights_overview_px";
const NUM_COLS    = 6;
const GRID_GAP    = 20;
const MIN_HEIGHT  = 120;
const MAX_HEIGHT  = 1400;

const DEFAULT_ORDER = ["upcoming_events", "world_clock", "tasks_due", "routines", "fitness_snapshot", "last_expense", "top5_spending", "weather"];
const DEFAULT_SPANS: Record<string, number> = {
  upcoming_events: 4, world_clock: 2,
  tasks_due: 3,       routines: 3,
  fitness_snapshot: 3, last_expense: 3,
  weather: 3,
  top5_spending: 3,
};

const DEFAULT_HEIGHTS: Record<string, number> = {
  upcoming_events:  440,
  world_clock:      220,
  tasks_due:        220,
  routines:         220,
  fitness_snapshot: 220,
  last_expense:     220,
  weather:          220,
  top5_spending:    300,
};

interface WeatherData {
  city: string; country: string;
  temp: number; feels_like: number; temp_min: number; temp_max: number;
  description: string; icon: string;
  humidity: number; wind_speed: number; wind_dir: string;
  visibility: number; clouds: number; pressure: number;
  sunrise: string; sunset: string;
}
interface CalEvent   { id: string; title: string; start: string; end?: string }
interface Task       { id: string; title: string; due: string | null; status: string; list_id?: string; list_title?: string }
interface VarExpense { date: string; category: string; description: string; amount: string }
interface Routine    { id: string; name: string; is_done: boolean; scheduled_time: string | null; days_of_week: string[] | null }
interface ClockCity  { city: string; tz: string }

const ALL_CITIES: ClockCity[] = [
  { city: "Singapore",    tz: "Asia/Singapore" },
  { city: "Kuala Lumpur", tz: "Asia/Kuala_Lumpur" },
  { city: "Jakarta",      tz: "Asia/Jakarta" },
  { city: "Bangkok",      tz: "Asia/Bangkok" },
  { city: "Hong Kong",    tz: "Asia/Hong_Kong" },
  { city: "Tokyo",        tz: "Asia/Tokyo" },
  { city: "Seoul",        tz: "Asia/Seoul" },
  { city: "Mumbai",       tz: "Asia/Kolkata" },
  { city: "Dubai",        tz: "Asia/Dubai" },
  { city: "Riyadh",       tz: "Asia/Riyadh" },
  { city: "Cairo",        tz: "Africa/Cairo" },
  { city: "London",       tz: "Europe/London" },
  { city: "Paris",        tz: "Europe/Paris" },
  { city: "Berlin",       tz: "Europe/Berlin" },
  { city: "New York",     tz: "America/New_York" },
  { city: "Chicago",      tz: "America/Chicago" },
  { city: "Los Angeles",  tz: "America/Los_Angeles" },
  { city: "Toronto",      tz: "America/Toronto" },
  { city: "São Paulo",    tz: "America/Sao_Paulo" },
  { city: "Sydney",       tz: "Australia/Sydney" },
];

const CITY_GROUPS: { label: string; cities: ClockCity[] }[] = [
  { label: "Southeast Asia",  cities: ["Singapore","Kuala Lumpur","Jakarta","Bangkok"].map(n => ALL_CITIES.find(c => c.city === n)!) },
  { label: "East Asia",       cities: ["Hong Kong","Tokyo","Seoul"].map(n => ALL_CITIES.find(c => c.city === n)!) },
  { label: "South Asia",      cities: ["Mumbai"].map(n => ALL_CITIES.find(c => c.city === n)!) },
  { label: "Middle East",     cities: ["Dubai","Riyadh"].map(n => ALL_CITIES.find(c => c.city === n)!) },
  { label: "Africa",          cities: ["Cairo"].map(n => ALL_CITIES.find(c => c.city === n)!) },
  { label: "Europe",          cities: ["London","Paris","Berlin"].map(n => ALL_CITIES.find(c => c.city === n)!) },
  { label: "Americas",        cities: ["New York","Chicago","Los Angeles","Toronto","São Paulo"].map(n => ALL_CITIES.find(c => c.city === n)!) },
  { label: "Pacific/Oceania", cities: ["Sydney"].map(n => ALL_CITIES.find(c => c.city === n)!) },
];

function CityOptions({ filter }: { filter: (c: ClockCity) => boolean }) {
  return (
    <>
      {CITY_GROUPS.map(group => {
        const opts = group.cities.filter(filter);
        if (opts.length === 0) return null;
        return (
          <optgroup key={group.label} label={group.label}>
            {opts.map(x => <option key={x.tz} value={x.tz}>{x.city}</option>)}
          </optgroup>
        );
      })}
    </>
  );
}

function SortableCard({ id, span = 3, height = 1, onResizeStart, onHeightResizeStart, children }: {
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

function Widget({ title, accent = "var(--cyan)", headerRight, children }: { title: string; accent?: string; headerRight?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass glow-cyan" style={{
      padding: "24px", position: "relative",
      height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box",
    }}>
      <div style={{ position: "absolute", top: 0, left: 24, right: 24, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.6 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="label-cyan">{title}</div>
        {headerRight}
      </div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [order, setOrder]         = useState<string[]>(DEFAULT_ORDER);
  const [hidden, setHidden]       = useState<string[]>([]);
  const [spans, setSpans]         = useState<Record<string, number>>(DEFAULT_SPANS);
  const [heights, setHeights]     = useState<Record<string, number>>(DEFAULT_HEIGHTS);
  const gridRef                   = useRef<HTMLDivElement>(null);
  const [weather, setWeather]         = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError]     = useState<string | null>(null);
  const [fitness, setFitness]     = useState<Record<string, number | null> | null>(null);
  const [events, setEvents]       = useState<CalEvent[]>([]);
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [lastExp, setLastExp]     = useState<VarExpense | null>(null);
  const [routines, setRoutines]   = useState<Routine[]>([]);
  const [cities, setCities]       = useState<ClockCity[]>(() => {
    if (typeof window === "undefined") return [{ city: "Singapore", tz: "Asia/Singapore" }];
    try {
      const c = localStorage.getItem(CLOCK_KEY);
      return c ? JSON.parse(c) : [{ city: "Singapore", tz: "Asia/Singapore" }];
    } catch { return [{ city: "Singapore", tz: "Asia/Singapore" }]; }
  });
  const [, setTick]               = useState(0);
  const [top5Month, setTop5Month]       = useState(new Date().toISOString().slice(0, 7));
  const [top5Expenses, setTop5Expenses] = useState<VarExpense[]>([]);
  const [addingCity, setAddingCity]   = useState(false);
  const [editCityIdx, setEditCityIdx] = useState<number | null>(null);
  const [hoveredCity, setHoveredCity] = useState<number | null>(null);
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const now      = new Date();
  const dateStr  = now.toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const todayStr = now.toISOString().slice(0, 10);

  useEffect(() => {
    const o  = localStorage.getItem(LAYOUT_KEY);
    const h  = localStorage.getItem(HIDDEN_KEY);
    const s  = localStorage.getItem(SPANS_KEY);
    const ht = localStorage.getItem(HEIGHTS_KEY);
    if (o) {
      const stored: string[] = JSON.parse(o);
      // Append any widgets added to DEFAULT_ORDER after the user saved their layout
      const newWidgets = DEFAULT_ORDER.filter(id => !stored.includes(id));
      setOrder(newWidgets.length ? [...stored, ...newWidgets] : stored);
    }
    if (h)  setHidden(JSON.parse(h));
    if (s)  setSpans({ ...DEFAULT_SPANS, ...JSON.parse(s) });
    if (ht) setHeights({ ...DEFAULT_HEIGHTS, ...JSON.parse(ht) });
  }, []);

  // 1-second tick for live clocks
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    // Wrapped in try/catch — if Supabase is unreachable, backend calls must still run
    try {
      const { data } = await supabase
        .from("fitness_daily")
        .select("steps,sleep_duration_min,hrv_score,calories")
        .eq("date", today)
        .maybeSingle();
      setFitness(data as Record<string, number | null> | null);
    } catch { /* supabase offline */ }

    try { const t = await apiFetch<Task[]>("/tasks"); setTasks(t.filter(t => t.status === "needsAction")); } catch { /* offline */ }
    try {
      const v = await apiFetch<VarExpense[]>("/finance/variable");
      // Google Sheets stores amounts as "$29.80" — strip currency symbol and commas before parsing
      const parseAmt = (s: unknown) => parseFloat(String(s ?? "").replace(/[$,]/g, ""));
      const valid = v.filter(x => !isNaN(parseAmt(x.amount)));
      if (valid.length) setLastExp(valid[valid.length - 1]);
    } catch { /* offline */ }
    try { const r = await apiFetch<Routine[]>("/routines"); setRoutines(r); } catch { /* offline */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fetchCalendarMonth = useCallback(async (year: number, month: number) => {
    const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
    try { const c = await apiFetch<CalEvent[]>(`/calendar?month=${ym}`); setEvents(c); } catch { /* offline */ }
  }, []);

  useEffect(() => { fetchCalendarMonth(viewYear, viewMonth); }, [viewYear, viewMonth, fetchCalendarMonth]);

  async function loadWeather(lat: number, lon: number) {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const w = await apiFetch<WeatherData>(`/weather?lat=${lat}&lon=${lon}`);
      setWeather(w);
    } catch (e) {
      setWeatherError(e instanceof Error ? e.message : "Failed to load weather");
    } finally {
      setWeatherLoading(false);
    }
  }

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      loadWeather(1.3521, 103.8198);  // fallback: Singapore
      return;
    }
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos  => loadWeather(pos.coords.latitude, pos.coords.longitude),
      ()   => loadWeather(1.3521, 103.8198),   // fallback: Singapore
    );
  }

  useEffect(() => { requestLocation(); }, []);

  useEffect(() => {
    apiFetch<VarExpense[]>(`/finance/variable?month=${top5Month}`)
      .then(v => {
        const sorted = [...v]
          .filter(x => !isNaN(parseFloat(String(x.amount).replace(/[$,]/g, ""))))
          .sort((a, b) =>
            parseFloat(String(b.amount).replace(/[$,]/g, "")) -
            parseFloat(String(a.amount).replace(/[$,]/g, ""))
          )
          .slice(0, 5);
        setTop5Expenses(sorted);
      })
      .catch(() => setTop5Expenses([]));
  }, [top5Month]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const next = arrayMove(order, order.indexOf(active.id as string), order.indexOf(over.id as string));
      setOrder(next);
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    }
  }

  function fmtTime(iso: string) {
    try {
      return new Date(iso).toLocaleString("en-SG", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  function saveCities(next: ClockCity[]) {
    setCities(next);
    localStorage.setItem(CLOCK_KEY, JSON.stringify(next));
  }

  function cityTime(tz: string) {
    try {
      return new Intl.DateTimeFormat("en-SG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: tz }).format(new Date());
    } catch { return "--:--:--"; }
  }

  async function toggleRoutine(id: string) {
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, is_done: !r.is_done } : r));
    try { await apiFetch(`/routines/${id}/toggle`, { method: "PATCH" }); } catch { load(); }
  }

  async function completeTask(id: string, list_id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await apiFetch(`/tasks/${id}/complete?list_id=${encodeURIComponent(list_id)}`, { method: "POST" }); } catch { load(); }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else { setViewMonth(m => m - 1); }
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else { setViewMonth(m => m + 1); }
  }

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday   = new Date(viewYear, viewMonth, 1).getDay();
  const eventDates     = new Set(events.map(e => e.start.slice(0, 10)));
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const visibleEvents  = events
    .filter(e => isCurrentMonth ? e.start.slice(0, 10) >= todayStr : true)
    .sort((a, b) => a.start.localeCompare(b.start));

  // ── World clock helpers ────────────────────────────────────────────────────
  const usedTzs        = new Set(cities.map(c => c.tz));
  const availableCities = ALL_CITIES.filter(c => !usedTzs.has(c.tz));

  // ── Sleep formatting ───────────────────────────────────────────────────────
  const sleepH = fitness?.sleep_duration_min ? Math.floor(fitness.sleep_duration_min / 60) : null;
  const sleepM = fitness?.sleep_duration_min ? fitness.sleep_duration_min % 60 : null;

  const { visible: financeVisible } = useFinanceVisibility();

  const widgets: Record<string, React.ReactNode> = {

    fitness_snapshot: (
      <Widget title="⬡ Fitness Snapshot">
        {fitness ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Steps",    value: fitness.steps?.toLocaleString(),                   unit: ""    },
              { label: "Sleep",    value: sleepH !== null ? `${sleepH}h ${sleepM}m` : null, unit: ""    },
              { label: "HRV",     value: fitness.hrv_score,                                unit: "ms"  },
              { label: "Calories", value: fitness.calories?.toLocaleString(),               unit: "kcal"},
            ].map(({ label, value, unit }) => (
              <div key={label}>
                <div className="label" style={{ marginBottom: 4, color: "var(--text-2)" }}>{label}</div>
                <span className="metric-value" style={{ fontSize: 22 }}>{value ?? "—"}</span>
                {value != null && unit && <span className="metric-unit">{unit}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>No data today — sync from Fitness page.</p>
        )}
      </Widget>
    ),

    upcoming_events: (
      <Widget title="◷ Calendar" accent="var(--violet)">
        <div style={{ display: "flex", flexDirection: "row", gap: 20 }}>
          {/* Left: Mini calendar */}
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
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 9, color: "var(--text-3)", fontFamily: "var(--font-mono)", padding: "2px 0", letterSpacing: "0.05em" }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateKey  = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hasEvent = eventDates.has(dateKey);
                const isToday  = dateKey === todayStr;
                return (
                  <div key={day} style={{
                    textAlign: "center", padding: "4px 2px", borderRadius: 6, position: "relative",
                    border: isToday ? "1px solid var(--cyan)" : "1px solid transparent",
                    background: hasEvent ? "rgba(139,92,246,0.12)" : "transparent",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--cyan)" : "var(--text-2)" }}>{day}</span>
                    {hasEvent && (
                      <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "var(--violet)" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vertical divider */}
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />

          {/* Right: Event list for viewed month */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {visibleEvents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visibleEvents.map(e => (
                  <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 2, minHeight: 32, background: "var(--violet)", borderRadius: 2, flexShrink: 0, marginTop: 3 }} />
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>{e.title}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>{fmtTime(e.start)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-3)", fontSize: 13 }}>
                No events in {new Date(viewYear, viewMonth).toLocaleDateString("en-SG", { month: "long" })}.
              </p>
            )}
          </div>
        </div>
      </Widget>
    ),

    world_clock: (
      <Widget title="◑ World Clock" accent="var(--cyan)">
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {cities.map((c, idx) => (
            <div
              key={c.tz}
              style={{ position: "relative" }}
              onMouseEnter={() => setHoveredCity(idx)}
              onMouseLeave={() => { setHoveredCity(null); if (editCityIdx === idx) setEditCityIdx(null); }}
            >
              {editCityIdx === idx ? (
                <select
                  autoFocus
                  style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--cyan)", color: "var(--text-1)", borderRadius: 6, padding: "5px 8px", fontSize: 12, fontFamily: "var(--font-space)", marginBottom: 4 }}
                  defaultValue=""
                  onChange={ev => {
                    if (!ev.target.value) return;
                    const chosen = ALL_CITIES.find(x => x.tz === ev.target.value)!;
                    saveCities(cities.map((x, i) => i === idx ? chosen : x));
                    setEditCityIdx(null);
                  }}
                  onBlur={() => setEditCityIdx(null)}
                >
                  <option value="" disabled>Choose city…</option>
                  <CityOptions filter={x => x.tz === c.tz || !usedTzs.has(x.tz)} />
                </select>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                    <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-space)" }}>{c.city}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--cyan)", letterSpacing: "0.04em" }}>{cityTime(c.tz)}</span>
                      {hoveredCity === idx && (
                        <div style={{ display: "flex", gap: 2 }}>
                          <button onClick={() => setEditCityIdx(idx)} title="Change city" style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12, padding: "0 3px", lineHeight: 1 }}>✎</button>
                          <button onClick={() => saveCities(cities.filter((_, i) => i !== idx))} title="Remove" style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 13, padding: "0 3px", lineHeight: 1 }}>×</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {idx < cities.length - 1 && <div style={{ height: 1, background: "var(--border)", opacity: 0.4 }} />}
                </>
              )}
            </div>
          ))}

          {/* Add city */}
          {addingCity ? (
            <select
              autoFocus
              style={{ width: "100%", marginTop: 8, background: "var(--bg-surface)", border: "1px solid var(--cyan)", color: "var(--text-1)", borderRadius: 6, padding: "5px 8px", fontSize: 12, fontFamily: "var(--font-space)" }}
              defaultValue=""
              onChange={ev => {
                if (!ev.target.value) return;
                const chosen = ALL_CITIES.find(x => x.tz === ev.target.value)!;
                saveCities([...cities, chosen]);
                setAddingCity(false);
              }}
              onBlur={() => setAddingCity(false)}
            >
              <option value="" disabled>Select a city…</option>
              <CityOptions filter={x => !usedTzs.has(x.tz)} />
            </select>
          ) : availableCities.length > 0 ? (
            <button
              onClick={() => setAddingCity(true)}
              style={{ marginTop: 10, padding: "6px 0", background: "transparent", border: "1px dashed rgba(34,211,238,0.25)", borderRadius: 6, color: "var(--text-3)", cursor: "pointer", fontSize: 11, fontFamily: "var(--font-space)", width: "100%", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.5)"; (e.currentTarget as HTMLElement).style.color = "var(--cyan)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.25)"; (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; }}
            >+ Add city</button>
          ) : null}
        </div>
      </Widget>
    ),

    tasks_due: (
      <Widget title="◈ Open Tasks" accent="var(--cyan)">
        {tasks.length === 0
          ? <p style={{ color: "var(--text-3)", fontSize: 13 }}>No pending tasks.</p>
          : (() => {
              const groups = tasks.reduce<Record<string, Task[]>>((acc, t) => {
                const key = t.list_title ?? "Tasks";
                (acc[key] ??= []).push(t);
                return acc;
              }, {});
              return (
                <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
                  {Object.entries(groups).map(([listName, listTasks]) => (
                    <div key={listName} style={{ flex: "1 1 160px", minWidth: 140 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--cyan)", fontFamily: "var(--font-space)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                        {listName}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 4 }}>
                        {listTasks.map(t => (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button
                              onClick={() => completeTask(t.id, t.list_id ?? "@default")}
                              title="Mark as done"
                              style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid var(--border-hover)", background: "transparent", cursor: "pointer", flexShrink: 0, transition: "background 0.15s, border-color 0.15s", padding: 0 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--cyan-dim)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--cyan)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)"; }}
                            />
                            <div>
                              <div style={{ fontSize: 13, color: "var(--text-1)" }}>{t.title}</div>
                              {t.due && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>Due {t.due.slice(0, 10)}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
        }
      </Widget>
    ),

    last_expense: (
      <Widget title="◉ Last Expense" accent="var(--orange)">
        {lastExp ? (
          <div>
            <div className={`${financeVisible ? "" : "finance-hidden"} finance-blur`}>
              <div className="metric-value" style={{ color: "var(--orange)", marginBottom: 8 }}>
                {(() => { const n = parseFloat(String(lastExp.amount ?? "").replace(/[$,]/g, "")); return isNaN(n) ? "SGD —" : `SGD ${n.toFixed(2)}`; })()}
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 4 }}>{lastExp.description}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>
              {lastExp.category} · {lastExp.date}
            </div>
          </div>
        ) : <p style={{ color: "var(--text-3)", fontSize: 13 }}>No recent expenses.</p>}
      </Widget>
    ),

    routines: (
      <Widget title="◎ Routines" accent="var(--cyan)">
        {routines.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {routines.map(r => (
              <div key={r.id} onClick={() => toggleRoutine(r.id)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0, transition: "all 0.15s",
                  border: r.is_done ? "none" : "1px solid var(--border-hover)",
                  background: r.is_done ? "var(--cyan)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {r.is_done && <span style={{ fontSize: 10, color: "#000", fontWeight: 700, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: r.is_done ? "var(--text-3)" : "var(--text-1)", textDecoration: r.is_done ? "line-through" : "none", transition: "all 0.15s" }}>
                    {r.name}
                  </span>
                  {r.scheduled_time && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-2)" }}>
                      {r.scheduled_time.slice(0, 5)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <p style={{ color: "var(--text-3)", fontSize: 13 }}>No routines — add some via Friday.</p>}
      </Widget>
    ),

    top5_spending: (
      <Widget title="◉ Top 5 Spent" accent="var(--orange)"
        headerRight={
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => setTop5Month(prev => {
                const [y, m] = prev.split("-").map(Number);
                const d = new Date(y, m - 2, 1);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              })}
              style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--cyan)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
            >‹</button>
            <span style={{ fontFamily: "var(--font-space)", fontSize: 11, fontWeight: 600, color: "var(--text-2)", letterSpacing: "0.04em" }}>
              {(() => {
                const [y, m] = top5Month.split("-");
                const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                return `${mn[parseInt(m) - 1]} ${y}`;
              })()}
            </span>
            <button
              onClick={() => setTop5Month(prev => {
                const [y, m] = prev.split("-").map(Number);
                const d = new Date(y, m, 1);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              })}
              style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--cyan)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
            >›</button>
          </div>
        }
      >
        {top5Expenses.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>No expenses this month.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top5Expenses.map((exp, i) => {
              const amt = parseFloat(String(exp.amount).replace(/[$,]/g, ""));
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", width: 14, flexShrink: 0, paddingTop: 3 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 13, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {exp.description || "—"}
                      </span>
                      <span className={`${financeVisible ? "" : "finance-hidden"} finance-blur`} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--orange)", flexShrink: 0 }}>
                        SGD {isNaN(amt) ? "—" : amt.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ background: "rgba(34,211,238,0.1)", borderRadius: 4, padding: "1px 6px", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--cyan)", letterSpacing: "0.05em" }}>
                        {exp.category}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-2)" }}>{exp.date}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Widget>
    ),

    weather: (
      <Widget
        title="◑ Weather"
        headerRight={
          <button
            onClick={requestLocation}
            disabled={weatherLoading}
            style={{
              background: "transparent", border: "none", cursor: weatherLoading ? "default" : "pointer",
              color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 10,
              letterSpacing: "0.06em", padding: "2px 6px",
              opacity: weatherLoading ? 0.5 : 1,
            }}
          >
            {weatherLoading ? "…" : "◎ Locate"}
          </button>
        }
      >
        {weatherLoading && !weather ? (
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>Detecting location…</p>
        ) : weatherError ? (
          <p style={{ color: "var(--orange)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            Error: {weatherError}
          </p>
        ) : weather ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 32, lineHeight: 1 }}>{weather.icon}</span>
              <div>
                <div style={{ fontFamily: "var(--font-space)", fontSize: 28, fontWeight: 700, color: "var(--text-1)", lineHeight: 1 }}>
                  {weather.temp}°C
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                  {weather.description}
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-2)", fontWeight: 600 }}>
                  {weather.city}, {weather.country}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                  H:{weather.temp_max}° · L:{weather.temp_min}°
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 0", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              {[
                { label: "Feels like", value: `${weather.feels_like}°C` },
                { label: "Humidity",   value: `${weather.humidity}%` },
                { label: "Wind",       value: `${weather.wind_speed} km/h ${weather.wind_dir}` },
                { label: "Visibility", value: `${weather.visibility} km` },
                { label: "Cloud",      value: `${weather.clouds}%` },
                { label: "Pressure",   value: `${weather.pressure} hPa` },
                { label: "Sunrise",    value: weather.sunrise },
                { label: "Sunset",     value: weather.sunset },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="label" style={{ marginBottom: 2, fontSize: 9, color: "var(--text-2)" }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-1)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>
            Location unavailable — tap <strong>◎ Locate</strong> to try again.
          </p>
        )}
      </Widget>
    ),
  };

  const visible = order.filter(id => !hidden.includes(id));

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div className="label-cyan" style={{ marginBottom: 8 }}>◈ Dashboard</div>
        <h1 style={{ fontFamily: "var(--font-space)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: 6 }}>
          Overview
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-3)" }}>{dateStr}</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visible} strategy={rectSortingStrategy}>
          <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 20, alignItems: "start" }}>
            {visible.map(id => (
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
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
