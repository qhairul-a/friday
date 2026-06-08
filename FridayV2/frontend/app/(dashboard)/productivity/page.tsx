"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const LAYOUT_KEY  = "layout_productivity";
const SPANS_KEY   = "spans_productivity";
const HEIGHTS_KEY = "heights_productivity_px";
const NUM_COLS    = 2;
const GRID_GAP    = 20;
const MIN_HEIGHT  = 120;
const MAX_HEIGHT  = 1400;
const DEFAULT_ORDER = ["tasks", "routines", "calendar"];
const DEFAULT_SPANS: Record<string, number> = { tasks: 1, routines: 1, calendar: 2 };
const DEFAULT_HEIGHTS: Record<string, number> = {
  tasks:    440,
  routines: 440,
  calendar: 440,
};

interface CalEvent { id: string; title: string; start: string; end: string }
interface TaskList { id: string; title: string }
interface Task { id: string; title: string; due: string | null; notes: string; status: string; list_id: string; list_title: string }
interface Routine { id: string; name: string; scheduled_time: string | null; is_done: boolean; done_date: string | null }

function SortableWidget({ id, span = 1, height = 1, onResizeStart, onHeightResizeStart, children }: {
  id: string; span?: number; height?: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onHeightResizeStart: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        position: "relative",
        gridColumn: `span ${span}`,
        height: `${height}px`,
        alignSelf: "start",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div {...attributes} {...listeners} className="drag-handle">⠿</div>
      <div className="widget-slot">
        {children}
      </div>
      <ResizeHandle onMouseDown={onResizeStart} />
      <BottomResizeHandle onMouseDown={onHeightResizeStart} />
    </div>
  );
}

function BottomResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 8,
        cursor: "ns-resize", zIndex: 9,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseEnter={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h");
        if (p) { p.style.opacity = "1"; p.style.boxShadow = "0 0 6px var(--cyan)"; }
      }}
      onMouseLeave={e => {
        const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill-h");
        if (p) { p.style.opacity = "0.3"; p.style.boxShadow = "none"; }
      }}
    >
      <div
        className="resize-pill-h"
        style={{ width: 32, height: 2, borderRadius: 4, background: "var(--cyan)", opacity: 0.3, transition: "opacity 0.15s, box-shadow 0.15s" }}
      />
    </div>
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "col-resize", zIndex: 9, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={e => { const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill"); if (p) { p.style.opacity = "1"; p.style.boxShadow = "0 0 6px var(--cyan)"; } }}
      onMouseLeave={e => { const p = e.currentTarget.querySelector<HTMLDivElement>(".resize-pill"); if (p) { p.style.opacity = "0.3"; p.style.boxShadow = "none"; } }}
    >
      <div className="resize-pill" style={{ width: 2, height: 32, borderRadius: 4, background: "var(--cyan)", opacity: 0.3, transition: "opacity 0.15s, box-shadow 0.15s" }} />
    </div>
  );
}

export default function ProductivityPage() {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [spans, setSpans] = useState<Record<string, number>>(DEFAULT_SPANS);
  const [heights, setHeights] = useState<Record<string, number>>(DEFAULT_HEIGHTS);
  const gridRef           = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [newEvent, setNewEvent] = useState({ title: "", start: "", end: "" });
  const [newTask, setNewTask] = useState({ title: "", due: "", list_id: "" });
  const [newList, setNewList] = useState("");
  const [editingList, setEditingList] = useState<{ id: string; title: string } | null>(null);
  const [editingTask, setEditingTask] = useState<{ id: string; list_id: string; title: string; due: string } | null>(null);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [newRoutine, setNewRoutine] = useState({ name: "", scheduled_time: "" });
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const o  = localStorage.getItem(LAYOUT_KEY);
    const s  = localStorage.getItem(SPANS_KEY);
    const ht = localStorage.getItem(HEIGHTS_KEY);
    if (o)  setOrder(JSON.parse(o));
    if (s)  setSpans(JSON.parse(s));
    if (ht) setHeights(JSON.parse(ht));
  }, []);

  const loadEvents    = useCallback(async () => { try { setEvents(await apiFetch<CalEvent[]>("/calendar?days=14")); } catch { /* offline */ } }, []);
  const loadTasks     = useCallback(async () => { try { setTasks(await apiFetch<Task[]>("/tasks")); } catch { /* offline */ } }, []);
  const loadTaskLists = useCallback(async () => { try { setTaskLists(await apiFetch<TaskList[]>("/tasklists")); } catch { /* offline */ } }, []);
  const loadRoutines = useCallback(async () => {
    const { data } = await supabase.from("routines").select("*").order("scheduled_time");
    if (data) setRoutines((data as Routine[]).map(r => ({ ...r, is_done: r.is_done && r.done_date === today })));
  }, [today]);

  useEffect(() => { loadEvents(); loadTasks(); loadTaskLists(); loadRoutines(); }, [loadEvents, loadTasks, loadTaskLists, loadRoutines]);

  // Default list_id to first list once task lists are loaded
  useEffect(() => {
    if (taskLists.length > 0 && !newTask.list_id) {
      setNewTask(p => ({ ...p, list_id: taskLists[0].id }));
    }
  }, [taskLists, newTask.list_id]);

  function getColWidth(): number {
    if (!gridRef.current) return 200;
    return (gridRef.current.offsetWidth - GRID_GAP * (NUM_COLS - 1)) / NUM_COLS;
  }

  function handleSpanChange(id: string, newSpan: number) {
    setSpans(prev => {
      const next = { ...prev, [id]: newSpan };
      localStorage.setItem(SPANS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleResizeStart(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startSpan = spans[id] ?? DEFAULT_SPANS[id] ?? 1;
    const colWidth = getColWidth();
    function onMove(mv: MouseEvent) {
      const delta = Math.round((mv.clientX - startX) / (colWidth + GRID_GAP));
      handleSpanChange(id, Math.max(1, Math.min(NUM_COLS, startSpan + delta)));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleHeightChange(id: string, newHeight: number) {
    setHeights(prev => {
      const next = { ...prev, [id]: newHeight };
      localStorage.setItem(HEIGHTS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function handleHeightResizeStart(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const startY      = e.clientY;
    const startHeight = heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1;
    function onMove(mv: MouseEvent) {
      handleHeightChange(id, Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + (mv.clientY - startY))));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const next = arrayMove(order, order.indexOf(active.id as string), order.indexOf(over.id as string));
      setOrder(next); localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    }
  }

  function fmtEvent(iso: string) {
    try { return new Date(iso).toLocaleString("en-SG", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  }

  async function createEvent() {
    if (!newEvent.title || !newEvent.start || !newEvent.end) return;
    try {
      const start = new Date(newEvent.start).toISOString();
      const end   = new Date(newEvent.end).toISOString();
      await apiFetch("/calendar", { method: "POST", body: JSON.stringify({ title: newEvent.title, start, end }) });
      setNewEvent({ title: "", start: "", end: "" }); loadEvents();
    } catch (e) { alert(String(e)); }
  }

  async function createTask() {
    if (!newTask.title) return;
    try {
      const due = newTask.due ? new Date(newTask.due).toISOString() : undefined;
      const list_id = newTask.list_id || taskLists[0]?.id || "@default";
      await apiFetch("/tasks", { method: "POST", body: JSON.stringify({ title: newTask.title, due, list_id }) });
      setNewTask(p => ({ ...p, title: "", due: "" })); loadTasks();
    } catch (e) { alert(String(e)); }
  }

  async function createList() {
    if (!newList.trim()) return;
    try {
      await apiFetch("/tasklists", { method: "POST", body: JSON.stringify({ title: newList.trim() }) });
      setNewList(""); loadTaskLists(); loadTasks();
    } catch (e) { alert(String(e)); }
  }

  async function saveTask(id: string, list_id: string, title: string, due: string) {
    if (!title.trim()) return;
    try {
      await apiFetch(`/tasks/${id}?list_id=${encodeURIComponent(list_id)}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim(), due: due || undefined }),
      });
      setEditingTask(null);
      loadTasks();
    } catch (e) { alert(String(e)); }
  }

  async function renameList(id: string, title: string) {
    try {
      await apiFetch(`/tasklists/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      setEditingList(null); loadTaskLists(); loadTasks();
    } catch (e) { alert(String(e)); }
  }

  async function deleteList(id: string) {
    if (!confirm("Delete this list and all its tasks?")) return;
    try {
      await apiFetch(`/tasklists/${id}`, { method: "DELETE" });
      loadTaskLists(); loadTasks();
    } catch (e) { alert(String(e)); }
  }

  async function createRoutine() {
    if (!newRoutine.name) return;
    await supabase.from("routines").insert({ name: newRoutine.name, scheduled_time: newRoutine.scheduled_time || null });
    setNewRoutine({ name: "", scheduled_time: "" }); loadRoutines();
  }

  async function toggleRoutine(r: Routine) {
    const done = !r.is_done;
    await supabase.from("routines").update({ is_done: done, done_date: done ? today : null }).eq("id", r.id);
    loadRoutines();
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(7,13,31,0.8)", border: "1px solid var(--border)", borderRadius: 10,
    color: "var(--text-1)", fontFamily: "var(--font-inter)", fontSize: 13,
    padding: "9px 13px", outline: "none", transition: "border-color 0.2s",
  };

  const widgets: Record<string, React.ReactNode> = {
    calendar: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>◷ Calendar — next 14 days</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 240, overflowY: "auto", marginBottom: 20 }}>
          {events.length === 0 && <p style={{ color: "var(--text-3)", fontSize: 13 }}>No events.</p>}
          {events.map(e => (
            <div key={e.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}>
                <div style={{ width: 2, minHeight: 28, background: "var(--violet)", borderRadius: 2, marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>{e.title}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{fmtEvent(e.start)}</div>
                </div>
              </div>
              <button onClick={() => apiFetch(`/calendar/${e.id}`, { method: "DELETE" }).then(() => loadEvents())} className="btn-danger">✕</button>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="label" style={{ marginBottom: 10 }}>Add Event</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="Event title" style={{ ...inputStyle, width: "100%" }} className="cyber-input" />
            <div style={{ display: "flex", gap: 8 }}>
              <input type="datetime-local" value={newEvent.start} onChange={e => setNewEvent(p => ({ ...p, start: e.target.value }))} style={{ ...inputStyle, flex: 1 }} className="cyber-input" />
              <input type="datetime-local" value={newEvent.end} onChange={e => setNewEvent(p => ({ ...p, end: e.target.value }))} style={{ ...inputStyle, flex: 1 }} className="cyber-input" />
            </div>
            <div><button onClick={createEvent} className="btn-primary" style={{ fontSize: 13 }}>Add Event</button></div>
          </div>
        </div>
      </div>
    ),

    tasks: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>◈ Tasks</div>

        {/* Tasks grouped by list */}
        {taskLists.length === 0 && tasks.length === 0 && <p style={{ color: "var(--text-3)", fontSize: 13 }}>Loading…</p>}
        {taskLists.map(list => {
          const listTasks = tasks.filter(t => t.list_id === list.id);
          return (
            <div key={list.id} style={{ marginBottom: 20 }}>
              {/* List header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {editingList?.id === list.id ? (
                  <>
                    <input
                      autoFocus value={editingList.title}
                      onChange={e => setEditingList(p => p ? { ...p, title: e.target.value } : p)}
                      onKeyDown={e => { if (e.key === "Enter") renameList(list.id, editingList.title); if (e.key === "Escape") setEditingList(null); }}
                      style={{ ...inputStyle, flex: 1, fontSize: 12, padding: "5px 10px" }} className="cyber-input"
                    />
                    <button onClick={() => renameList(list.id, editingList.title)} className="btn-primary" style={{ fontSize: 12 }}>Save</button>
                    <button onClick={() => setEditingList(null)} className="btn-danger" style={{ fontSize: 12 }}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--cyan)", fontFamily: "var(--font-space)", letterSpacing: "0.06em", textTransform: "uppercase", flex: 1 }}>
                      {list.title}
                    </span>
                    <button onClick={() => setEditingList({ id: list.id, title: list.title })} title="Rename list" style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12, padding: "0 3px" }}>✎</button>
                    <button onClick={() => deleteList(list.id)} title="Delete list" style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 13, padding: "0 3px" }}>✕</button>
                  </>
                )}
              </div>

              {/* Tasks in this list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 200, overflowY: "auto", paddingLeft: 8 }}>
                {listTasks.length === 0 && <p style={{ color: "var(--text-3)", fontSize: 12 }}>No tasks.</p>}
                {listTasks.map(t => (
                  <div
                    key={t.id}
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                    onMouseEnter={() => setHoveredTask(t.id)}
                    onMouseLeave={() => setHoveredTask(null)}
                  >
                    {editingTask?.id === t.id ? (
                      <>
                        <input
                          autoFocus
                          value={editingTask.title}
                          onChange={e => setEditingTask(p => p ? { ...p, title: e.target.value } : p)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveTask(t.id, t.list_id, editingTask.title, editingTask.due);
                            if (e.key === "Escape") setEditingTask(null);
                          }}
                          style={{ ...inputStyle, flex: 1, fontSize: 13, padding: "5px 10px" }}
                          className="cyber-input"
                        />
                        <input
                          type="date"
                          value={editingTask.due}
                          onChange={e => setEditingTask(p => p ? { ...p, due: e.target.value } : p)}
                          style={{ ...inputStyle, width: 130, fontSize: 12, padding: "5px 8px" }}
                          className="cyber-input"
                        />
                        <button onClick={() => saveTask(t.id, t.list_id, editingTask.title, editingTask.due)} className="btn-primary" style={{ fontSize: 12 }}>Save</button>
                        <button onClick={() => setEditingTask(null)} className="btn-danger" style={{ fontSize: 12 }}>✕</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => apiFetch(`/tasks/${t.id}/complete?list_id=${encodeURIComponent(t.list_id)}`, { method: "POST" }).then(() => loadTasks())}
                          style={{ width: 18, height: 18, borderRadius: 5, border: "1px solid var(--border-hover)", background: "transparent", cursor: "pointer", flexShrink: 0, transition: "background 0.15s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--cyan-dim)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                          {t.due && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>Due {t.due.slice(0, 10)}</div>}
                        </div>
                        {hoveredTask === t.id && (
                          <button
                            onClick={() => setEditingTask({ id: t.id, list_id: t.list_id, title: t.title, due: t.due?.slice(0, 10) ?? "" })}
                            title="Edit task"
                            style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12, padding: "0 3px", lineHeight: 1, transition: "color 0.15s" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--cyan)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; }}
                          >✎</button>
                        )}
                        <button onClick={() => apiFetch(`/tasks/${t.id}?list_id=${encodeURIComponent(t.list_id)}`, { method: "DELETE" }).then(() => loadTasks())} className="btn-danger">✕</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          {/* Add Task */}
          <div className="label" style={{ marginBottom: 10 }}>Add Task</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
            <select
              value={newTask.list_id}
              onChange={e => setNewTask(p => ({ ...p, list_id: e.target.value }))}
              style={{ ...inputStyle, width: 130, fontSize: 12 }}
            >
              {taskLists.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
            <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title" style={{ ...inputStyle, flex: 1 }} className="cyber-input" onKeyDown={e => e.key === "Enter" && createTask()} />
            <input type="date" value={newTask.due} onChange={e => setNewTask(p => ({ ...p, due: e.target.value }))} style={{ ...inputStyle, width: 130 }} className="cyber-input" />
            <button onClick={createTask} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
          </div>

          {/* New List */}
          <div className="label" style={{ marginBottom: 10 }}>New List</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newList} onChange={e => setNewList(e.target.value)} placeholder="List name" style={{ ...inputStyle, flex: 1 }} className="cyber-input" onKeyDown={e => e.key === "Enter" && createList()} />
            <button onClick={createList} className="btn-primary" style={{ fontSize: 13 }}>Create</button>
          </div>
        </div>
      </div>
    ),

    routines: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>⬡ Daily Routines</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 240, overflowY: "auto", marginBottom: 20 }}>
          {routines.length === 0 && <p style={{ color: "var(--text-3)", fontSize: 13 }}>No routines yet.</p>}
          {routines.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => toggleRoutine(r)}
                style={{
                  width: 20, height: 20, borderRadius: 6, border: `1px solid ${r.is_done ? "var(--cyan)" : "var(--border-hover)"}`,
                  background: r.is_done ? "var(--cyan)" : "transparent", cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--bg-base)", fontSize: 11, fontWeight: 700, transition: "all 0.15s",
                }}
              >
                {r.is_done ? "✓" : ""}
              </button>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, color: r.is_done ? "var(--text-3)" : "var(--text-1)", textDecoration: r.is_done ? "line-through" : "none" }}>{r.name}</span>
                {r.scheduled_time && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", marginLeft: 8 }}>{r.scheduled_time}</span>}
              </div>
              <button onClick={() => supabase.from("routines").delete().eq("id", r.id).then(() => loadRoutines())} className="btn-danger">✕</button>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="label" style={{ marginBottom: 10 }}>Add Routine</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newRoutine.name} onChange={e => setNewRoutine(p => ({ ...p, name: e.target.value }))} placeholder="Routine name" style={{ ...inputStyle, flex: 1 }} className="cyber-input" onKeyDown={e => e.key === "Enter" && createRoutine()} />
            <input type="time" value={newRoutine.scheduled_time} onChange={e => setNewRoutine(p => ({ ...p, scheduled_time: e.target.value }))} style={{ ...inputStyle, width: 110 }} className="cyber-input" />
            <button onClick={createRoutine} className="btn-primary" style={{ fontSize: 13 }}>Add</button>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div className="label-cyan" style={{ marginBottom: 8 }}>◈ Task Intelligence</div>
        <h1 style={{ fontFamily: "var(--font-space)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>Productivity</h1>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
            {order.map(id => (
              <SortableWidget
                key={id}
                id={id}
                span={spans[id] ?? DEFAULT_SPANS[id] ?? 1}
                height={heights[id] ?? DEFAULT_HEIGHTS[id] ?? 1}
                onResizeStart={e => handleResizeStart(e, id)}
                onHeightResizeStart={e => handleHeightResizeStart(e, id)}
              >
                {widgets[id]}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
