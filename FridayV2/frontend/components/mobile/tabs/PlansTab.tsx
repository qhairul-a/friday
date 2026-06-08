"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Routine { id: string; name: string; scheduled_time?: string; is_done?: boolean }

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(34,211,238,0.07)",
  borderRadius: 12,
  padding: "12px 14px",
  marginBottom: 10,
};
const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 8.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: 8,
};

export default function PlansTab() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    apiFetch<Routine[]>("/routines")
      .then(d => { setRoutines(d ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 16, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
  );

  return (
    <div style={{ padding: "14px 14px 80px" }}>
      <div style={sectionLabel}>Today's Routines</div>
      <div style={card}>
        {routines.length === 0
          ? <p style={{ color: "var(--text-3)", fontSize: 12 }}>No routines for today</p>
          : routines.map(r => (
              <div key={r.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                paddingBottom: 8, marginBottom: 8,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: r.is_done ? "var(--cyan)" : "var(--text-3)", fontSize: 11 }}>
                    {r.is_done ? "✓" : "○"}
                  </span>
                  <span style={{
                    fontSize: 12,
                    color: r.is_done ? "var(--text-3)" : "var(--text-2)",
                    textDecoration: r.is_done ? "line-through" : "none",
                  }}>
                    {r.name}
                  </span>
                </div>
                {r.scheduled_time && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>
                    {r.scheduled_time}
                  </span>
                )}
              </div>
            ))
        }
      </div>
    </div>
  );
}
