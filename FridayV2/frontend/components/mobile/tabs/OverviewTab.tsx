"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Task  { id: string; title: string; status: string }
interface Event { id: string; title: string; start: string }

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
const row: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  paddingBottom: 8,
  marginBottom: 8,
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

export default function OverviewTab() {
  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [events,  setEvents]  = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Task[]>("/tasks").catch(() => [] as Task[]),
      apiFetch<Event[]>("/calendar?days=1").catch(() => [] as Event[]),
    ]).then(([t, e]) => {
      setTasks(t.filter(x => x.status !== "completed").slice(0, 5));
      setEvents(e.slice(0, 3));
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ padding: 16, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
  );

  return (
    <div style={{ padding: "14px 14px 80px" }}>
      <div style={sectionLabel}>Open Tasks</div>
      <div style={card}>
        {tasks.length === 0
          ? <p style={{ color: "var(--text-3)", fontSize: 12 }}>No open tasks</p>
          : tasks.map(t => (
              <div key={t.id} style={row}>
                <span style={{ color: "var(--cyan)", fontSize: 11, marginTop: 1 }}>○</span>
                <span style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4 }}>{t.title}</span>
              </div>
            ))
        }
      </div>

      <div style={sectionLabel}>Today</div>
      <div style={card}>
        {events.length === 0
          ? <p style={{ color: "var(--text-3)", fontSize: 12 }}>No events today</p>
          : events.map(e => (
              <div key={e.id} style={row}>
                <span style={{ color: "var(--violet)", fontSize: 11, marginTop: 1 }}>◷</span>
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-1)", marginBottom: 2 }}>{e.title}</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{e.start}</p>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}
