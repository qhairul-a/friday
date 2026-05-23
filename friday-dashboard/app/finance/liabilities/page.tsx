"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase, USER_ID } from "@/lib/supabase";
import { FridayProfile } from "@/lib/types";
import PageShell from "../../components/page-shell";
import FinanceNav from "../../components/finance-nav";
import { useFinancePrivacy } from "@/hooks/useFinancePrivacy";

interface Liability {
  id: string;
  title: string;
  amount: number;
  notes: string | null;
  paid_month: string | null;
}

interface FormState {
  title: string;
  amount: string;
  notes: string;
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

function LiabilityForm({
  form,
  currency,
  onChange,
  onSave,
  onCancel,
}: {
  form: FormState;
  currency: string;
  onChange: (patch: Partial<FormState>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 bg-[#060e1c] border border-[#1a3a5c] rounded-lg p-3">
      <div className="flex items-center gap-2">
        <input
          value={form.title}
          onChange={(e) => onChange({ title: e.target.value })}
          autoFocus
          placeholder="e.g. Rent, Car loan"
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          className="flex-1 bg-transparent text-sm text-white placeholder-[#2a3f52] focus:outline-none"
        />
        <div className="w-px h-4 bg-[#1a3a5c]" />
        <span className="text-[11px] text-[#4a7a9b] shrink-0">{currency}</span>
        <input
          value={form.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          type="number"
          placeholder="0"
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          className="w-24 bg-transparent text-sm text-white font-mono placeholder-[#2a3f52] focus:outline-none text-right"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Notes (optional)"
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          className="flex-1 bg-transparent text-[11px] text-[#4a7a9b] placeholder-[#2a3f52] focus:outline-none"
        />
        <div className="w-px h-4 bg-[#1a3a5c]" />
        <button onClick={onSave} className="text-[11px] text-[#00d4ff] hover:text-white transition-colors px-1">Save</button>
        <button onClick={onCancel} className="text-[11px] text-[#4a7a9b] hover:text-white transition-colors px-1">✕</button>
      </div>
    </div>
  );
}

function SortableRow({
  l,
  month,
  currency,
  show,
  editingId,
  onTogglePaid,
  onStartEdit,
  onRemove,
}: {
  l: Liability;
  month: string;
  currency: string;
  show: boolean;
  editingId: string | null;
  onTogglePaid: (id: string) => void;
  onStartEdit: (l: Liability) => void;
  onRemove: (id: string) => void;
}) {
  const isPaid = l.paid_month === month;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: l.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${
        isPaid ? "bg-[#071a0e] border-[#00ff88]/15" : "bg-[#0a1628] border-[#1a3a5c] hover:border-[#243e5a]"
      }`}
    >
      {/* Drag handle — only show when not editing this item */}
      {editingId !== l.id && (
        <button
          className="cursor-grab active:cursor-grabbing touch-none shrink-0 hover:text-[#4a7a9b] transition-colors"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <DragHandle />
        </button>
      )}

      {/* Paid checkbox */}
      <button
        onClick={() => onTogglePaid(l.id)}
        className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
          isPaid ? "bg-[#00ff88] border-[#00ff88]" : "border-[#1a3a5c] hover:border-[#00d4ff]"
        }`}
      >
        {isPaid && (
          <svg className="w-3 h-3" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#050b14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Title + notes */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isPaid ? "line-through text-[#364c61]" : "text-white"}`}>
          {l.title}
        </span>
        {l.notes && (
          <p className={`text-[10px] mt-0.5 truncate ${isPaid ? "text-[#2a3f52]" : "text-[#4a7a9b]"}`}>
            {l.notes}
          </p>
        )}
      </div>

      {/* Amount */}
      <span className={`font-mono text-sm font-medium shrink-0 ${isPaid ? "text-[#364c61]" : "text-[#00d4ff]"}`}>
        <span className={show ? "" : "blur-sm select-none pointer-events-none"}>
          {currency} {l.amount.toLocaleString()}
        </span>
      </span>

      {/* Actions */}
      <button onClick={() => onStartEdit(l)} className="text-[#2a3f52] hover:text-[#00d4ff] transition-colors text-sm px-0.5" title="Edit">✎</button>
      <button onClick={() => onRemove(l.id)} className="text-[#2a3f52] hover:text-red-400 transition-colors text-sm px-0.5" title="Delete">✕</button>
    </div>
  );
}

export default function LiabilitiesPage() {
  const [profile, setProfile] = useState<FridayProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ title: "", amount: "", notes: "" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const { show, toggle } = useFinancePrivacy();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    supabase
      .from("profiles")
      .select("data")
      .eq("user_id", USER_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data.data as FridayProfile);
        setLoading(false);
      });
  }, []);

  const liabilities: Liability[] = (profile?.finance.liabilities_list ?? []).map((l) => ({
    notes: null,
    ...("due_date" in l ? { notes: (l as Record<string, unknown>).due_date as string | null } : {}),
    ...l,
  }));

  const currency = profile?.finance.currency ?? "SGD";
  const month = thisMonth();
  const totalAmount = liabilities.reduce((s, l) => s + l.amount, 0);
  const paidAmount = liabilities.filter((l) => l.paid_month === month).reduce((s, l) => s + l.amount, 0);
  const unpaidCount = liabilities.filter((l) => l.paid_month !== month).length;

  const saveList = useCallback(async (items: Liability[], currentProfile: FridayProfile) => {
    setSaving(true);
    const updated: FridayProfile = {
      ...currentProfile,
      finance: { ...currentProfile.finance, liabilities_list: items },
    };
    await supabase
      .from("profiles")
      .upsert({ user_id: USER_ID, data: updated, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setProfile(updated);
    setSaving(false);
  }, []);

  function update(items: Liability[]) {
    if (!profile) return;
    saveList(items, profile);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = liabilities.findIndex(l => l.id === active.id);
    const newIdx = liabilities.findIndex(l => l.id === over.id);
    update(arrayMove(liabilities, oldIdx, newIdx));
  }

  function startAdd() {
    setForm({ title: "", amount: "", notes: "" });
    setAdding(true);
    setEditingId(null);
  }

  function startEdit(l: Liability) {
    setForm({ title: l.title, amount: String(l.amount), notes: l.notes ?? "" });
    setEditingId(l.id);
    setAdding(false);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function saveAdd() {
    const amt = parseFloat(form.amount);
    if (!form.title.trim() || isNaN(amt)) return;
    update([...liabilities, {
      id: crypto.randomUUID(),
      title: form.title.trim(),
      amount: amt,
      notes: form.notes.trim() || null,
      paid_month: null,
    }]);
    setAdding(false);
    setForm({ title: "", amount: "", notes: "" });
  }

  function saveEdit() {
    const amt = parseFloat(form.amount);
    if (!form.title.trim() || isNaN(amt)) return;
    update(liabilities.map((l) =>
      l.id === editingId
        ? { ...l, title: form.title.trim(), amount: amt, notes: form.notes.trim() || null }
        : l
    ));
    setEditingId(null);
  }

  function remove(id: string) {
    update(liabilities.filter((l) => l.id !== id));
  }

  function togglePaid(id: string) {
    update(liabilities.map((l) => {
      if (l.id !== id) return l;
      return { ...l, paid_month: l.paid_month === month ? null : month };
    }));
  }

  function clearAllPaid() {
    update(liabilities.map((l) => ({ ...l, paid_month: null })));
  }

  function patchForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  const activeItem = activeId ? liabilities.find(l => l.id === activeId) : null;

  return (
    <PageShell activeTab="/finance" sidebarContent={<FinanceNav />}>
      <div className="p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Fixed Expenses</h1>
            <p className="text-[#4a7a9b] text-sm mt-1">Track and confirm monthly payments</p>
          </div>
          <div className="flex items-center gap-3">
            {saving && <span className="text-[10px] text-[#4a7a9b]">Saving…</span>}
            {paidAmount > 0 && !adding && !editingId && (
              <button
                onClick={clearAllPaid}
                className="text-[11px] text-[#4a7a9b] hover:text-white transition-colors uppercase tracking-wider"
              >
                Clear all
              </button>
            )}
            <button
              onClick={toggle}
              className="text-[#4a7a9b] hover:text-[#00d4ff] transition-colors text-xl leading-none"
              title={show ? "Hide figures" : "Show figures"}
            >
              {show ? "👁" : "🙈"}
            </button>
            {!adding && !editingId && (
              <button
                onClick={startAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a3a5c] rounded-lg text-[11px] text-[#4a7a9b] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
              >
                <span className="text-base leading-none">+</span> Add liability
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-[#4a7a9b] text-sm">Loading…</p>
        ) : (
          <>
            {/* Summary cards */}
            {liabilities.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-4 text-center">
                  <p className="text-[10px] text-[#4a7a9b] uppercase tracking-widest mb-1">Total</p>
                  <p className="text-lg font-mono font-bold text-white">
                    <span className={show ? "" : "blur-sm select-none pointer-events-none"}>
                      {currency} {totalAmount.toLocaleString()}
                    </span>
                  </p>
                </div>
                <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-4 text-center">
                  <p className="text-[10px] text-[#4a7a9b] uppercase tracking-widest mb-1">Paid this month</p>
                  <p className={`text-lg font-mono font-bold ${paidAmount > 0 ? "text-[#00ff88]" : "text-[#364c61]"}`}>
                    <span className={show ? "" : "blur-sm select-none pointer-events-none"}>
                      {currency} {paidAmount.toLocaleString()}
                    </span>
                  </p>
                </div>
                <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-4 text-center">
                  <p className="text-[10px] text-[#4a7a9b] uppercase tracking-widest mb-1">Remaining</p>
                  <p className={`text-lg font-mono font-bold ${unpaidCount > 0 ? "text-yellow-400" : "text-[#00ff88]"}`}>
                    {unpaidCount === 0 ? "All clear" : `${unpaidCount} pending`}
                  </p>
                </div>
              </div>
            )}

            {/* Add form */}
            {adding && (
              <div className="mb-3">
                <LiabilityForm form={form} currency={currency} onChange={patchForm} onSave={saveAdd} onCancel={cancel} />
              </div>
            )}

            {/* List */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={liabilities.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {liabilities.length === 0 && !adding && (
                    <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-10 text-center">
                      <p className="text-[#4a7a9b] text-sm">No liabilities yet.</p>
                      <p className="text-[#364c61] text-xs mt-1">Hit &quot;+ Add liability&quot; to get started.</p>
                    </div>
                  )}

                  {liabilities.map((l) =>
                    editingId === l.id ? (
                      <LiabilityForm
                        key={l.id}
                        form={form}
                        currency={currency}
                        onChange={patchForm}
                        onSave={saveEdit}
                        onCancel={cancel}
                      />
                    ) : (
                      <SortableRow
                        key={l.id}
                        l={l}
                        month={month}
                        currency={currency}
                        show={show}
                        editingId={editingId}
                        onTogglePaid={togglePaid}
                        onStartEdit={startEdit}
                        onRemove={remove}
                      />
                    )
                  )}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeItem && (
                  <div className="bg-[#0d1e30] border border-[#00d4ff]/30 rounded-xl px-4 py-3 shadow-2xl shadow-black/50 flex items-center gap-3">
                    <DragHandle />
                    <span className="text-sm text-white flex-1">{activeItem.title}</span>
                    <span className="font-mono text-sm text-[#00d4ff]">
                      {currency} {activeItem.amount.toLocaleString()}
                    </span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>

            {/* Add another */}
            {!adding && liabilities.length > 0 && !editingId && (
              <button
                onClick={startAdd}
                className="mt-3 w-full py-2 border border-dashed border-[#0d1e30] rounded-xl text-[11px] text-[#2a3f52] hover:border-[#1a3a5c] hover:text-[#4a7a9b] transition-colors"
              >
                + Add another
              </button>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
