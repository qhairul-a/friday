"use client";

import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";

interface Note { id: string; title: string; modified: string }

const SECTION: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 8.5,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: "var(--text-3)", marginBottom: 8,
};
const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(34,211,238,0.07)",
  borderRadius: 12, padding: "12px 14px", marginBottom: 8,
  cursor: "pointer",
};

export default function NotesTab() {
  const [recent,        setRecent]        = useState<Note[]>([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<Note[] | null>(null);
  const [searching,     setSearching]     = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [selected,      setSelected]      = useState<Note | null>(null);
  const [content,       setContent]       = useState<string | null>(null);
  const [loadingNote,   setLoadingNote]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch<Note[]>("/notes?limit=10")
      .then(d => { setRecent(d ?? []); setLoadingRecent(false); })
      .catch(() => setLoadingRecent(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 2) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      apiFetch<Note[]>(`/notes/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(d => setSearchResults(d ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  async function openNote(note: Note) {
    setSelected(note);
    setContent(null);
    setLoadingNote(true);
    try {
      const res = await apiFetch<{ content: string }>(`/notes/${note.id}`);
      setContent(res.content);
    } catch {
      setContent("[Failed to load note content]");
    } finally {
      setLoadingNote(false);
    }
  }

  function closeNote() { setSelected(null); setContent(null); }

  const showingSearch = searchQuery.trim().length >= 2;
  const displayNotes  = showingSearch ? (searchResults ?? []) : recent;

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div style={{ padding: "14px 14px 80px" }}>
        {/* Back button */}
        <button
          onClick={closeNote}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--cyan)", fontFamily: "var(--font-mono)",
            fontSize: 11, letterSpacing: "0.05em", marginBottom: 16, padding: 0,
          }}
        >
          ← Back
        </button>

        {/* Title */}
        <p style={{
          fontFamily: "var(--font-space)", fontSize: 15, fontWeight: 700,
          color: "var(--text-1)", marginBottom: 4, lineHeight: 1.4,
        }}>
          {selected.title}
        </p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", marginBottom: 16 }}>
          {new Date(selected.modified).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
        </p>

        {/* Content */}
        <div style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(34,211,238,0.07)",
          borderRadius: 12, padding: "14px",
        }}>
          {loadingNote ? (
            <p style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</p>
          ) : (
            <pre style={{
              fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-2)",
              whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, lineHeight: 1.7,
            }}>
              {content}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "14px 14px 80px" }}>
      {/* Search input */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          fontSize: 13, color: "var(--text-3)", pointerEvents: "none",
        }}>⌕</span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search all notes…"
          style={{
            width: "100%", padding: "10px 12px 10px 32px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(34,211,238,0.15)",
            borderRadius: 10, color: "var(--text-1)",
            fontFamily: "var(--font-mono)", fontSize: 12,
            outline: "none", boxSizing: "border-box",
            transition: "border-color 0.2s",
          }}
          onFocus={e => (e.target.style.borderColor = "rgba(34,211,238,0.4)")}
          onBlur={e => (e.target.style.borderColor = "rgba(34,211,238,0.15)")}
        />
        {searching && (
          <span style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)",
          }}>…</span>
        )}
        {searchQuery && !searching && (
          <button
            onClick={() => setSearchQuery("")}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "var(--text-3)",
              fontSize: 14, cursor: "pointer", padding: "2px 4px",
            }}
          >×</button>
        )}
      </div>

      <div style={SECTION}>
        {showingSearch
          ? searching ? "Searching…" : `${searchResults?.length ?? 0} results`
          : "Recent Notes"}
      </div>

      {!showingSearch && loadingRecent ? (
        <div style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
      ) : displayNotes.length === 0 ? (
        <div style={CARD}>
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>
            {showingSearch ? "No notes found." : "No notes yet. Talk to Friday to create one."}
          </p>
        </div>
      ) : (
        displayNotes.map(note => (
          <div key={note.id} style={CARD} onClick={() => openNote(note)}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 4, flex: 1 }}>
                {note.title}
              </p>
              <span style={{ fontSize: 14, color: "var(--text-3)", marginLeft: 8 }}>›</span>
            </div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)" }}>
              {new Date(note.modified).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
