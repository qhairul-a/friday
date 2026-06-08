"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface FitnessData {
  steps?: number;
  calories?: number;
  sleep_duration_min?: number;
  hrv_score?: number;
  body_battery_high?: number;
  stress_avg?: number;
  active_minutes?: number;
  resting_hr?: number;
  sleep_score?: number;
}

const SECTION: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 8.5,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: "var(--text-3)", marginBottom: 8,
};
const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(34,211,238,0.07)",
  borderRadius: 12, padding: "12px 14px", marginBottom: 10,
};

export default function FitnessTab() {
  const [data,    setData]    = useState<FitnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const d = await apiFetch<FitnessData>("/fitness/today");
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function sync() {
    setSyncing(true);
    try {
      await apiFetch("/fitness/sync", { method: "POST" });
      await fetchData();
    } catch {
      /* silent */
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return (
    <div style={{ padding: 16, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
  );

  const sleepHours = data?.sleep_duration_min
    ? (data.sleep_duration_min / 60).toFixed(1)
    : null;

  const noData = !data || Object.entries(data).filter(([k]) => k !== "date").every(([, v]) => v == null);

  const metrics: { label: string; value: string; unit: string; color: string }[] = [
    { label: "Steps",        value: data?.steps?.toLocaleString()         ?? "—", unit: "steps",  color: "var(--cyan)"   },
    { label: "Calories",     value: data?.calories?.toLocaleString()      ?? "—", unit: "kcal",   color: "var(--orange)" },
    { label: "Active",       value: data?.active_minutes?.toString()      ?? "—", unit: "min",    color: "#34d399"       },
    { label: "Sleep",        value: sleepHours                            ?? "—", unit: "hrs",    color: "var(--violet)" },
    { label: "Sleep Score",  value: data?.sleep_score?.toString()         ?? "—", unit: "/ 100",  color: "var(--violet)" },
    { label: "HRV",          value: data?.hrv_score?.toString()           ?? "—", unit: "ms",     color: "#34d399"       },
    { label: "Resting HR",   value: data?.resting_hr?.toString()          ?? "—", unit: "bpm",    color: "#f87171"       },
    { label: "Body Battery", value: data?.body_battery_high?.toString()   ?? "—", unit: "/ 100",  color: "var(--cyan)"   },
    { label: "Stress",       value: data?.stress_avg?.toString()          ?? "—", unit: "avg",    color: "var(--orange)" },
  ];

  return (
    <div style={{ padding: "14px 14px 80px" }}>

      {/* Sync button */}
      <button
        onClick={sync}
        disabled={syncing}
        style={{
          width: "100%", padding: "10px", borderRadius: 10, marginBottom: 12,
          background: syncing ? "rgba(34,211,238,0.04)" : "rgba(34,211,238,0.08)",
          border: "1px solid rgba(34,211,238,0.2)",
          color: syncing ? "var(--text-3)" : "var(--cyan)",
          fontFamily: "var(--font-mono)", fontSize: 11,
          letterSpacing: "0.08em", cursor: syncing ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <span style={{ animation: syncing ? "spin 1s linear infinite" : "none", display: "inline-block" }}>↺</span>
        {syncing ? "Syncing Garmin…" : "Sync Garmin"}
      </button>

      <div style={SECTION}>Today</div>

      {noData ? (
        <div style={CARD}>
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>
            No fitness data for today. Tap Sync Garmin above.
          </p>
        </div>
      ) : (
        <div style={CARD}>
          {metrics.map((m, i) => (
            <div key={m.label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              paddingBottom: i < metrics.length - 1 ? 10 : 0,
              marginBottom: i < metrics.length - 1 ? 10 : 0,
              borderBottom: i < metrics.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>{m.label}</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600, color: m.value === "—" ? "var(--text-3)" : m.color }}>
                  {m.value}
                </span>
                {m.value !== "—" && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", marginLeft: 4 }}>
                    {m.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
