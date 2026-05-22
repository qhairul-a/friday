"use client";

import { useState, useEffect } from "react";

interface NoteEntry {
  title: string;
  snippet: string;
  modified: number;
  modifiedStr: string;
  isFriday: boolean;
}

export default function NotesPanel() {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function fetchNotes() {
    try {
      const res = await fetch("/api/obsidian-notes");
      if (res.ok) setNotes(await res.json());
    } catch {
      // vault unreachable — show empty state
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

  const vaultName = "Q _obsidian";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3a5c] shrink-0">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b]">Notes Today</h2>
          <p className="text-[9px] text-[#364c61] mt-0.5">
            {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <a
          href={`obsidian://open?vault=${encodeURIComponent(vaultName)}`}
          className="text-[10px] text-[#00d4ff] hover:text-white transition-colors"
          title="Open vault in Obsidian"
        >
          Open vault →
        </a>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {loading ? (
          <p className="text-[11px] text-[#364c61] text-center mt-8">Loading…</p>
        ) : notes.length === 0 ? (
          <div className="text-center mt-10 px-4">
            <p className="text-[11px] text-[#364c61] leading-relaxed">
              No notes today.
            </p>
            <p className="text-[10px] text-[#2a3f52] mt-1">
              Tell Friday to &quot;note that…&quot; on Telegram.
            </p>
          </div>
        ) : (
          notes.map((note, i) => (
            <a
              key={i}
              href={`obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(note.title)}`}
              className="block bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-3 hover:border-[#00d4ff]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[12px] font-medium text-white leading-snug line-clamp-1">{note.title}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {note.isFriday && (
                    <span className="text-[8px] text-[#00d4ff] bg-[#060e1c] px-1.5 py-0.5 rounded">Friday</span>
                  )}
                  <span className="text-[9px] text-[#364c61]">{note.modifiedStr}</span>
                </div>
              </div>
              {note.snippet && (
                <p className="text-[11px] text-[#4a7a9b] leading-relaxed line-clamp-2">{note.snippet}</p>
              )}
            </a>
          ))
        )}
      </div>
    </div>
  );
}
