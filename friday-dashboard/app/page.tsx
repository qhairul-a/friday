"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, USER_ID } from "@/lib/supabase";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { Task, RoutineItem, Goal } from "@/lib/types";
import PageShell from "./components/page-shell";
import VoiceOrb from "./components/voice-orb";
import MobileSwipePanels from "./components/mobile-swipe-panels";
import MobileBottomNav from "./components/mobile-bottom-nav";
import { HealthAnalyticsPanel } from "./components/health-charts";
import HealthWidget from "./components/health-widget";

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

// ─── World clock panel ────────────────────────────────────────────────────────

const TZ_OPTIONS: { group: string; cities: { label: string; tz: string }[] }[] = [
  { group: "Asia & Middle East", cities: [
    { label: "Singapore",        tz: "Asia/Singapore" },
    { label: "Kuala Lumpur",     tz: "Asia/Kuala_Lumpur" },
    { label: "Jakarta",          tz: "Asia/Jakarta" },
    { label: "Bangkok",          tz: "Asia/Bangkok" },
    { label: "Ho Chi Minh City", tz: "Asia/Ho_Chi_Minh" },
    { label: "Manila",           tz: "Asia/Manila" },
    { label: "Hong Kong",        tz: "Asia/Hong_Kong" },
    { label: "Taipei",           tz: "Asia/Taipei" },
    { label: "Shanghai",         tz: "Asia/Shanghai" },
    { label: "Seoul",            tz: "Asia/Seoul" },
    { label: "Tokyo",            tz: "Asia/Tokyo" },
    { label: "Kolkata",          tz: "Asia/Kolkata" },
    { label: "Dhaka",            tz: "Asia/Dhaka" },
    { label: "Karachi",          tz: "Asia/Karachi" },
    { label: "Dubai",            tz: "Asia/Dubai" },
    { label: "Riyadh",           tz: "Asia/Riyadh" },
    { label: "Tehran",           tz: "Asia/Tehran" },
    { label: "Istanbul",         tz: "Europe/Istanbul" },
  ]},
  { group: "Australia & Pacific", cities: [
    { label: "Sydney",    tz: "Australia/Sydney" },
    { label: "Melbourne", tz: "Australia/Melbourne" },
    { label: "Brisbane",  tz: "Australia/Brisbane" },
    { label: "Perth",     tz: "Australia/Perth" },
    { label: "Auckland",  tz: "Pacific/Auckland" },
    { label: "Honolulu",  tz: "Pacific/Honolulu" },
  ]},
  { group: "Europe", cities: [
    { label: "London",    tz: "Europe/London" },
    { label: "Dublin",    tz: "Europe/Dublin" },
    { label: "Lisbon",    tz: "Europe/Lisbon" },
    { label: "Paris",     tz: "Europe/Paris" },
    { label: "Berlin",    tz: "Europe/Berlin" },
    { label: "Amsterdam", tz: "Europe/Amsterdam" },
    { label: "Rome",      tz: "Europe/Rome" },
    { label: "Madrid",    tz: "Europe/Madrid" },
    { label: "Zurich",    tz: "Europe/Zurich" },
    { label: "Stockholm", tz: "Europe/Stockholm" },
    { label: "Warsaw",    tz: "Europe/Warsaw" },
    { label: "Moscow",    tz: "Europe/Moscow" },
  ]},
  { group: "Americas", cities: [
    { label: "New York",     tz: "America/New_York" },
    { label: "Toronto",      tz: "America/Toronto" },
    { label: "Chicago",      tz: "America/Chicago" },
    { label: "Denver",       tz: "America/Denver" },
    { label: "Los Angeles",  tz: "America/Los_Angeles" },
    { label: "Vancouver",    tz: "America/Vancouver" },
    { label: "Mexico City",  tz: "America/Mexico_City" },
    { label: "Bogotá",       tz: "America/Bogota" },
    { label: "São Paulo",    tz: "America/Sao_Paulo" },
    { label: "Buenos Aires", tz: "America/Argentina/Buenos_Aires" },
  ]},
  { group: "Africa", cities: [
    { label: "Cairo",        tz: "Africa/Cairo" },
    { label: "Lagos",        tz: "Africa/Lagos" },
    { label: "Nairobi",      tz: "Africa/Nairobi" },
    { label: "Johannesburg", tz: "Africa/Johannesburg" },
  ]},
  { group: "UTC", cities: [
    { label: "UTC", tz: "UTC" },
  ]},
];

function WorldClockPanel() {
  const [now, setNow] = useState(new Date());
  const [timezones, setTimezones] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [selectVal, setSelectVal] = useState("");
  const [inputError, setInputError] = useState("");
  const [saving, setSaving] = useState(false);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load timezone list — localStorage is the source of truth after first visit
  useEffect(() => {
    const cached = localStorage.getItem("friday_world_clock_timezones");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) { setTimezones(parsed); return; }
      } catch {}
    }
    // localStorage empty — bootstrap from Supabase once
    supabase.from("profiles").select("data").eq("user_id", USER_ID).single()
      .then(({ data }) => {
        const profile = ((data as { data?: unknown })?.data ?? {}) as import("@/lib/types").FridayProfile;
        let tzList: string[] = profile?.preferences?.world_clock_timezones ?? [];
        if (tzList.length === 0 && profile?.identity?.timezone)
          tzList = [profile.identity.timezone];
        if (tzList.length > 0) {
          setTimezones(tzList);
          localStorage.setItem("friday_world_clock_timezones", JSON.stringify(tzList));
        }
      });
  }, []);

  function formatTime(tz: string) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "2-digit", minute: "2-digit",
        second: "2-digit", hour12: false,
      }).format(now);
    } catch {
      return "--:--:--";
    }
  }

  async function saveTz(newList: string[]) {
    localStorage.setItem("friday_world_clock_timezones", JSON.stringify(newList));
    setSaving(true);
    try {
      const { data } = await supabase.from("profiles").select("data").eq("user_id", USER_ID).single();
      const profile = { ...((data as { data?: unknown })?.data as import("@/lib/types").FridayProfile ?? {}) };
      profile.preferences = { ...profile.preferences, world_clock_timezones: newList };
      await supabase.from("profiles").upsert({ user_id: USER_ID, data: profile, updated_at: new Date().toISOString() });
    } finally {
      setSaving(false);
    }
  }

  function addTz() {
    if (!selectVal) { setInputError("Please select a timezone"); return; }
    if (timezones.includes(selectVal)) { setInputError("Already in list"); return; }
    const next = [...timezones, selectVal];
    setTimezones(next);
    saveTz(next);
    setSelectVal(""); setInputError("");
  }

  function removeTz(tz: string) {
    const next = timezones.filter(t => t !== tz);
    setTimezones(next);
    saveTz(next);
  }

  // Flatten all options for label lookup
  const allOptions = TZ_OPTIONS.flatMap(g => g.cities);
  const cityLabelFromOptions = (tz: string) =>
    allOptions.find(o => o.tz === tz)?.label ?? tz.split("/").pop()!.replace(/_/g, " ");

  // Already-added tzs to grey out in dropdown
  const addedSet = new Set(timezones);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest text-[#4a7a9b]">World Clock</p>
        <button
          onClick={() => { setEditing(e => !e); setSelectVal(""); setInputError(""); }}
          className="text-xs font-semibold text-[#4a7a9b] hover:text-[#00d4ff] hover:bg-[#0d2240] px-2 py-1 rounded-md transition-all"
          title={editing ? "Done" : "Edit timezones"}
        >
          {editing ? "✓ Done" : "⚙ Edit"}
        </button>
      </div>

      {/* Clock list / Edit list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5" style={{ maxHeight: 160 }}>
        {timezones.length === 0 && !editing && (
          <p className="text-xs text-[#364c61] text-center py-3">No timezones — click ⚙ Edit to add</p>
        )}
        {timezones.map((tz) => (
          <div key={tz} className="flex items-center justify-between gap-2">
            {editing ? (
              <>
                <span className="text-xs text-[#4a7a9b] truncate flex-1">{cityLabelFromOptions(tz)}</span>
                <button
                  onClick={() => removeTz(tz)}
                  className="text-sm font-bold text-[#4a7a9b] hover:text-red-400 hover:bg-red-400/10 w-7 h-7 flex items-center justify-center rounded-md transition-all shrink-0"
                  title={`Remove ${tz}`}
                >
                  ×
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-white truncate">{cityLabelFromOptions(tz)}</span>
                <span className="text-sm font-mono text-[#00d4ff] shrink-0 tabular-nums">{formatTime(tz)}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add dropdown (edit mode only) */}
      {editing && (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex gap-2">
            <select
              value={selectVal}
              onChange={e => { setSelectVal(e.target.value); setInputError(""); }}
              className="flex-1 min-w-0 bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00d4ff]/50 focus:ring-1 focus:ring-[#00d4ff]/20 cursor-pointer"
            >
              <option value="" disabled>Select a city…</option>
              {TZ_OPTIONS.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.cities.map(city => (
                    <option
                      key={city.tz}
                      value={city.tz}
                      disabled={addedSet.has(city.tz)}
                    >
                      {city.label}{addedSet.has(city.tz) ? " ✓" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={addTz}
              disabled={saving || !selectVal}
              className="px-3 py-2 text-xs font-semibold text-[#00d4ff] border border-[#00d4ff]/40 rounded-lg hover:bg-[#00d4ff]/15 hover:border-[#00d4ff]/70 active:bg-[#00d4ff]/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add
            </button>
          </div>
          {inputError && <p className="text-[10px] text-red-400">{inputError}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Calendar widget ──────────────────────────────────────────────────────────

interface CalendarEvent { title: string; start: string; startStr: string; }

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function MonthCalendar({ events, fullWidth = false }: { events: CalendarEvent[]; fullWidth?: boolean }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  function prev() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function next() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const eventDays = new Set(
    events
      .filter((ev) => {
        const d = new Date(ev.start);
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
      })
      .map((ev) => new Date(ev.start).getDate())
  );

  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className={fullWidth ? "w-full" : "shrink-0"} style={fullWidth ? undefined : { width: 200 }}>
      {/* Month header with prev/next */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prev} className="text-[#4a7a9b] hover:text-[#00d4ff] transition-colors text-sm px-1">‹</button>
        <div className="text-[11px] font-semibold text-white">{monthLabel}</div>
        <button onClick={next} className="text-[#4a7a9b] hover:text-[#00d4ff] transition-colors text-sm px-1">›</button>
      </div>
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
                : isCurrentMonth && day === today.getDate()
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
  const { data: events, loading: refreshing, refresh: load } = useCachedFetch<CalendarEvent[]>("/api/calendar", 60_000);

  return (
    <Widget title="Calendar" icon="◈" action={
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={refreshing} className="text-[10px] text-[#4a7a9b] hover:text-[#00d4ff] transition-colors disabled:opacity-40" title="Refresh">↻</button>
        <Link href="/onboarding" className="text-[10px] text-[#4a7a9b] hover:text-[#00d4ff] transition-colors">⚙</Link>
      </div>
    }>
      <div className="flex gap-4">
        {/* ── Left 2/3 — month calendar + upcoming events ── */}
        <div className="flex-[2] flex gap-5 min-w-0">
          <MonthCalendar events={events ?? []} />

          {/* Inner divider */}
          <div className="w-px bg-[#1a3a5c] shrink-0" />

          {/* Upcoming events */}
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

        {/* ── Section divider ── */}
        <div className="w-px bg-[#1a3a5c] shrink-0" />

        {/* ── Right 1/3 — world clock ── */}
        <div className="flex-[1] min-w-0">
          <WorldClockPanel />
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

// ─── Desktop panel slider ─────────────────────────────────────────────────────

const DESKTOP_PANELS = ["Productivity", "Health"] as const;

function DesktopPanelSlider() {
  const [panel, setPanel] = useState(0);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Nav bar */}
      <div className="shrink-0 flex items-center justify-center gap-4 px-6 py-3 border-b border-[#1a3a5c]">
        <button
          onClick={() => setPanel(p => Math.max(0, p - 1))}
          disabled={panel === 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4a7a9b] hover:text-[#00d4ff] hover:bg-[#0d2240] transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-base"
        >
          ‹
        </button>

        <div className="flex items-center gap-3 min-w-[140px] justify-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-white">
            {DESKTOP_PANELS[panel]}
          </span>
          <div className="flex gap-1.5">
            {DESKTOP_PANELS.map((_, i) => (
              <button
                key={i}
                onClick={() => setPanel(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === panel ? "bg-[#00d4ff]" : "bg-[#1a3a5c] hover:bg-[#4a7a9b]"
                }`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => setPanel(p => Math.min(DESKTOP_PANELS.length - 1, p + 1))}
          disabled={panel === DESKTOP_PANELS.length - 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4a7a9b] hover:text-[#00d4ff] hover:bg-[#0d2240] transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-base"
        >
          ›
        </button>
      </div>

      {/* Slide container */}
      <div className="flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${panel * 100}%)` }}
        >
          {/* Panel 0 — Productivity */}
          <div className="w-full shrink-0 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <CalendarWidget />
              </div>
              <RoutineWidget />
              <TasksWidget />
              <div className="col-span-2">
                <GoalsWidget />
              </div>
            </div>
          </div>

          {/* Panel 1 — Health */}
          <div className="w-full shrink-0 overflow-y-auto p-6">
            <HealthAnalyticsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Last expense widget (mobile) ────────────────────────────────────────────

interface ExpenseRow {
  date: string;
  category: string;
  description: string;
  amount: number;
}

function LastExpenseWidget() {
  const [expense, setExpense] = useState<ExpenseRow | null>(null);

  useEffect(() => {
    supabase
      .from("expenses")
      .select("date,category,description,amount")
      .eq("user_id", USER_ID)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) setExpense(data[0] as ExpenseRow);
      });
  }, []);

  if (!expense) return null;

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <Widget title="Last Expense" icon="$">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{expense.description}</p>
          <p className="text-[10px] text-[#4a7a9b] mt-0.5 capitalize">{expense.category} · {fmtDate(expense.date)}</p>
        </div>
        <span className="text-sm font-bold text-[#00d4ff] shrink-0">
          SGD {expense.amount.toFixed(2)}
        </span>
      </div>
    </Widget>
  );
}

// ─── Mobile calendar panel (stacked: month view on top, events list below) ────

function MobileCalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    setRefreshing(true);
    fetch(`/api/calendar?_t=${Date.now()}`)
      .then((r) => r.json())
      .then((data: CalendarEvent[]) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="px-3 pt-3 pb-24 overflow-y-auto">
      <Widget
        title="Calendar"
        icon="◈"
        action={
          <button
            onClick={load}
            disabled={refreshing}
            className="text-[10px] text-[#4a7a9b] hover:text-[#00d4ff] transition-colors disabled:opacity-40"
            title="Refresh"
          >
            ↻
          </button>
        }
      >
        {/* Month grid — full width */}
        <MonthCalendar events={events ?? []} fullWidth />

        {/* Divider */}
        <div className="w-full h-px bg-[#1a3a5c] my-3" />

        {/* Upcoming events list */}
        {events === null ? (
          <div className="text-[#4a7a9b] text-xs">Loading…</div>
        ) : events.length === 0 ? (
          <div className="text-[#4a7a9b] text-[11px] text-center py-1">No upcoming events</div>
        ) : (
          <div className="flex flex-col gap-1.5">
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
      </Widget>
    </div>
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
        <DesktopPanelSlider />
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
          // Panel 0 — Routine + Tasks + Last Expense
          <div key="productivity" className="px-3 pt-3 pb-24 space-y-3 overflow-y-auto">
            <RoutineWidget />
            <TasksWidget />
            <LastExpenseWidget />
          </div>,

          // Panel 1 — Voice orb (hero, center default)
          <div key="orb" className="relative flex flex-col items-center justify-center h-full pb-20">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={GRID_BG} />
            <div className="relative z-10" style={{ transform: "scale(0.78)", transformOrigin: "center center" }}>
              <VoiceOrb autoConnect />
            </div>
          </div>,

          // Panel 2 — Calendar: month view (top) + events list (bottom)
          <MobileCalendarPanel key="calendar" />,

          // Panel 3 — Health: widget snapshot + full analytics (scrollable)
          <div key="health" className="px-3 pt-3 pb-24 overflow-y-auto">
            <HealthWidget />
            <div className="mt-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#364c61] mb-3">Analytics</p>
              <HealthAnalyticsPanel />
            </div>
          </div>,
        ]}
      />

      <MobileBottomNav />
    </div>
  );
}
