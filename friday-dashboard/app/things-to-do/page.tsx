"use client";

import { useState, useEffect, useRef } from "react";
import PageShell from "../components/page-shell";
import type { GoogleTask } from "../api/google-tasks/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDue(due: string | null): string {
  if (!due) return "";
  const d = new Date(due + "T00:00:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today))    return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  const d = new Date(due + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  onDelete,
  onSave,
}: {
  task: GoogleTask;
  onToggle: (task: GoogleTask) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, title: string, notes: string, due: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle]     = useState(task.title);
  const [notes, setNotes]     = useState(task.notes);
  const [due, setDue]         = useState(task.due ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function save() {
    if (title.trim()) onSave(task.id, title.trim(), notes, due);
    setEditing(false);
  }

  const overdue = !task.completed && isOverdue(task.due);
  const dueLabel = formatDue(task.due);

  if (editing) {
    return (
      <div className="bg-[#0a1628] border border-[#00d4ff]/30 rounded-xl p-4 flex flex-col gap-3">
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && save()}
          className="bg-transparent text-white text-sm focus:outline-none placeholder-[#4a7a9b]"
          placeholder="Task title"
        />
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="bg-transparent text-[#4a7a9b] text-xs focus:outline-none placeholder-[#364c61]"
          placeholder="Notes (optional)"
        />
        <div className="flex items-center justify-between">
          <input
            type="date"
            value={due}
            onChange={e => setDue(e.target.value)}
            className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#00d4ff]"
          />
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-[11px] text-[#4a7a9b] hover:text-white transition-colors px-2">Cancel</button>
            <button onClick={save} className="text-[11px] text-[#00d4ff] hover:text-white transition-colors px-2">Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-[#0a1628] transition-colors ${task.completed ? "opacity-50" : ""}`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task)}
        className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center ${
          task.completed ? "border-[#00d4ff] bg-[#00d4ff]" : "border-[#2a4a6a] hover:border-[#00d4ff]"
        }`}
      >
        {task.completed && <span className="text-[#050b14] text-[8px] font-bold">✓</span>}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${task.completed ? "line-through text-[#4a7a9b]" : "text-white"}`}>
          {task.title}
        </p>
        {task.notes && <p className="text-[11px] text-[#4a7a9b] mt-0.5 truncate">{task.notes}</p>}
      </div>

      {/* Due date */}
      {dueLabel && (
        <span className={`text-[10px] shrink-0 mt-0.5 ${overdue ? "text-red-400" : "text-[#4a7a9b]"}`}>
          {dueLabel}
        </span>
      )}

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="w-6 h-6 flex items-center justify-center rounded text-[#4a7a9b] hover:text-[#00d4ff] hover:bg-[#0d2240] transition-colors text-xs"
          title="Edit"
        >
          ✎
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="w-6 h-6 flex items-center justify-center rounded text-[#4a7a9b] hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs"
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ThingsToDoPage() {
  const [tasks, setTasks]       = useState<GoogleTask[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [adding, setAdding]     = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newDue, setNewDue]     = useState("");
  const [saving, setSaving]     = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/google-tasks");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to load tasks");
        return;
      }
      setTasks(await res.json());
    } catch {
      setError("Could not reach Google Tasks API");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (adding) newInputRef.current?.focus(); }, [adding]);

  async function addTask() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/google-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), notes: newNotes, due: newDue }),
      });
      if (res.ok) {
        const created: GoogleTask = await res.json();
        setTasks(prev => [created, ...prev]);
        setNewTitle(""); setNewNotes(""); setNewDue(""); setAdding(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: GoogleTask) {
    const updated = { ...task, completed: !task.completed };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    await fetch("/api/google-tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, completed: !task.completed }),
    });
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/google-tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async function saveTask(id: string, title: string, notes: string, due: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title, notes, due: due || null } : t));
    await fetch("/api/google-tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title, notes, due }),
    });
  }

  async function clearCompleted() {
    const completed = tasks.filter(t => t.completed);
    setTasks(prev => prev.filter(t => !t.completed));
    await Promise.all(completed.map(t =>
      fetch(`/api/google-tasks?id=${encodeURIComponent(t.id)}`, { method: "DELETE" })
    ));
  }

  const pending   = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  return (
    <PageShell activeTab="/things-to-do">
      <div className="p-8 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Things to Do</h1>
            <p className="text-[#4a7a9b] text-sm mt-1">Synced with Google Tasks</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="text-[11px] text-[#4a7a9b] hover:text-white transition-colors uppercase tracking-wider"
            >
              Refresh
            </button>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="text-[11px] text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/10 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wider"
              >
                + Add Task
              </button>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-5 mb-6 text-center">
            <p className="text-red-400 text-sm font-medium mb-1">Google Tasks not connected</p>
            <p className="text-red-400/70 text-xs">{error}</p>
            <p className="text-[#4a7a9b] text-xs mt-2">Add GOOGLE_TASKS_REFRESH_TOKEN to your environment variables.</p>
          </div>
        )}

        {/* Add task form */}
        {adding && (
          <div className="bg-[#0a1628] border border-[#00d4ff]/30 rounded-xl p-4 mb-5 flex flex-col gap-3">
            <input
              ref={newInputRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTask()}
              placeholder="What needs to be done?"
              className="bg-transparent text-white text-sm focus:outline-none placeholder-[#4a7a9b]"
            />
            <input
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="bg-transparent text-[#4a7a9b] text-xs focus:outline-none placeholder-[#364c61]"
            />
            <div className="flex items-center justify-between">
              <input
                type="date"
                value={newDue}
                onChange={e => setNewDue(e.target.value)}
                className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#00d4ff]"
              />
              <div className="flex gap-2">
                <button onClick={() => { setAdding(false); setNewTitle(""); setNewNotes(""); setNewDue(""); }}
                  className="text-[11px] text-[#4a7a9b] hover:text-white transition-colors px-2">
                  Cancel
                </button>
                <button onClick={addTask} disabled={saving || !newTitle.trim()}
                  className="text-[11px] text-[#00d4ff] hover:text-white transition-colors px-2 disabled:opacity-40">
                  {saving ? "Saving…" : "Add"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <p className="text-[#4a7a9b] text-sm text-center py-12">Loading…</p>}

        {/* Pending tasks */}
        {!loading && !error && (
          <>
            {pending.length === 0 && !adding && (
              <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-10 text-center mb-5">
                <p className="text-[#4a7a9b] text-sm">Nothing to do — enjoy your day.</p>
              </div>
            )}

            {pending.length > 0 && (
              <div className="bg-[#060e1c] border border-[#1a3a5c] rounded-xl mb-5 overflow-hidden">
                {pending.map(task => (
                  <div key={task.id} className="border-b border-[#1a3a5c] last:border-b-0">
                    <TaskRow task={task} onToggle={toggleTask} onDelete={deleteTask} onSave={saveTask} />
                  </div>
                ))}
              </div>
            )}

            {/* Completed tasks */}
            {completed.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#364c61]">
                    Completed ({completed.length})
                  </p>
                  <button
                    onClick={clearCompleted}
                    className="text-[10px] text-[#364c61] hover:text-red-400 transition-colors uppercase tracking-wider"
                  >
                    Clear all
                  </button>
                </div>
                <div className="bg-[#060e1c] border border-[#1a3a5c] rounded-xl overflow-hidden">
                  {completed.map(task => (
                    <div key={task.id} className="border-b border-[#1a3a5c] last:border-b-0">
                      <TaskRow task={task} onToggle={toggleTask} onDelete={deleteTask} onSave={saveTask} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </PageShell>
  );
}
