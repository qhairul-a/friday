"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface FitnessData {
  steps?: number;
  calories?: number;
  sleep_duration_min?: number;
  hrv_score?: number;
  body_battery_high?: number;
  stress_avg?: number;
  active_minutes?: number;
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 8.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: 8,
};
const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(34,211,238,0.07)",
  borderRadius: 12,
  padding: "12px 14px",
  marginBottom: 10,
};

export default function FitnessTab() {
  const [data,    setData]    = useState<FitnessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<FitnessData>("/fitness/today")
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 16, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
  );

  const sleepHours = data?.sleep_duration_min
    ? (data.sleep_duration_min / 60).toFixed(1)
    : null;

  const metrics: { label: string; value: string; unit: string }[] = [
    { label: "Steps",        value: data?.steps?.toLocaleString()          ?? "—", unit: "steps"   },
    { label: "Calories",     value: data?.calories?.toLocaleString()       ?? "—", unit: "kcal"    },
    { label: "Sleep",        value: sleepHours                             ?? "—", unit: "hrs"     },
    { label: "HRV",          value: data?.hrv_score?.toString()            ?? "—", unit: "ms"      },
    { label: "Body Battery", value: data?.body_battery_high?.toString()    ?? "—", unit: "/ 100"   },
    { label: "Stress",       value: data?.stress_avg?.toString()           ?? "—", unit: "avg"     },
  ];

  const noData = !data || Object.values(data).every(v => v == null);

  return (
    <div style={{ padding: "14px 14px 80px" }}>
      <div style={sectionLabel}>Today</div>
      <div style={card}>
        {noData
          ? <p style={{ color: "var(--text-3)", fontSize: 12 }}>No fitness data yet. Ask Friday to sync your Garmin.</p>
          : metrics.map((m, i) => (
              <div key={m.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                paddingBottom: i < metrics.length - 1 ? 10 : 0,
                marginBottom: i < metrics.length - 1 ? 10 : 0,
                borderBottom: i < metrics.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{m.label}</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600, color: "var(--cyan)" }}>
                    {m.value}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", marginLeft: 4 }}>
                    {m.unit}
                  </span>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}
