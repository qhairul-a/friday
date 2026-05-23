"use client";

import { useState, useEffect } from "react";
import { supabase, USER_ID } from "@/lib/supabase";
import { Task } from "@/lib/types";
import PageShell from "../../components/page-shell";
import TasksNav from "../../components/tasks-nav";

const PRIORITY_COLOURS: Record<Task["priority"], string> = {
  low: "bg-[#0d1e30] text-[#4a7a9b]",
  normal: "bg-[#0d2240] text-[#00d4ff]",
  high: "bg-[#2a0d0d] text-red-400",
};

export default function ArchivePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", USER_ID)
      .eq("status", "archived")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setTasks((data as Task[]) ?? []);
        setLoading(false);
      });
  }, []);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(prev => prev.size === tasks.length ? new Set() : new Set(tasks.map(t => t.id)));
  }

  async function deleteSelected() {
    const ids = [...selected];
    await supabase.from("tasks").delete().in("id", ids);
    setTasks(prev => prev.filter(t => !selected.has(t.id)));
    setSelected(new Set());
  }

  async function restoreTask(id: string) {
    await supabase.from("tasks").update({ status: "todo", updated_at: new Date().toISOString() }).eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  async function deleteTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  const allSelected = tasks.length > 0 && selected.size === tasks.length;

  return (
    <PageShell activeTab="/tasks" sidebarContent={<TasksNav />}>
      <div className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Archive</h1>
            <p className="text-[#4a7a9b] text-xs mt-0.5">
              {loading ? "Loading…" : `${tasks.length} archived task${tasks.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Delete {selected.size} selected
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1 text-[#4a7a9b]">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-[#364c61] text-sm">No archived tasks</div>
        ) : (
          <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1a3a5c] text-[#4a7a9b] text-[10px] uppercase tracking-widest">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 accent-[#00d4ff]"
              />
              <span className="flex-1">Task</span>
              <span className="w-20 text-right">Priority</span>
              <span className="w-24 text-right">Due</span>
              <span className="w-32 text-right">Actions</span>
            </div>

            {/* Rows */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-[#1a3a5c]/50 last:border-0 transition-colors ${
                    selected.has(task.id) ? "bg-[#0d1e30]" : "hover:bg-[#0d1e30]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(task.id)}
                    onChange={() => toggleSelect(task.id)}
                    className="w-3.5 h-3.5 accent-[#00d4ff] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{task.title}</p>
                    {task.label && (
                      <span className="text-[10px] text-[#a78bfa]">{task.label}</span>
                    )}
                  </div>
                  <div className="w-20 flex justify-end">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOURS[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                  <span className="w-24 text-right text-[10px] text-[#4a7a9b]">
                    {task.due_date ?? "—"}
                  </span>
                  <div className="w-32 flex justify-end gap-2">
                    <button
                      onClick={() => restoreTask(task.id)}
                      className="text-[10px] text-[#364c61] hover:text-[#00ff88] transition-colors"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-[10px] text-[#364c61] hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
