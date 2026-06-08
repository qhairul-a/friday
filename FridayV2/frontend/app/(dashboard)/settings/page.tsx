"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const HIDDEN_KEY = "hidden_overview";
const OVERVIEW_WIDGETS = [
  { id: "fitness_snapshot", label: "Fitness Snapshot",  icon: "⬡" },
  { id: "upcoming_events",  label: "Upcoming Events",   icon: "◷" },
  { id: "tasks_due",        label: "Open Tasks",        icon: "◈" },
  { id: "last_expense",     label: "Last Expense",      icon: "◉" },
];
const CATEGORIES = ["work", "preferences", "hobbies", "health", "personality", "goals", "dislikes", "relationships"];

interface MemoryRow { id: string; category: string; fact: string; source: string; updated_at: string }
type Tab = "memory" | "overview";

const inputStyle: React.CSSProperties = {
  background: "rgba(7,13,31,0.8)", border: "1px solid var(--border)", borderRadius: 10,
  color: "var(--text-1)", fontFamily: "var(--font-inter)", fontSize: 13,
  padding: "9px 13px", outline: "none", transition: "border-color 0.2s",
};

function sourceColor(source: string): string {
  if (source === "friday") return "var(--violet)";
  if (source === "stated") return "var(--cyan)";
  if (source === "manual") return "var(--orange)";
  return "var(--text-3)";
}

export default function SettingsPage() {
  const [tab, setTab]         = useState<Tab>("memory");
  const [memory, setMemory]   = useState<MemoryRow[]>([]);
  const [editId, setEditId]       = useState<string | null>(null);
  const [editFact, setEditFact]   = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [newFact, setNewFact] = useState({ category: "preferences", fact: "" });
  const [hidden, setHidden]   = useState<string[]>([]);
  const [search, setSearch]   = useState("");

  const loadMemory = useCallback(async () => {
    const { data } = await supabase.from("user_memory").select("*").order("category").order("updated_at", { ascending: false });
    if (data) setMemory(data as MemoryRow[]);
  }, []);

  useEffect(() => {
    loadMemory();
    const s = localStorage.getItem(HIDDEN_KEY);
    if (s) setHidden(JSON.parse(s));
  }, [loadMemory]);

  async function deleteFact(id: string) {
    await supabase.from("user_memory").delete().eq("id", id);
    loadMemory();
  }
  async function saveEdit(id: string) {
    await supabase.from("user_memory").update({ fact: editFact, category: editCategory, updated_at: new Date().toISOString() }).eq("id", id);
    setEditId(null);
    loadMemory();
  }
  async function addFact() {
    if (!newFact.fact.trim()) return;
    await supabase.from("user_memory").insert({ category: newFact.category, fact: newFact.fact, source: "manual" });
    setNewFact(p => ({ ...p, fact: "" }));
    loadMemory();
  }
  function toggleWidget(id: string) {
    const next = hidden.includes(id) ? hidden.filter(h => h !== id) : [...hidden, id];
    setHidden(next);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  }

  const filteredMemory = search.trim()
    ? memory.filter(r => r.fact.toLowerCase().includes(search.toLowerCase()))
    : memory;

  const byCategory = filteredMemory.reduce<Record<string, MemoryRow[]>>((acc, r) => {
    const cat = r.category.charAt(0).toUpperCase() + r.category.slice(1);
    (acc[cat] = acc[cat] || []).push(r);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 36 }}>
        <div className="label-cyan" style={{ marginBottom: 8 }}>◈ System Configuration</div>
        <h1 style={{ fontFamily: "var(--font-space)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>Settings</h1>
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: 32 }}>
        {(["memory", "overview"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab${tab === t ? " active" : ""}`}>
            {t === "memory" ? "◈ Friday's Memory" : "⬡ Overview Widgets"}
          </button>
        ))}
      </div>

      {/* ── Memory Tab ── */}
      {tab === "memory" && (
        <div>
          <p style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            What Friday knows about you. Updated automatically after every conversation. Edit or remove facts at any time.
          </p>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search memory…"
            style={{ ...inputStyle, width: "100%", marginBottom: 20 }}
            className="cyber-input"
          />

          {/* Add fact — now at top */}
          <div className="glass glow-cyan" style={{ padding: "24px", marginBottom: 28 }}>
            <div className="label-cyan" style={{ marginBottom: 14 }}>+ Add Fact Manually</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                list="memory-categories"
                value={newFact.category}
                onChange={e => setNewFact(p => ({ ...p, category: e.target.value }))}
                style={{ ...inputStyle, width: 160 }}
                className="cyber-input"
                placeholder="Category"
              />
              <datalist id="memory-categories">
                {CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
              <textarea
                value={newFact.fact}
                onChange={e => setNewFact(p => ({ ...p, fact: e.target.value }))}
                placeholder="e.g. Prefers morning workouts before 8am"
                rows={3}
                style={{ ...inputStyle, flex: 1, minWidth: 200, resize: "none", maxHeight: 140, overflowY: "auto" }}
                className="cyber-input"
                onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) addFact(); }}
              />
              <button onClick={addFact} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
            </div>
          </div>

          {filteredMemory.length === 0 && search.trim() && (
            <div className="glass" style={{ padding: "24px", marginBottom: 24, textAlign: "center" }}>
              <p style={{ color: "var(--text-2)", fontSize: 13 }}>No matching memories found.</p>
            </div>
          )}

          {filteredMemory.length === 0 && !search.trim() && (
            <div className="glass" style={{ padding: "24px", marginBottom: 24, textAlign: "center" }}>
              <p style={{ color: "var(--text-2)", fontSize: 13 }}>No memory yet — chat with Friday to build her profile of you.</p>
            </div>
          )}

          {Object.entries(byCategory).sort().map(([cat, facts]) => (
            <div key={cat} style={{ marginBottom: 28 }}>
              <div className="label" style={{ marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-2)" }}>📁 {cat}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {facts.map(r => (
                  <div key={r.id} className="glass" style={{ padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* Left accent */}
                    <div style={{ width: 2, minHeight: 20, background: sourceColor(r.source), borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
                    {editId === r.id ? (
                      <>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            list="memory-categories"
                            value={editCategory}
                            onChange={e => setEditCategory(e.target.value)}
                            style={{ ...inputStyle, width: "100%" }}
                            className="cyber-input"
                            placeholder="Category"
                          />
                          <textarea
                            value={editFact}
                            onChange={e => setEditFact(e.target.value)}
                            rows={3}
                            style={{ ...inputStyle, width: "100%", resize: "none", maxHeight: 140, overflowY: "auto" }}
                            className="cyber-input"
                            onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) saveEdit(r.id); }}
                            autoFocus
                          />
                        </div>
                        <button onClick={() => saveEdit(r.id)} style={{ color: "var(--cyan)", fontSize: 12, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Save</button>
                        <button onClick={() => setEditId(null)} style={{ color: "var(--text-2)", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <p style={{ flex: 1, fontSize: 13, color: "var(--text-1)", lineHeight: 1.5 }}>{r.fact}</p>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-2)", flexShrink: 0, marginTop: 2 }}>{r.source}</span>
                        <button onClick={() => { setEditId(r.id); setEditFact(r.fact); setEditCategory(r.category); }} className="btn-icon" style={{ fontSize: 12 }}>✎</button>
                        <button onClick={() => deleteFact(r.id)} className="btn-danger">✕</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

        </div>
      )}

      {/* ── Overview Customisation Tab ── */}
      {tab === "overview" && (
        <div>
          <p style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
            Toggle which widgets appear on the Overview page. Drag to reorder directly on the Overview page.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {OVERVIEW_WIDGETS.map(w => {
              const visible = !hidden.includes(w.id);
              return (
                <div key={w.id} className="glass" style={{ padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: visible ? "var(--cyan)" : "var(--text-3)", fontSize: 16 }}>{w.icon}</span>
                    <span style={{ fontSize: 14, color: visible ? "var(--text-1)" : "var(--text-2)", fontFamily: "var(--font-space)", fontWeight: 500 }}>{w.label}</span>
                  </div>
                  <button
                    onClick={() => toggleWidget(w.id)}
                    className="toggle"
                    data-active={visible}
                    style={{
                      position: "relative",
                      width: 44,
                      height: 24,
                      borderRadius: 100,
                      border: "none",
                      cursor: "pointer",
                      background: visible ? "var(--cyan)" : "var(--bg-surface)",
                      boxShadow: visible ? "0 0 12px rgba(34,211,238,0.3)" : "none",
                      transition: "background 0.2s, box-shadow 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: "absolute",
                      top: 3,
                      left: visible ? 22 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: visible ? "var(--bg-base)" : "var(--text-3)",
                      transition: "left 0.2s",
                    }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
