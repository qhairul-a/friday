"use client";

import { useState, useEffect, useCallback } from "react";
import PageShell from "../components/page-shell";
import type { VaultItem } from "../api/vault/route";

interface NoteEntry {
  title: string;
  snippet: string;
  modified: number;
  modifiedStr: string;
  isFriday: boolean;
}

const VAULT_NAME = "Q _obsidian";

function obsidianLink(filePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}&file=${encodeURIComponent(filePath.replace(/\.md$/, ""))}`;
}

// ─── Vault tree node ──────────────────────────────────────────────────────────

function VaultNode({
  item,
  depth,
  path,
  expanded,
  loadingFolder,
  onToggle,
}: {
  item: VaultItem;
  depth: number;
  path: string;
  expanded: Record<string, VaultItem[]>;
  loadingFolder: string | null;
  onToggle: (item: VaultItem, fullPath: string) => void;
}) {
  const fullPath = path ? `${path}/${item.name}` : item.name;
  const isExpanded = item.type === "folder" && !!expanded[item.id];
  const indent = depth * 16;

  if (item.type === "folder") {
    return (
      <div>
        <button
          onClick={() => onToggle(item, fullPath)}
          style={{ paddingLeft: 8 + indent }}
          className="flex items-center gap-2 w-full text-left py-1.5 pr-3 rounded hover:bg-[#0d2240] transition-colors"
        >
          <svg
            className={`w-3 h-3 shrink-0 text-[#4a7a9b] transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[13px] text-[#8ab4d4] truncate flex-1">{item.name}</span>
          {loadingFolder === item.id && (
            <span className="text-[10px] text-[#4a7a9b] ml-auto">…</span>
          )}
        </button>
        {isExpanded && expanded[item.id]?.map(child => (
          <VaultNode
            key={child.id}
            item={child}
            depth={depth + 1}
            path={fullPath}
            expanded={expanded}
            loadingFolder={loadingFolder}
            onToggle={onToggle}
          />
        ))}
      </div>
    );
  }

  // File — opens in Obsidian
  const title = item.name.replace(/^\d{4}-\d{2}-\d{2} \d{4} /, "").replace(/\.md$/, "");
  const dateStr = item.modifiedTime
    ? new Date(item.modifiedTime).toLocaleDateString("en-SG", { month: "short", day: "numeric" })
    : "";

  return (
    <a
      href={obsidianLink(fullPath)}
      style={{ paddingLeft: 8 + indent + 20 }}
      className="flex items-center gap-2 py-1.5 pr-3 rounded hover:bg-[#0d2240] transition-colors group"
    >
      <span className="text-[10px] text-[#364c61] shrink-0">📄</span>
      <span className="text-[13px] text-white truncate flex-1">{title}</span>
      <span className="text-[10px] text-[#4a7a9b] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {dateStr}
      </span>
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  // Today's notes
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Vault explorer
  const [vaultRootId, setVaultRootId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, VaultItem[]>>({});
  const [loadingFolder, setLoadingFolder] = useState<string | null>(null);

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

  const fetchVaultFolder = useCallback(async (folderId?: string) => {
    const key = folderId ?? "root";
    setLoadingFolder(key);
    try {
      const url = folderId ? `/api/vault?folderId=${folderId}` : "/api/vault";
      const data: { items: VaultItem[]; vaultRootId: string | null } = await fetch(url).then(r => r.json());
      const id = folderId ?? data.vaultRootId;
      if (!folderId && data.vaultRootId) setVaultRootId(data.vaultRootId);
      if (id) setExpanded(prev => ({ ...prev, [id]: data.items }));
    } catch {
      // Drive unreachable
    } finally {
      setLoadingFolder(null);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
    fetchVaultFolder();
    const interval = setInterval(fetchNotes, 60_000);
    return () => clearInterval(interval);
  }, [fetchVaultFolder]);

  const handleToggle = useCallback((item: VaultItem, _fullPath: string) => {
    if (expanded[item.id]) {
      // Collapse
      setExpanded(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } else {
      // Expand — load children
      fetchVaultFolder(item.id);
    }
  }, [expanded, fetchVaultFolder]);

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

        {/* Today's notes */}
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

        {/* Vault Explorer */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#4a7a9b]">Vault</h2>
            <button
              onClick={() => fetchVaultFolder()}
              className="text-[10px] text-[#4a7a9b] hover:text-white transition-colors uppercase tracking-wider"
            >
              Refresh
            </button>
          </div>
          <div
            className="bg-[#060e1c] rounded-xl border border-[#1a3a5c] p-2 overflow-y-auto"
            style={{ maxHeight: 600 }}
          >
            {loadingFolder === "root" ? (
              <p className="text-[11px] text-[#4a7a9b] p-3">Loading vault…</p>
            ) : vaultRootId && expanded[vaultRootId] ? (
              expanded[vaultRootId].map(item => (
                <VaultNode
                  key={item.id}
                  item={item}
                  depth={0}
                  path=""
                  expanded={expanded}
                  loadingFolder={loadingFolder}
                  onToggle={handleToggle}
                />
              ))
            ) : (
              <p className="text-[11px] text-[#4a7a9b] p-3">Vault not available.</p>
            )}
          </div>
        </div>

      </div>
    </PageShell>
  );
}
