"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext, DragOverlay, DragStartEvent, DragEndEvent, DragOverEvent,
  PointerSensor, useSensor, useSensors, closestCorners, useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase, USER_ID } from "@/lib/supabase";
import { Task } from "@/lib/types";
import PageShell from "../components/page-shell";
import TasksNav from "../components/tasks-nav";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const PRIORITY_COLOURS: Record<Task["priority"], string> = {
  low: "bg-[#0d1e30] text-[#4a7a9b]",
  normal: "bg-[#0d2240] text-[#00d4ff]",
  high: "bg-[#2a0d0d] text-red-400",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("normal");
  const [newDue, setNewDue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const tasksRef = useRef<Task[]>([]);
  const dragStartTasks = useRef<Task[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  async function load() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", USER_ID)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    setTasks((data as Task[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function archiveTask(id: string) {
    await supabase.from("tasks").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function saveTaskEdit(id: string, fields: Partial<Task>) {
    await supabase.from("tasks").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
  }

  async function addTask() {
    if (!newTitle.trim()) return;
    const todoTasks = tasks.filter(t => t.status === "todo");
    const order_index = todoTasks.length > 0 ? Math.max(...todoTasks.map(t => t.order_index)) + 1 : 0;
    const row = {
      user_id: USER_ID,
      title: newTitle.trim(),
      priority: newPriority,
      due_date: newDue || null,
      label: newLabel.trim() || null,
      notes: "",
      status: "todo" as const,
      order_index,
    };
    const { data } = await supabase.from("tasks").insert(row).select().single();
    if (data) setTasks(prev => [...prev, data as Task]);
    setNewTitle(""); setNewDue(""); setNewPriority("normal"); setNewLabel(""); setAdding(false);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
    dragStartTasks.current = tasksRef.current;
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    setTasks(prev => {
      const activeTask = prev.find(t => t.id === activeId);
      if (!activeTask) return prev;

      const overTask = prev.find(t => t.id === overId);
      const overStatus = (overTask?.status ?? COLUMNS.find(c => c.key === overId)?.key) as Task["status"] | undefined;
      if (!overStatus) return prev;

      const activeColTasks = prev.filter(t => t.status === activeTask.status).sort((a, b) => a.order_index - b.order_index);
      const overColTasks = prev.filter(t => t.status === overStatus).sort((a, b) => a.order_index - b.order_index);

      const activeIdx = activeColTasks.findIndex(t => t.id === activeId);
      const overIdx = overTask ? overColTasks.findIndex(t => t.id === overId) : overColTasks.length;

      if (activeTask.status === overStatus) {
        const reordered = arrayMove(activeColTasks, activeIdx, overIdx);
        return prev.map(t => {
          const idx = reordered.findIndex(r => r.id === t.id);
          return idx >= 0 ? { ...t, order_index: idx } : t;
        });
      } else {
        const srcWithout = activeColTasks
          .filter(t => t.id !== activeId)
          .map((t, i) => ({ ...t, order_index: i }));
        const tgtWithActive = [
          ...overColTasks.slice(0, overIdx),
          { ...activeTask, status: overStatus, order_index: overIdx },
          ...overColTasks.slice(overIdx).map((t, i) => ({ ...t, order_index: overIdx + 1 + i })),
        ];
        return prev.map(t => {
          const src = srcWithout.find(s => s.id === t.id);
          if (src) return src;
          const tgt = tgtWithActive.find(s => s.id === t.id);
          if (tgt) return tgt;
          return t;
        });
      }
    });
  }

  async function handleDragEnd(_event: DragEndEvent) {
    const currentTasks = tasksRef.current;
    setActiveId(null);

    const changed = currentTasks.filter(t => {
      const orig = dragStartTasks.current.find(o => o.id === t.id);
      return orig && (orig.order_index !== t.order_index || orig.status !== t.status);
    });

    if (changed.length > 0) {
      await Promise.all(
        changed.map(t =>
          supabase.from("tasks").update({
            status: t.status,
            order_index: t.order_index,
            updated_at: new Date().toISOString(),
          }).eq("id", t.id)
        )
      );
    }
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) ?? null : null;

  if (loading) return (
    <PageShell activeTab="/tasks" sidebarContent={<TasksNav />}>
      <div className="flex items-center justify-center h-full text-[#4a7a9b]">Loading…</div>
    </PageShell>
  );

  return (
    <PageShell activeTab="/tasks" sidebarContent={<TasksNav />}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">Tasks</h1>
              <p className="text-[#4a7a9b] text-xs mt-0.5">Drag to reorder or move between columns</p>
            </div>
            <button
              onClick={() => setAdding(true)}
              className="bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 border border-[#00d4ff]/30 text-[#00d4ff] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              + Add task
            </button>
          </div>

          {adding && (
            <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-4 mb-5 flex flex-col gap-3 shrink-0">
              <input
                autoFocus
                placeholder="Task title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()}
                className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-3 py-2 text-sm text-white placeholder-[#364c61] focus:outline-none focus:border-[#00d4ff]"
              />
              <div className="flex gap-3">
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value as Task["priority"])}
                  className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="low">Low priority</option>
                  <option value="normal">Normal priority</option>
                  <option value="high">High priority</option>
                </select>
                <input
                  type="date"
                  value={newDue}
                  onChange={e => setNewDue(e.target.value)}
                  className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
                <input
                  placeholder="Label (optional)"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-3 py-2 text-sm text-white placeholder-[#364c61] focus:outline-none focus:border-[#a78bfa] flex-1"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addTask} className="bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 border border-[#00d4ff]/30 text-[#00d4ff] px-4 py-2 rounded-lg text-sm transition-colors">Add</button>
                <button onClick={() => setAdding(false)} className="text-[#4a7a9b] hover:text-white px-4 py-2 text-sm transition-colors">Cancel</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
            {COLUMNS.map(col => {
              const colTasks = tasks
                .filter(t => t.status === col.key)
                .sort((a, b) => a.order_index - b.order_index);
              return (
                <DroppableColumn
                  key={col.key}
                  id={col.key}
                  label={col.label}
                  tasks={colTasks}
                  onDelete={deleteTask}
                  onArchive={archiveTask}
                  onSaveEdit={saveTaskEdit}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeTask && <TaskCardStatic task={activeTask} />}
        </DragOverlay>
      </DndContext>
    </PageShell>
  );
}

function DroppableColumn({ id, label, tasks, onDelete, onArchive, onSaveEdit }: {
  id: string; label: string; tasks: Task[];
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onSaveEdit: (id: string, fields: Partial<Task>) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-3 flex flex-col min-h-0 transition-colors bg-[#0a1628] border ${
        isOver ? "border-[#00d4ff]/60 shadow-[0_0_20px_rgba(0,212,255,0.1)]" : "border-[#1a3a5c]"
      }`}
    >
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b]">{label}</h2>
        <span className="text-[9px] bg-[#060e1c] text-[#4a7a9b] rounded-full px-2 py-0.5">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 overflow-y-auto flex-1">
          {tasks.map(task => (
            <SortableCard
              key={task.id}
              task={task}
              onDelete={onDelete}
              onArchive={onArchive}
              onSaveEdit={onSaveEdit}
            />
          ))}
          {tasks.length === 0 && (
            <p className="text-[10px] text-[#364c61] text-center py-6">Drop tasks here</p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ task, onDelete, onArchive, onSaveEdit }: {
  task: Task;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onSaveEdit: (id: string, fields: Partial<Task>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDue, setEditDue] = useState(task.due_date ?? "");
  const [editLabel, setEditLabel] = useState(task.label ?? "");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  function saveEdit() {
    onSaveEdit(task.id, {
      title: editTitle.trim() || task.title,
      priority: editPriority,
      due_date: editDue || null,
      label: editLabel.trim() || null,
    });
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}>
        <div className="bg-[#060e1c] border border-[#a78bfa]/40 rounded-xl p-3 flex flex-col gap-2">
          <input
            autoFocus
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setIsEditing(false); }}
            className="bg-[#0a1628] border border-[#1a3a5c] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#a78bfa]"
          />
          <div className="flex gap-2">
            <select
              value={editPriority}
              onChange={e => setEditPriority(e.target.value as Task["priority"])}
              className="bg-[#0a1628] border border-[#1a3a5c] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none flex-1"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <input
              type="date"
              value={editDue}
              onChange={e => setEditDue(e.target.value)}
              className="bg-[#0a1628] border border-[#1a3a5c] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none flex-1"
            />
          </div>
          <input
            placeholder="Label (optional)"
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            className="bg-[#0a1628] border border-[#1a3a5c] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#364c61] focus:outline-none focus:border-[#a78bfa]"
          />
          <div className="flex gap-2">
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={saveEdit}
              className="bg-[#a78bfa]/10 hover:bg-[#a78bfa]/20 border border-[#a78bfa]/30 text-[#a78bfa] px-3 py-1 rounded-lg text-xs transition-colors"
            >Save</button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => setIsEditing(false)}
              className="text-[#4a7a9b] hover:text-white px-3 py-1 text-xs transition-colors"
            >Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCardStatic
        task={task}
        onDelete={onDelete}
        onArchive={onArchive}
        onEdit={() => setIsEditing(true)}
        dragProps={{ ...listeners, ...attributes }}
      />
    </div>
  );
}

function TaskCardStatic({ task, onDelete, onArchive, onEdit, dragProps }: {
  task: Task;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onEdit?: () => void;
  dragProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <div
      className={`bg-[#060e1c] border border-[#1a3a5c] rounded-xl p-3 flex flex-col gap-2 select-none ${
        dragProps ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      {...dragProps}
    >
      <p className="text-sm font-medium leading-snug text-white">{task.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {task.label && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#1a0d2e] text-[#a78bfa]">
            {task.label}
          </span>
        )}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOURS[task.priority]}`}>
          {task.priority}
        </span>
        {task.due_date && <span className="text-[10px] text-[#4a7a9b]">Due {task.due_date}</span>}
      </div>
      {task.notes && <p className="text-[11px] text-[#364c61]">{task.notes}</p>}
      {(onDelete || onArchive || onEdit) && (
        <div className="flex justify-end gap-1">
          {onEdit && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={onEdit}
              className="text-[10px] text-[#364c61] hover:text-[#a78bfa] px-2 py-1 rounded hover:bg-[#1a0d2e] transition-colors"
            >Edit</button>
          )}
          {onArchive && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onArchive(task.id)}
              className="text-[10px] text-[#364c61] hover:text-[#4a7a9b] px-2 py-1 rounded hover:bg-[#0a1628] transition-colors"
            >Archive</button>
          )}
          {onDelete && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onDelete(task.id)}
              className="text-[10px] text-[#364c61] hover:text-red-400 px-2 py-1 rounded hover:bg-[#1a0d0d] transition-colors"
            >Delete</button>
          )}
        </div>
      )}
    </div>
  );
}
