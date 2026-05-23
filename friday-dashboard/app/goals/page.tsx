"use client";

import { useState, useEffect, useRef } from "react";
import { supabase, USER_ID } from "@/lib/supabase";
import { Goal } from "@/lib/types";
import PageShell from "../components/page-shell";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(dateStr: string): { label: string; color: string } {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: "text-red-400" };
  if (diff === 0) return { label: "Due today", color: "text-amber-400" };
  if (diff <= 7) return { label: `${diff}d left`, color: "text-amber-400" };
  return { label: `${diff}d left`, color: "text-[#4a7a9b]" };
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("goals").select("*").eq("user_id", USER_ID)
      .order("created_at", { ascending: true })
      .then(({ data }) => { setGoals((data as Goal[]) ?? []); setLoading(false); });
  }, []);

  async function addGoal() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    const { data, error } = await supabase
      .from("goals")
      .insert({ user_id: USER_ID, title, target_date: newDate || null })
      .select()
      .single();
    if (!error && data) setGoals(prev => [...prev, data as Goal]);
    setNewTitle("");
    setNewDate("");
    setAdding(false);
    inputRef.current?.focus();
  }

  async function deleteGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setEditingTitle(goal.title);
    setEditingDate(goal.target_date ?? "");
  }

  async function saveEdit(goal: Goal) {
    const title = editingTitle.trim();
    if (!title) return;
    const target_date = editingDate || null;
    await supabase.from("goals").update({ title, target_date }).eq("id", goal.id);
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, title, target_date } : g));
    setEditingId(null);
  }

  return (
    <PageShell activeTab="/goals">
      <div className="p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white tracking-wide">Goals</h1>
          {goals.length > 0 && (
            <p className="text-[#4a7a9b] text-sm mt-1">{goals.length} goal{goals.length !== 1 ? "s" : ""}</p>
          )}
        </div>

        {/* Add form */}
        <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <input
            ref={inputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addGoal()}
            placeholder="Add a goal…"
            className="flex-1 bg-transparent text-sm text-white placeholder-[#364c61] focus:outline-none"
          />
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-2 py-1.5 text-xs text-[#4a7a9b] focus:outline-none focus:border-[#00d4ff] transition-colors"
            title="Target date (optional)"
          />
          <button
            onClick={addGoal}
            disabled={adding || !newTitle.trim()}
            className="px-4 py-1.5 text-sm text-[#00d4ff] border border-[#00d4ff]/40 rounded-lg hover:bg-[#00d4ff]/10 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-[#4a7a9b] text-sm">Loading…</p>
        ) : goals.length === 0 ? (
          <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-10 text-center">
            <p className="text-[#4a7a9b] text-sm">No goals yet.</p>
            <p className="text-[#364c61] text-xs mt-1">Add your first goal above to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {goals.map(goal => {
              const isEditing = editingId === goal.id;
              const countdown = goal.target_date ? daysUntil(goal.target_date) : null;
              return (
                <div
                  key={goal.id}
                  className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl px-4 py-3 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex items-center gap-3">
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") saveEdit(goal);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 bg-[#060e1c] border border-[#00d4ff]/40 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                      />
                      <input
                        type="date"
                        value={editingDate}
                        onChange={e => setEditingDate(e.target.value)}
                        className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-2 py-1 text-xs text-[#4a7a9b] focus:outline-none focus:border-[#00d4ff] transition-colors"
                      />
                      <button onClick={() => saveEdit(goal)} className="text-[11px] text-[#00d4ff] hover:text-white transition-colors">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[11px] text-[#4a7a9b] hover:text-white transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] shrink-0" />
                      <span className="flex-1 text-sm text-white">{goal.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {goal.target_date ? (
                          <span className={`text-[10px] ${countdown?.color ?? "text-[#4a7a9b]"}`}>
                            {formatDate(goal.target_date)}
                            {countdown && <span className="ml-1 opacity-70">({countdown.label})</span>}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#364c61]">No target date</span>
                        )}
                        <button onClick={() => startEdit(goal)} className="text-[11px] text-[#4a7a9b] hover:text-[#00d4ff] transition-colors">Edit</button>
                        <button onClick={() => deleteGoal(goal.id)} className="text-[11px] text-[#4a7a9b] hover:text-red-400 transition-colors">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
