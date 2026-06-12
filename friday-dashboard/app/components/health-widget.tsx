"use client";

import { useCachedFetch } from "@/lib/use-cached-fetch";
import Link from "next/link";

interface HealthMetrics {
  date: string;
  steps: number | null;
  steps_goal: number | null;
  distance_km: number | null;
  calories_active: number | null;
  calories_total: number | null;
  active_minutes: number | null;
  floors_climbed: number | null;
  heart_rate_resting: number | null;
  heart_rate_avg: number | null;
  hrv_weekly_avg: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  stress_avg: number | null;
  spo2_avg: number | null;
  sleep_duration_hrs: number | null;
  sleep_score: number | null;
  sleep_deep_hrs: number | null;
  sleep_light_hrs: number | null;
  sleep_rem_hrs: number | null;
  vo2_max: number | null;
}

interface HealthResponse {
  metrics: HealthMetrics | null;
  enabled: string[];
  connected: boolean;
}

const METRIC_LABELS: Record<string, string> = {
  steps: "Steps",
  distance: "Distance",
  calories_active: "Active Cal",
  active_minutes: "Active Min",
  floors_climbed: "Floors",
  heart_rate_resting: "Resting HR",
  heart_rate_avg: "Avg HR",
  hrv: "HRV",
  body_battery: "Body Battery",
  stress_avg: "Stress",
  spo2: "SpO2",
  sleep_duration: "Sleep",
  sleep_score: "Sleep Score",
  sleep_stages: "Sleep Stages",
  vo2_max: "VO2 Max",
};

function stressLabel(v: number) {
  return v < 26 ? "Low" : v < 51 ? "Moderate" : "High";
}

function sleepHrs(hrs: number) {
  const h = Math.floor(hrs);
  const m = Math.round((hrs % 1) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-[#4a7a9b]">{label}</span>
      <span className="text-sm font-semibold text-white leading-tight">{value}</span>
    </div>
  );
}

export default function HealthWidget() {
  const { data } = useCachedFetch<HealthResponse>("/api/health", 60_000);

  if (!data) {
    return (
      <div className="bg-[#07101f] border border-[#1a3a5c] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">♡</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#4a7a9b]">Health</span>
        </div>
        <p className="text-xs text-[#4a7a9b]">Loading…</p>
      </div>
    );
  }

  if (!data.connected) {
    return (
      <div className="bg-[#07101f] border border-[#1a3a5c] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">♡</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#4a7a9b]">Health</span>
        </div>
        <Link href="/onboarding" className="text-xs text-[#00d4ff] hover:underline">
          Connect Garmin in Settings ›
        </Link>
      </div>
    );
  }

  if (!data.metrics) {
    return (
      <div className="bg-[#07101f] border border-[#1a3a5c] rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">♡</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#4a7a9b]">Health</span>
        </div>
        <p className="text-xs text-[#4a7a9b]">Syncing… check back in a few minutes.</p>
      </div>
    );
  }

  const m = data.metrics;
  const en = data.enabled;
  const chips: { label: string; value: string }[] = [];

  if (m.steps) {
    const pct = m.steps_goal ? ` (${Math.round((m.steps / m.steps_goal) * 100)}%)` : "";
    chips.push({ label: METRIC_LABELS.steps, value: `${m.steps.toLocaleString()}${pct}` });
    chips.push({ label: METRIC_LABELS.distance, value: m.distance_km ? `${m.distance_km} km` : "—" });
  }
  if (en.includes("body_battery") && m.body_battery_high != null) {
    chips.push({ label: METRIC_LABELS.body_battery, value: `${m.body_battery_low}–${m.body_battery_high}` });
  }
  if (en.includes("sleep_duration") && m.sleep_duration_hrs) {
    chips.push({ label: METRIC_LABELS.sleep_duration, value: sleepHrs(m.sleep_duration_hrs) });
  }
  if (en.includes("sleep_score") && m.sleep_score) {
    chips.push({ label: METRIC_LABELS.sleep_score, value: String(m.sleep_score) });
  }
  if (en.includes("heart_rate_avg") && m.heart_rate_avg) {
    chips.push({ label: METRIC_LABELS.heart_rate_avg, value: `${m.heart_rate_avg} bpm` });
  }
  if (en.includes("heart_rate_resting") && m.heart_rate_resting) {
    chips.push({ label: METRIC_LABELS.heart_rate_resting, value: `${m.heart_rate_resting} bpm` });
  }
  if (en.includes("stress_avg") && m.stress_avg) {
    chips.push({ label: METRIC_LABELS.stress_avg, value: `${m.stress_avg} · ${stressLabel(m.stress_avg)}` });
  }
  if (en.includes("calories_active") && m.calories_active) {
    chips.push({ label: METRIC_LABELS.calories_active, value: `${m.calories_active} kcal` });
  }
  if (en.includes("active_minutes") && m.active_minutes) {
    chips.push({ label: METRIC_LABELS.active_minutes, value: `${m.active_minutes} min` });
  }
  if (en.includes("floors_climbed") && m.floors_climbed) {
    chips.push({ label: METRIC_LABELS.floors_climbed, value: String(m.floors_climbed) });
  }
  if (en.includes("hrv") && m.hrv_weekly_avg) {
    chips.push({ label: METRIC_LABELS.hrv, value: String(m.hrv_weekly_avg) });
  }
  if (en.includes("spo2") && m.spo2_avg) {
    chips.push({ label: METRIC_LABELS.spo2, value: `${m.spo2_avg}%` });
  }
  if (en.includes("sleep_stages") && m.sleep_deep_hrs) {
    chips.push({ label: METRIC_LABELS.sleep_stages, value: `${m.sleep_deep_hrs}h deep / ${m.sleep_rem_hrs ?? 0}h REM` });
  }
  if (en.includes("vo2_max") && m.vo2_max) {
    chips.push({ label: METRIC_LABELS.vo2_max, value: String(m.vo2_max) });
  }

  return (
    <div className="bg-[#07101f] border border-[#1a3a5c] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">♡</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#4a7a9b]">Health</span>
        </div>
        <span className="text-[10px] text-[#4a7a9b]">{m.date}</span>
      </div>

      {chips.length === 0 ? (
        <p className="text-xs text-[#4a7a9b]">No metrics enabled. Update in Settings.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {chips.map((c) => (
            <MetricChip key={c.label} label={c.label} value={c.value} />
          ))}
        </div>
      )}
    </div>
  );
}
