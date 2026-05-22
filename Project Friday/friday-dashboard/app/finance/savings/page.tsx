"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, USER_ID } from "@/lib/supabase";
import PageShell from "../../components/page-shell";
import FinanceNav from "../../components/finance-nav";
import { useFinancePrivacy } from "@/hooks/useFinancePrivacy";

interface SavingRow {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

interface MonthSummary {
  entries: SavingRow[];
  total: number;
  count: number;
  by_category: Record<string, number>;
}

function fmtAmount(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function prevMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function monthDisplay(ym: string) {
  return new Date(ym + "-02").toLocaleString("default", { month: "long", year: "numeric" });
}

function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

const SAVINGS_CATEGORIES = ["Emergency Fund", "Investment", "Retirement", "Travel", "Education", "General"];

const CATEGORY_COLORS: Record<string, string> = {
  "Emergency Fund": "#00ff88",
  Investment: "#a78bfa",
  Retirement: "#f472b6",
  Travel: "#f59e0b",
  Education: "#00d4ff",
  General: "#fb923c",
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "#4a7a9b";
}

function computeSummary(rows: SavingRow[]): MonthSummary {
  const by_category: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    by_category[r.category] = Math.round(((by_category[r.category] ?? 0) + amt) * 100) / 100;
    total += amt;
  }
  return { entries: rows, total: Math.round(total * 100) / 100, count: rows.length, by_category };
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export default function SavingsPage() {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(today);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { show, toggle } = useFinancePrivacy();

  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  });
  const [newCat, setNewCat] = useState(SAVINGS_CATEGORIES[0]);
  const [newDesc, setNewDesc] = useState("");
  const [newAmt, setNewAmt] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAmt, setEditAmt] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchMonth = useCallback((m: string) => {
    setLoading(true);
    const last = lastDayOfMonth(m);
    supabase
      .from("savings")
      .select("id,date,category,description,amount")
      .eq("user_id", USER_ID)
      .gte("date", `${m}-01`)
      .lte("date", `${m}-${String(last).padStart(2, "0")}`)
      .order("date", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("[Savings] fetch error:", error);
        const rows = (data ?? []).map((r) => ({
          ...r,
          amount: Number(r.amount) || 0,
        })) as SavingRow[];
        setSummary(computeSummary(rows));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchMonth(month);

    const channel = supabase
      .channel(`savings_${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "savings", filter: `user_id=eq.${USER_ID}` }, () => fetchMonth(month))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [month, fetchMonth]);

  function go(m: string) {
    if (m > today) return;
    setMonth(m);
  }

  async function addSaving() {
    const amt = parseFloat(newAmt);
    if (!newDesc.trim() || isNaN(amt) || amt <= 0) return;
    setSaving(true);
    await supabase.from("savings").insert({
      user_id: USER_ID,
      date: newDate,
      category: newCat,
      description: newDesc.trim(),
      amount: Math.round(amt * 100) / 100,
    });
    setNewDesc("");
    setNewAmt("");
    const n = new Date();
    setNewDate(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
    setAdding(false);
    setSaving(false);
  }

  function startEdit(e: SavingRow) {
    setEditingId(e.id);
    setEditDate(e.date);
    setEditCat(e.category);
    setEditDesc(e.description);
    setEditAmt(String(e.amount));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    const amt = parseFloat(editAmt);
    if (!editDesc.trim() || isNaN(amt) || amt <= 0 || !editingId) return;
    setEditSaving(true);
    const updated = {
      date: editDate,
      category: editCat,
      description: editDesc.trim(),
      amount: Math.round(amt * 100) / 100,
    };
    await supabase.from("savings").update(updated).eq("id", editingId);
    setSummary((prev) => {
      if (!prev) return prev;
      return computeSummary(prev.entries.map((e) => e.id === editingId ? { ...e, ...updated } : e));
    });
    setEditingId(null);
    setEditSaving(false);
  }

  async function deleteSaving(id: string) {
    await supabase.from("savings").delete().eq("id", id);
  }

  const currency = "SGD";

  const addForm = (
    <div className={`px-4 pb-3 flex flex-col gap-3 ${summary && summary.entries.length > 0 ? "border-b border-[#0d1e30]" : ""}`}>
      <div className="flex gap-3 flex-wrap">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00d4ff]"
        />
        <select
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          className="bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00d4ff]"
        >
          {SAVINGS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Description"
          onKeyDown={(e) => e.key === "Enter" && addSaving()}
          className="flex-1 min-w-0 bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-3 py-2 text-sm text-white placeholder-[#2a3f52] focus:outline-none focus:border-[#00d4ff]"
        />
        <input
          type="number"
          value={newAmt}
          onChange={(e) => setNewAmt(e.target.value)}
          placeholder="0.00"
          step="0.01"
          onKeyDown={(e) => e.key === "Enter" && addSaving()}
          className="w-28 bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-[#2a3f52] focus:outline-none focus:border-[#00d4ff] text-right"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-[11px] text-[#4a7a9b] hover:text-white transition-colors">
          Cancel
        </button>
        <button
          onClick={addSaving}
          disabled={saving}
          className="px-4 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg text-[11px] text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );

  return (
    <PageShell activeTab="/finance" sidebarContent={<FinanceNav />}>
      <div className="p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Savings</h1>
            <p className="text-[#4a7a9b] text-sm mt-1">Monthly savings log</p>
          </div>
          <button
            onClick={toggle}
            className="text-[#4a7a9b] hover:text-[#00d4ff] transition-colors text-xl leading-none mt-1"
            title={show ? "Hide figures" : "Show figures"}
          >
            {show ? "👁" : "🙈"}
          </button>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-5 bg-[#0a1628] border border-[#1a3a5c] rounded-xl px-4 py-3">
          <button onClick={() => go(prevMonth(month))} className="text-[#4a7a9b] hover:text-[#00d4ff] transition-colors text-lg px-1">‹</button>
          <span className="text-sm font-medium text-white">{monthDisplay(month)}</span>
          <button
            onClick={() => go(nextMonth(month))}
            disabled={month >= today}
            className="text-[#4a7a9b] hover:text-[#00d4ff] transition-colors text-lg px-1 disabled:opacity-30 disabled:cursor-not-allowed"
          >›</button>
        </div>

        {loading ? (
          <p className="text-[#4a7a9b] text-sm text-center py-12">Loading…</p>
        ) : !summary || summary.entries.length === 0 ? (
          <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b]">Entries</p>
              {!adding && (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a3a5c] rounded-lg text-xs text-[#4a7a9b] hover:border-[#00ff88] hover:text-[#00ff88] transition-colors"
                >
                  <span className="text-base leading-none">+</span> Add Saving
                </button>
              )}
            </div>
            {adding && addForm}
            <div className="px-4 py-8 text-center border-t border-[#0d1e30]">
              <p className="text-[#4a7a9b] text-sm">No savings recorded for {monthDisplay(month)}.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-4 text-center">
                <p className="text-[10px] text-[#4a7a9b] uppercase tracking-widest mb-1">Total Saved</p>
                <p className="text-lg font-mono font-bold text-[#00ff88]">
                  <span className={show ? "" : "blur-sm select-none pointer-events-none"}>
                    {currency} {fmtAmount(summary.total)}
                  </span>
                </p>
              </div>
              <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-4 text-center">
                <p className="text-[10px] text-[#4a7a9b] uppercase tracking-widest mb-1">Entries</p>
                <p className="text-lg font-mono font-bold text-white">{summary.count}</p>
              </div>
              <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-4 text-center">
                <p className="text-[10px] text-[#4a7a9b] uppercase tracking-widest mb-1">Avg / Entry</p>
                <p className="text-lg font-mono font-bold text-white">
                  <span className={show ? "" : "blur-sm select-none pointer-events-none"}>
                    {currency} {fmtAmount(summary.count > 0 ? summary.total / summary.count : 0)}
                  </span>
                </p>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-4 mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b] mb-3">By Category</p>
              <div className="flex flex-col gap-1.5">
                {Object.entries(summary.by_category)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amt]) => (
                    <div key={cat} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: categoryColor(cat) }} />
                      <span className="text-xs text-[#9ab] flex-1">{cat}</span>
                      <span className="text-xs font-mono text-white">
                        <span className={show ? "" : "blur-sm select-none pointer-events-none"}>
                          {currency} {fmtAmount(amt)}
                        </span>
                      </span>
                      <span className="text-[10px] text-[#4a7a9b] w-10 text-right">
                        {summary.total > 0 ? ((amt / summary.total) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Entries */}
            <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b]">Entries</p>
                {!adding && (
                  <button
                    onClick={() => setAdding(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a3a5c] rounded-lg text-xs text-[#4a7a9b] hover:border-[#00ff88] hover:text-[#00ff88] transition-colors"
                  >
                    <span className="text-base leading-none">+</span> Add Saving
                  </button>
                )}
              </div>

              {adding && addForm}

              <div className="flex flex-col divide-y divide-[#0d1e30]">
                {summary.entries.map((e) =>
                  editingId === e.id ? (
                    <div key={e.id} className="px-4 py-3 flex flex-col gap-2 bg-[#060e1c]">
                      <div className="flex gap-2 flex-wrap">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(ev) => setEditDate(ev.target.value)}
                          className="bg-[#0a1628] border border-[#1a3a5c] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00d4ff]"
                        />
                        <select
                          value={editCat}
                          onChange={(ev) => setEditCat(ev.target.value)}
                          className="bg-[#0a1628] border border-[#1a3a5c] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#00d4ff]"
                        >
                          {SAVINGS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                          value={editDesc}
                          onChange={(ev) => setEditDesc(ev.target.value)}
                          placeholder="Description"
                          onKeyDown={(ev) => ev.key === "Enter" && saveEdit()}
                          className="flex-1 min-w-0 bg-[#0a1628] border border-[#1a3a5c] rounded-lg px-2 py-1.5 text-xs text-white placeholder-[#2a3f52] focus:outline-none focus:border-[#00d4ff]"
                        />
                        <input
                          type="number"
                          value={editAmt}
                          onChange={(ev) => setEditAmt(ev.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          onKeyDown={(ev) => ev.key === "Enter" && saveEdit()}
                          className="w-24 bg-[#0a1628] border border-[#1a3a5c] rounded-lg px-2 py-1.5 text-xs text-white font-mono placeholder-[#2a3f52] focus:outline-none focus:border-[#00d4ff] text-right"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={cancelEdit} className="px-3 py-1.5 text-xs text-[#4a7a9b] hover:text-white transition-colors">
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={editSaving}
                          className="px-4 py-1.5 bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-lg text-xs text-[#00d4ff] hover:bg-[#00d4ff]/20 transition-colors disabled:opacity-50"
                        >
                          {editSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#060e1c] transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: categoryColor(e.category) }} />
                      <span className="text-[11px] text-[#4a7a9b] w-14 shrink-0">{fmtDate(e.date)}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0"
                        style={{ color: categoryColor(e.category), borderColor: `${categoryColor(e.category)}40` }}
                      >
                        {e.category}
                      </span>
                      <span className="text-xs text-white flex-1 truncate">{e.description || "—"}</span>
                      <span className={`text-xs font-mono text-[#00ff88] shrink-0 ${show ? "" : "blur-sm select-none pointer-events-none"}`}>
                        {fmtAmount(e.amount)}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          onClick={() => startEdit(e)}
                          className="p-1.5 rounded text-[#364c61] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors"
                          title="Edit"
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => deleteSaving(e.id)}
                          className="p-1.5 rounded text-[#364c61] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
