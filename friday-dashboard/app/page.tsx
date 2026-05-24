"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, USER_ID } from "@/lib/supabase";
import { Task, RoutineItem, Goal } from "@/lib/types";
import PageShell from "./components/page-shell";
import VoiceOrb from "./components/voice-orb";
import MobileSwipePanels from "./components/mobile-swipe-panels";
import MobileBottomNav from "./components/mobile-bottom-nav";

const PRIORITY_WEIGHT = { high: 3, normal: 2, low: 1 } as const;
const STATUS_WEIGHT = { in_progress: 2, todo: 1, done: 0, archived: 0 } as const;

// ─── Widget wrapper ───────────────────────────────────────────────────────────

function Widget({ title, icon, children, action }: {
  title: string; icon: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[#00d4ff] text-sm">{icon}</span>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b]">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Calendar widget ──────────────────────────────────────────────────────────

interface CalendarEvent { title: string; start: string; startStr: string; }

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function MonthCalendar({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Days in this month that have events
  const eventDays = new Set(
    events
      .filter((ev) => {
        const d = new Date(ev.start);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map((ev) => new Date(ev.start).getDate())
  );

  // Build grid cells: nulls for padding, then day numbers
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="shrink-0" style={{ width: 200 }}>
      <div className="text-[11px] font-semibold text-white mb-2 text-center">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-[9px] text-[#364c61] font-medium text-center py-0.5">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`text-[10px] h-6 flex items-center justify-center rounded-full transition-colors ${
              day === null
                ? ""
                : day === todayDate
                ? "bg-[#00d4ff] text-[#050b14] font-bold"
                : eventDays.has(day)
                ? "text-[#00d4ff] font-semibold"
                : "text-[#4a7a9b]"
            }`}
          >
            {day ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    setRefreshing(true);
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data: CalendarEvent[]) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <Widget title="Calendar" icon="◈" action={
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={refreshing} className="text-[10px] text-[#4a7a9b] hover:text-[#00d4ff] transition-colors disabled:opacity-40" title="Refresh">↻</button>
        <Link href="/onboarding" className="text-[10px] text-[#4a7a9b] hover:text-[#00d4ff] transition-colors">⚙</Link>
      </div>
    }>
      <div className="flex gap-5">
        {/* Left — month calendar */}
        <MonthCalendar events={events ?? []} />

        {/* Divider */}
        <div className="w-px bg-[#1a3a5c] shrink-0" />

        {/* Right — upcoming events */}
        <div className="flex-1 min-w-0">
          {events === null ? (
            <div className="text-[#4a7a9b] text-xs">Loading…</div>
          ) : events.length === 0 ? (
            <div className="text-[#4a7a9b] text-[11px] text-center py-1">No upcoming events</div>
          ) : (
            <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 180 }}>
              {events.map((ev, i) => (
                <div key={i} className="flex items-start gap-2 bg-[#060e1c] rounded-lg px-2.5 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-white truncate">{ev.title}</div>
                    <div className="text-[10px] text-[#4a7a9b] mt-0.5">{ev.startStr}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Widget>
  );
}

// ─── Tasks widget ─────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<Task["priority"], string> = {
  high: "bg-red-400", normal: "bg-[#00d4ff]", low: "bg-[#1a3a5c]",
};

function TasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  function fetchTasks() {
    return supabase.from("tasks").select("*").eq("user_id", USER_ID)
      .in("status", ["in_progress", "todo"]).order("created_at", { ascending: true })
      .then(({ data }) => {
        const sorted = ((data as Task[]) ?? []).sort((a, b) => {
          const sd = STATUS_WEIGHT[b.status] - STATUS_WEIGHT[a.status];
          return sd !== 0 ? sd : PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        });
        setTasks(sorted.slice(0, 8));
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchTasks();
    const channel = supabase.channel("tasks_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${USER_ID}` }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Widget title="Tasks" icon="✓" action={
      <Link href="/tasks" className="text-[10px] text-[#00d4ff] hover:text-white transition-colors">View all →</Link>
    }>
      {loading ? <div className="text-[#4a7a9b] text-xs">Loading…</div>
        : tasks.length === 0 ? <div className="text-[#4a7a9b] text-[11px] text-center py-1">No open tasks</div>
        : (
          <div className="flex flex-col gap-1.5">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 bg-[#060e1c] rounded-lg px-2.5 py-1.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority]}`} />
                <span className="text-[11px] text-white truncate flex-1">{t.title}</span>
                {t.status === "in_progress" && <span className="text-[9px] text-yellow-500 shrink-0">Active</span>}
              </div>
            ))}
          </div>
        )}
    </Widget>
  );
}

// ─── Routine widget ───────────────────────────────────────────────────────────

function RoutineWidget() {
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().getDay();

  function applyFilter(all: RoutineItem[]) {
    return all.filter(i => !i.days || i.days.length === 0 || i.days.includes(today));
  }

  function fetchAll() {
    return supabase.from("routine_items").select("*").eq("user_id", USER_ID)
      .order("order_index", { ascending: true })
      .then(({ data }) => { setItems(applyFilter((data as RoutineItem[]) ?? [])); setLoading(false); });
  }

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("routine_items_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "routine_items", filter: `user_id=eq.${USER_ID}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(item: RoutineItem) {
    await supabase.from("routine_items").update({ is_done: !item.is_done }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: !i.is_done } : i));
  }

  return (
    <Widget title="Routine" icon="☑" action={
      <Link href="/routine" className="text-[10px] text-[#00d4ff] hover:text-white transition-colors">View all →</Link>
    }>
      {loading ? <div className="text-[#4a7a9b] text-xs">Loading…</div>
        : items.length === 0
          ? <div className="text-[#4a7a9b] text-[11px] text-center py-1">Nothing scheduled today</div>
          : (
            <div className="flex flex-col gap-1.5">
              {items.map(item => (
                <label key={item.id} className="flex items-center gap-2 bg-[#060e1c] rounded-lg px-2.5 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={item.is_done} onChange={() => toggle(item)} className="accent-[#00d4ff] shrink-0" />
                  <span className={`text-[11px] flex-1 truncate ${item.is_done ? "line-through text-[#4a7a9b]" : "text-white"}`}>
                    {item.title}
                  </span>
                </label>
              ))}
            </div>
          )}
    </Widget>
  );
}

// ─── Goals widget ─────────────────────────────────────────────────────────────

function formatTargetDate(dateStr: string | null): { text: string; urgent: boolean } | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { text: "overdue", urgent: false };
  if (diff === 0) return { text: "today", urgent: true };
  if (diff <= 7) return { text: `${diff}d`, urgent: true };
  return {
    text: target.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    urgent: false,
  };
}

function GoalsWidget() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  function fetchGoals() {
    return supabase.from("goals").select("*").eq("user_id", USER_ID)
      .order("created_at", { ascending: true })
      .then(({ data }) => { setGoals((data as Goal[]) ?? []); setLoading(false); });
  }

  useEffect(() => {
    fetchGoals();
    const channel = supabase.channel("goals_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${USER_ID}` }, () => fetchGoals())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Widget title="Goals" icon="◎" action={
      <Link href="/goals" className="text-[10px] text-[#00d4ff] hover:text-white transition-colors">View all →</Link>
    }>
      {loading ? <div className="text-[#4a7a9b] text-xs">Loading…</div>
        : goals.length === 0
          ? <div className="text-[#4a7a9b] text-[11px] text-center py-1">No goals yet — <Link href="/goals" className="text-[#00d4ff] hover:text-white transition-colors">add one ↗</Link></div>
          : (
            <div className="flex flex-col gap-1.5">
              {goals.slice(0, 5).map(g => {
                const dateLabel = formatTargetDate(g.target_date);
                return (
                  <div key={g.id} className="flex items-center gap-2 bg-[#060e1c] rounded-lg px-2.5 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] shrink-0" />
                    <span className="text-[11px] text-white truncate flex-1">{g.title}</span>
                    {dateLabel && (
                      <span className={`text-[9px] shrink-0 ${dateLabel.urgent ? "text-amber-400" : "text-[#4a7a9b]"}`}>
                        {dateLabel.text}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
    </Widget>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

const GRID_BG = {
  backgroundImage: "linear-gradient(#00d4ff 1px, transparent 1px), linear-gradient(90deg, #00d4ff 1px, transparent 1px)",
  backgroundSize: "40px 40px",
};

export default function Dashboard() {
  // Detect viewport ONCE after mount and render only ONE layout.
  // Using CSS to show/hide both layouts simultaneously caused duplicate
  // Supabase channel subscriptions and double LiveKit connections — both crash.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Brief loading state while viewport is detected (one frame)
  if (isMobile === null) {
    return (
      <div className="h-screen bg-[#050b14] flex items-center justify-center">
        <span className="text-[10px] text-[#1a3a5c] uppercase tracking-widest">Loading…</span>
      </div>
    );
  }

  // ── DESKTOP LAYOUT (≥ 768px) ────────────────────────────────────────────────
  // VoiceOrbMini lives in PageShell's sidebar — no orb rendered here.
  if (!isMobile) {
    return (
      <PageShell>
        <div className="p-6 h-full overflow-auto">
          <div className="grid grid-cols-2 gap-4">
            {/* Row 1 — Calendar (full width) */}
            <div className="col-span-2">
              <CalendarWidget />
            </div>

            {/* Row 2 — Routine (left) + Tasks (right) */}
            <RoutineWidget />
            <TasksWidget />

            {/* Row 3 — Goals (full width) */}
            <div className="col-span-2">
              <GoalsWidget />
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── MOBILE LAYOUT (< 768px) ─────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#050b14] text-white flex flex-col overflow-hidden">
      {/* Centered branding */}
      <div className="flex flex-col items-center pt-8 pb-2 shrink-0">
        <span className="text-base font-bold tracking-[0.3em] text-[#00d4ff]">
          F.R.I.D.A.Y
        </span>
        <span className="text-[9px] text-[#4a7a9b] tracking-widest mt-1 uppercase text-center px-4">
          Fully Responsive Intelligent Digital Assistant For You
        </span>
      </div>

      <MobileSwipePanels
        initialPanel={1}
        panels={[
          // Panel 0 — Calendar + Tasks
          <div key="left" className="px-3 pt-3 pb-16 space-y-3">
            <CalendarWidget />
            <TasksWidget />
          </div>,

          // Panel 1 — Voice orb (hero)
          <div key="center" className="relative flex flex-col items-center justify-center h-full pb-12">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={GRID_BG} />
            <div className="relative z-10" style={{ transform: "scale(0.78)", transformOrigin: "center center" }}>
              <VoiceOrb autoConnect />
            </div>
          </div>,

          // Panel 2 — Routine + Goals
          <div key="right" className="px-3 pt-3 pb-16 space-y-3">
            <RoutineWidget />
            <GoalsWidget />
          </div>,
        ]}
      />

      <MobileBottomNav />
    </div>
  );
}
