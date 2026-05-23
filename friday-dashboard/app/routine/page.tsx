"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase, USER_ID } from "@/lib/supabase";
import { RoutineItem } from "@/lib/types";
import PageShell from "../components/page-shell";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function DayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  function toggle(d: number) {
    onChange(value.includes(d) ? value.filter(x => x !== d) : [...value, d].sort((a, b) => a - b));
  }
  return (
    <div className="flex gap-1">
      {ALL_DAYS.map(d => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
            value.includes(d)
              ? "bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/40"
              : "bg-[#060e1c] text-[#364c61] border border-[#1a3a5c]"
          }`}
        >
          {DAY_LABELS[d]}
        </button>
      ))}
    </div>
  );
}

function daysLabel(days: number[]) {
  if (days.length === 7) return "Every day";
  if (days.length === 0) return "Never";
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];
  if (weekdays.every(d => days.includes(d)) && days.length === 5) return "Weekdays";
  if (weekend.every(d => days.includes(d)) && days.length === 2) return "Weekends";
  return days.map(d => DAY_LABELS[d]).join(" · ");
}

function DragHandle() {
  return (
    <svg className="w-4 h-4 text-[#2a4a6a]" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  );
}

function SortableRow({
  item,
  editingId,
  editingTitle,
  editingDays,
  onToggle,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditTitleChange,
  onEditDaysChange,
}: {
  item: RoutineItem;
  editingId: string | null;
  editingTitle: string;
  editingDays: number[];
  onToggle: (item: RoutineItem) => void;
  onStartEdit: (item: RoutineItem) => void;
  onSaveEdit: (item: RoutineItem) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEditTitleChange: (v: string) => void;
  onEditDaysChange: (v: number[]) => void;
}) {
  const isEditing = editingId === item.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl px-4 py-3 transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <button
          className="cursor-grab active:cursor-grabbing touch-none shrink-0 hover:text-[#4a7a9b] transition-colors"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <DragHandle />
        </button>

        <input
          type="checkbox"
          checked={item.is_done}
          onChange={() => onToggle(item)}
          className="accent-[#00d4ff] shrink-0 w-4 h-4 cursor-pointer"
        />

        {isEditing ? (
          <input
            autoFocus
            value={editingTitle}
            onChange={e => onEditTitleChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") onSaveEdit(item);
              if (e.key === "Escape") onCancelEdit();
            }}
            className="flex-1 bg-[#060e1c] border border-[#00d4ff]/40 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
          />
        ) : (
          <span className={`flex-1 text-sm ${item.is_done ? "line-through text-[#4a7a9b]" : "text-white"}`}>
            {item.title}
          </span>
        )}

        {isEditing ? (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onSaveEdit(item)} className="text-[11px] text-[#00d4ff] hover:text-white transition-colors">
              Save
            </button>
            <button onClick={onCancelEdit} className="text-[11px] text-[#4a7a9b] hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onStartEdit(item)} className="text-[11px] text-[#4a7a9b] hover:text-[#00d4ff] transition-colors">
              Edit
            </button>
            <button onClick={() => onDelete(item.id)} className="text-[11px] text-[#4a7a9b] hover:text-red-400 transition-colors">
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2.5 pl-11">
        <span className="text-[10px] text-[#4a7a9b] uppercase tracking-wider shrink-0">Repeat</span>
        {isEditing ? (
          <DayPicker value={editingDays} onChange={onEditDaysChange} />
        ) : (
          <span className="text-[10px] text-[#4a7a9b]">{daysLabel(item.days ?? ALL_DAYS)}</span>
        )}
      </div>
    </div>
  );
}

export default function RoutinePage() {
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDays, setNewDays] = useState<number[]>(ALL_DAYS);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDays, setEditingDays] = useState<number[]>(ALL_DAYS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveOrderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    supabase.from("routine_items").select("*").eq("user_id", USER_ID)
      .order("order_index", { ascending: true })
      .then(({ data }) => { setItems((data as RoutineItem[]) ?? []); setLoading(false); });
  }, []);

  const persistOrder = useCallback((ordered: RoutineItem[]) => {
    if (saveOrderTimer.current) clearTimeout(saveOrderTimer.current);
    saveOrderTimer.current = setTimeout(() => {
      const updates = ordered.map((item, idx) =>
        supabase.from("routine_items").update({ order_index: idx }).eq("id", item.id)
      );
      Promise.all(updates);
    }, 600);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems(prev => {
      const oldIdx = prev.findIndex(i => i.id === active.id);
      const newIdx = prev.findIndex(i => i.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      persistOrder(reordered);
      return reordered;
    });
  }

  async function toggle(item: RoutineItem) {
    await supabase.from("routine_items").update({ is_done: !item.is_done }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: !i.is_done } : i));
  }

  async function addItem() {
    const title = newTitle.trim();
    if (!title || newDays.length === 0) return;
    setAdding(true);
    const order_index = items.length;
    const { data, error } = await supabase
      .from("routine_items")
      .insert({ user_id: USER_ID, title, is_done: false, order_index, days: newDays })
      .select()
      .single();
    if (!error && data) setItems(prev => [...prev, data as RoutineItem]);
    setNewTitle("");
    setNewDays(ALL_DAYS);
    setAdding(false);
    inputRef.current?.focus();
  }

  async function deleteItem(id: string) {
    await supabase.from("routine_items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function startEdit(item: RoutineItem) {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setEditingDays(item.days ?? ALL_DAYS);
  }

  async function saveEdit(item: RoutineItem) {
    const title = editingTitle.trim();
    if (!title) return;
    const days = editingDays;
    await supabase.from("routine_items").update({ title, days }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, title, days } : i));
    setEditingId(null);
  }

  async function resetAll() {
    await supabase.from("routine_items").update({ is_done: false }).eq("user_id", USER_ID);
    setItems(prev => prev.map(i => ({ ...i, is_done: false })));
  }

  const doneCount = items.filter(i => i.is_done).length;
  const activeItem = activeId ? items.find(i => i.id === activeId) : null;

  return (
    <PageShell activeTab="/routine">
      <div className="p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Routine</h1>
            {items.length > 0 && (
              <p className="text-[#4a7a9b] text-sm mt-1">{doneCount} / {items.length} completed</p>
            )}
          </div>
          {items.length > 0 && (
            <button
              onClick={resetAll}
              className="text-[11px] text-[#4a7a9b] hover:text-white transition-colors uppercase tracking-wider"
            >
              Reset all
            </button>
          )}
        </div>

        {/* Add item form */}
        <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl px-4 py-3 mb-6 flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              placeholder="Add a routine item…"
              className="flex-1 bg-transparent text-sm text-white placeholder-[#364c61] focus:outline-none"
            />
            <button
              onClick={addItem}
              disabled={adding || !newTitle.trim() || newDays.length === 0}
              className="px-4 py-1.5 text-sm text-[#00d4ff] border border-[#00d4ff]/40 rounded-lg hover:bg-[#00d4ff]/10 transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#4a7a9b] uppercase tracking-wider shrink-0">Repeat</span>
            <DayPicker value={newDays} onChange={setNewDays} />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-[#4a7a9b] text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-10 text-center">
            <p className="text-[#4a7a9b] text-sm">No routine items yet.</p>
            <p className="text-[#364c61] text-xs mt-1">Add your first item above to get started.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {items.map(item => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    editingId={editingId}
                    editingTitle={editingTitle}
                    editingDays={editingDays}
                    onToggle={toggle}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={deleteItem}
                    onEditTitleChange={setEditingTitle}
                    onEditDaysChange={setEditingDays}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeItem && (
                <div className="bg-[#0d1e30] border border-[#00d4ff]/30 rounded-xl px-4 py-3 shadow-2xl shadow-black/50">
                  <div className="flex items-center gap-3">
                    <DragHandle />
                    <span className="text-sm text-white">{activeItem.title}</span>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </PageShell>
  );
}
