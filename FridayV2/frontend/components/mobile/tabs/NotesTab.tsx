"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Note { id: string; title?: string; content: string; created_at: string }

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

export default function NotesTab() {
  const [notes,   setNotes]   = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ notes: Note[] }>("/notes?limit=10")
      .then(d => { setNotes(d.notes ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 16, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
  );

  return (
    <div style={{ padding: "14px 14px 80px" }}>
      <div style={sectionLabel}>Recent Notes</div>
      {notes.length === 0
        ? (
          <div style={card}>
            <p style={{ color: "var(--text-3)", fontSize: 12 }}>
              No notes yet. Talk to Friday to create one.
            </p>
          </div>
        )
        : notes.map(note => (
            <div key={note.id} style={card}>
              {note.title && (
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>
                  {note.title}
                </p>
              )}
              <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 6 }}>
                {note.content.length > 120 ? note.content.slice(0, 120) + "…" : note.content}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)" }}>
                {new Date(note.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
              </p>
            </div>
          ))
      }
    </div>
  );
}
