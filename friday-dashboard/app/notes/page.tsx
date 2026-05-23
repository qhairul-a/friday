"use client";

import { useState, useEffect } from "react";
import PageShell from "../components/page-shell";

interface NoteEntry {
  title: string;
  snippet: string;
  modified: number;
  modifiedStr: string;
  isFriday: boolean;
}

const VAULT_NAME = "Q _obsidian";

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function fetchNotes() {
    try {
      const res = await fetch("/api/obsidian-notes");
      if (res.ok) setNotes(await res.json());
    } catch {
      // vault unreachable
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(fetchNotes, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <PageShell activeTab="/notes">
      <div className="p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Notes Today</h1>
            <p className="text-[#4a7a9b] text-sm mt-1">
              Refreshed at {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchNotes}
              className="text-[11px] text-[#4a7a9b] hover:text-white transition-colors uppercase tracking-wider"
            >
              Refresh
            </button>
            <a
              href={`obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}`}
              className="text-[11px] text-[#00d4ff] hover:text-white transition-colors uppercase tracking-wider"
            >
              Open vault →
            </a>
          </div>
        </div>

        {loading && <p className="text-[#4a7a9b] text-sm">Loading…</p>}

        {!loading && notes.length === 0 && (
          <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-10 text-center">
            <p className="text-[#4a7a9b] text-sm">No notes today.</p>
            <p className="text-[#364c61] text-xs mt-1">Tell Friday to &quot;note that…&quot; on Telegram.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {notes.map((note, i) => (
            <a
              key={i}
              href={`obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}&file=${encodeURIComponent(note.title)}`}
              className="block bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-5 hover:border-[#00d4ff]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="text-sm font-semibold text-white leading-snug">{note.title}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {note.isFriday && (
                    <span className="text-[9px] text-[#00d4ff] bg-[#060e1c] border border-[#00d4ff]/20 px-2 py-0.5 rounded-full">Friday</span>
                  )}
                  <span className="text-[10px] text-[#364c61]">{note.modifiedStr}</span>
                </div>
              </div>
              {note.snippet && (
                <p className="text-[12px] text-[#4a7a9b] leading-relaxed line-clamp-3">{note.snippet}</p>
              )}
            </a>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
