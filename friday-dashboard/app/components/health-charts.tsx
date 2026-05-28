"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart, BarChart, LineChart,
  Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ReferenceLine, Cell, ResponsiveContainer,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HealthRow = {
  date: string;
  steps: number | null;
  distance_km: number | null;
  heart_rate_avg: number | null;
  heart_rate_resting: number | null;
  stress_avg: number | null;
  sleep_duration_hrs: number | null;
  sleep_deep_hrs: number | null;
  sleep_light_hrs: number | null;
  sleep_rem_hrs: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function stressColor(v: number) {
  if (v < 26) return "#22c55e";
  if (v < 51) return "#eab308";
  return "#ef4444";
}

export const GRID   = "#1a3a5c";
export const TICK   = "#4a7a9b";
const TT_BG  = "#07101f";
const TT_BDR = "#1a3a5c";

// ── Shared tooltip style ──────────────────────────────────────────────────────

export const tooltipStyle = {
  backgroundColor: TT_BG,
  border: `1px solid ${TT_BDR}`,
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
};

// ── Chart card wrapper ────────────────────────────────────────────────────────

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#07101f] border border-[#1a3a5c] rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#4a7a9b] mb-4">{title}</p>
      {children}
    </div>
  );
}

// ── 1. Steps & Distance ───────────────────────────────────────────────────────

export function StepsDistanceChart({ data }: { data: HealthRow[] }) {
  const rows = data.map(r => ({
    date: fmtDate(r.date),
    steps: r.steps ?? 0,
    distance: r.distance_km ?? 0,
  }));

  return (
    <ChartCard title="Steps & Distance">
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="steps" tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={36} />
          <YAxis yAxisId="dist" orientation="right" tick={{ fill: TICK, fontSize: 10 }}
            axisLine={false} tickLine={false} tickFormatter={v => `${v}km`} width={40} />
          <Tooltip contentStyle={tooltipStyle}
            formatter={(v, name) => name === "Steps" ? [Number(v).toLocaleString(), "Steps"] : [`${v} km`, "Distance"]} />
          <Legend wrapperStyle={{ fontSize: 11, color: TICK }} />
          <Bar yAxisId="steps" dataKey="steps" name="Steps" fill="#1a6bb5" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Line yAxisId="dist" dataKey="distance" name="Distance" stroke="#00d4ff" strokeWidth={2}
            dot={{ r: 3, fill: "#00d4ff" }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 2. Heart Rate ─────────────────────────────────────────────────────────────

export function HeartRateChart({ data }: { data: HealthRow[] }) {
  const rows = data.map(r => ({
    date: fmtDate(r.date),
    avg: r.heart_rate_avg,
    resting: r.heart_rate_resting,
  }));

  return (
    <ChartCard title="Heart Rate (bpm)">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false}
            domain={["auto", "auto"]} width={32} />
          <Tooltip contentStyle={tooltipStyle}
            formatter={(v, name) => [`${v} bpm`, name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: TICK }} />
          <Line dataKey="avg" name="Avg HR" stroke="#ff6b6b" strokeWidth={2}
            dot={{ r: 3, fill: "#ff6b6b" }} activeDot={{ r: 5 }} connectNulls />
          <Line dataKey="resting" name="Resting HR" stroke="#ffaa5c" strokeWidth={2}
            strokeDasharray="4 2" dot={{ r: 3, fill: "#ffaa5c" }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 3. Stress Level ───────────────────────────────────────────────────────────

export function StressChart({ data }: { data: HealthRow[] }) {
  const rows = data.map(r => ({
    date: fmtDate(r.date),
    stress: r.stress_avg,
    color: r.stress_avg != null ? stressColor(r.stress_avg) : "#1a3a5c",
  }));

  return (
    <ChartCard title="Stress Level">
      <div className="flex gap-4 mb-3">
        {[{ label: "Low", color: "#22c55e" }, { label: "Moderate", color: "#eab308" }, { label: "High", color: "#ef4444" }].map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-[10px] text-[#4a7a9b]">{s.label}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false}
            domain={[0, 100]} width={28} />
          <Tooltip contentStyle={tooltipStyle}
            formatter={v => [`${v}`, "Stress"]} />
          <ReferenceLine y={26} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={51} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Bar dataKey="stress" name="Stress" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── 4. Sleep ──────────────────────────────────────────────────────────────────

export function SleepChart({ data }: { data: HealthRow[] }) {
  const hasSleepStages = data.some(r => r.sleep_deep_hrs != null || r.sleep_rem_hrs != null);

  const rows = data.map(r => ({
    date: fmtDate(r.date),
    total: r.sleep_duration_hrs,
    deep: r.sleep_deep_hrs,
    rem: r.sleep_rem_hrs,
    light: r.sleep_light_hrs,
  }));

  return (
    <ChartCard title="Sleep Duration (hrs)">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false}
            domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} width={28} />
          <Tooltip contentStyle={tooltipStyle}
            formatter={(v, name) => [`${Number(v).toFixed(1)}h`, name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: TICK }} />
          <ReferenceLine y={7} stroke="#00d4ff" strokeDasharray="4 2" strokeOpacity={0.4}
            label={{ value: "7h target", position: "insideTopRight", fill: "#4a7a9b", fontSize: 10 }} />
          {hasSleepStages ? (
            <>
              <Bar dataKey="deep"  name="Deep"  stackId="sleep" fill="#4f46e5" radius={[0, 0, 0, 0]} maxBarSize={28} />
              <Bar dataKey="rem"   name="REM"   stackId="sleep" fill="#7c3aed" maxBarSize={28} />
              <Bar dataKey="light" name="Light" stackId="sleep" fill="#a78bfa" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </>
          ) : (
            <Bar dataKey="total" name="Sleep" fill="#4f46e5" radius={[3, 3, 0, 0]} maxBarSize={28} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Self-contained analytics panel (used on home dashboard + /health page) ────

const RANGES = [7, 14, 30] as const;
type Range = typeof RANGES[number];

export function HealthAnalyticsPanel() {
  const [days, setDays] = useState<Range>(14);
  const [data, setData] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/health/trends?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  const latest = data[data.length - 1];

  return (
    <div className="space-y-5">
      {/* Range selector + snapshot chips */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Latest snapshot chips */}
        <div className="flex flex-wrap gap-2">
          {latest && [
            { label: "Steps", value: latest.steps?.toLocaleString() ?? "—" },
            { label: "Distance", value: latest.distance_km ? `${latest.distance_km} km` : "—" },
            { label: "Avg HR", value: latest.heart_rate_avg ? `${latest.heart_rate_avg} bpm` : "—" },
            { label: "Stress", value: latest.stress_avg != null ? `${latest.stress_avg}` : "—" },
            { label: "Sleep", value: latest.sleep_duration_hrs
              ? `${Math.floor(latest.sleep_duration_hrs)}h ${Math.round((latest.sleep_duration_hrs % 1) * 60)}m`
              : "—" },
            { label: "Body Battery", value: latest.body_battery_high != null
              ? `${latest.body_battery_low}–${latest.body_battery_high}`
              : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#0d2240] border border-[#1a3a5c] rounded-lg px-3 py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-[#4a7a9b]">{label}</p>
              <p className="text-xs font-semibold text-white mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Range selector */}
        <div className="flex gap-1 bg-[#07101f] border border-[#1a3a5c] rounded-xl p-1 shrink-0">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                days === r
                  ? "bg-[#0d2240] text-[#00d4ff] border border-[#1a3a5c]"
                  : "text-[#4a7a9b] hover:text-white"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      {loading ? (
        <div className="text-center py-16 text-[#4a7a9b] text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-[#4a7a9b] text-sm">
          No health data yet — sync runs every 4 hours.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StepsDistanceChart data={data} />
          <HeartRateChart data={data} />
          <StressChart data={data} />
          <SleepChart data={data} />
        </div>
      )}
    </div>
  );
}
