"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend, LabelList,
} from "recharts";
import { useFinanceVisibility } from "@/lib/finance-visibility";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SPANS_KEY   = "spans_finance";
const HEIGHTS_KEY = "heights_finance_px";
const NUM_COLS    = 2;
const GRID_GAP    = 20;
const MIN_HEIGHT  = 120;
const MAX_HEIGHT  = 1400;

const DEFAULT_HEIGHTS: Record<string, number> = {
  summary:             220,
  spending_breakdown:  440,
  spending_trend:      440,
  spending_frequency:  440,
  savings_trend:       440,
  savings:             440,
  variable_expenses:   660,
  fixed_expenses:      660,
};
const DEFAULT_SPANS: Record<string, number> = {
  summary: 2, spending_breakdown: 1, spending_trend: 2,
  spending_frequency: 1, savings_trend: 1, savings: 2,
  variable_expenses: 2, fixed_expenses: 2,
};

type TabId = "overview" | "savings" | "fixed" | "variable";
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview"  },
  { id: "savings",  label: "Savings"   },
  { id: "fixed",    label: "Fixed Exp" },
  { id: "variable", label: "Var Exp"   },
];
const TAB_WIDGETS: Record<TabId, string[]> = {
  overview: ["summary", "spending_breakdown", "spending_trend", "spending_frequency", "savings_trend"],
  savings:  ["savings"],
  fixed:    ["fixed_expenses"],
  variable: ["variable_expenses"],
};
const TAB_LAYOUT_KEYS: Record<TabId, string> = {
  overview: "layout_finance_overview",
  savings:  "layout_finance_savings",
  fixed:    "layout_finance_fixed",
  variable: "layout_finance_variable",
};
const PIE_COLORS = ["var(--cyan)", "var(--orange)", "var(--violet)", "#34d399", "#fb923c", "#a78bfa", "#60a5fa", "#f472b6"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatMonth(ym: string): string {
  const p = ym.split("-");
  return `${MONTH_NAMES[parseInt(p[1]) - 1]}-${p[0].slice(2)}`;
}
function formatMonthFull(ym: string): string {
  const p = ym.split("-");
  return `${MONTH_NAMES[parseInt(p[1]) - 1]} ${p[0]}`;
}
function parseAmt(s: string): number {
  return parseFloat(String(s).replace(/[$,\s]/g, "")) || 0;
}

interface FixedExpense { _index: number; item: string; cost: string; comments: string }
interface VarExpense   { _index: number; date: string; category: string; description: string; amount: string }
interface Saving       { _index: number; date: string; category: string; description: string; amount: string }
interface Summary      { month: string; fixed_total: number; variable_total: number; total: number; currency: string; by_category: Record<string, number> }

const inputStyle: React.CSSProperties = {
  background: "rgba(7,13,31,0.8)", border: "1px solid var(--border)", borderRadius: 10,
  color: "var(--text-1)", fontFamily: "var(--font-inter)", fontSize: 13,
  padding: "9px 13px", outline: "none", transition: "border-color 0.2s",
};

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

const axisStyle = { fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-mono)" };
const tooltipStyle = { background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11 };
const gridStyle = { strokeDasharray: "2 6", stroke: "rgba(34,211,238,0.06)" };

function SortableFixedRow({ id, children }: { id: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: transform ? `translateY(${transform.y}px)` : undefined,
        zIndex: isDragging ? 10 : undefined,
        position: isDragging ? "relative" : undefined,
        background: isDragging ? "var(--bg-elevated)" : undefined,
        opacity: isDragging ? 0.9 : 1,
      }}
    >
      <td style={{ paddingRight: 4, width: 20 }}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: "grab", color: "var(--text-3)", fontSize: 14, userSelect: "none" }}
        >⠿</span>
      </td>
      {children}
    </tr>
  );
}

export default function FinancePage() {
  const [activeTab, setActiveTab]     = useState<TabId>("overview");
  const [tabOrders, setTabOrders]     = useState<Record<TabId, string[]>>({
    overview: TAB_WIDGETS.overview,
    savings:  TAB_WIDGETS.savings,
    fixed:    TAB_WIDGETS.fixed,
    variable: TAB_WIDGETS.variable,
  });
  const [spans, setSpans]             = useState<Record<string, number>>(DEFAULT_SPANS);
  const [heights, setHeights]         = useState<Record<string, number>>(DEFAULT_HEIGHTS);
  const gridRef                       = useRef<HTMLDivElement>(null);
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [fixed, setFixed]             = useState<FixedExpense[]>([]);
  const [variable, setVariable]       = useState<VarExpense[]>([]);
  const [varMonth, setVarMonth]       = useState(new Date().toISOString().slice(0, 7));
  const [varMonthData, setVarMonthData] = useState<VarExpense[]>([]);
  const [income, setIncome]           = useState<number>(0);
  const [allVariable, setAllVariable] = useState<VarExpense[]>([]);
  const [savings, setSavings]         = useState<Saving[]>([]);
  const [allSavings, setAllSavings]   = useState<Saving[]>([]);
  const [month, setMonth]             = useState(new Date().toISOString().slice(0, 7));

  const [newFixed, setNewFixed]   = useState({ item: "", cost: "", comments: "" });
  const [newVar, setNewVar]       = useState({ date: new Date().toISOString().slice(0, 10), category: "", description: "", amount: "" });
  const [newSaving, setNewSaving] = useState({ date: new Date().toISOString().slice(0, 10), category: "", description: "", amount: "" });
  const [editFixed, setEditFixed] = useState<FixedExpense | null>(null);
  const [editVar, setEditVar]     = useState<VarExpense | null>(null);
  const [paidFixed, setPaidFixed] = useState<Set<number>>(new Set());
  const [editSaving, setEditSaving] = useState<Saving | null>(null);
  const [varSearch, setVarSearch] = useState("");
  const [fixedOrder, setFixedOrder] = useState<number[]>([]);

  useEffect(() => {
    const s  = localStorage.getItem(SPANS_KEY);
    const ht = localStorage.getItem(HEIGHTS_KEY);
    if (s)  setSpans(JSON.parse(s));
    if (ht) setHeights(JSON.parse(ht));
    const loaded: Partial<Record<TabId, string[]>> = {};
    (Object.keys(TAB_LAYOUT_KEYS) as TabId[]).forEach(tab => {
      const raw = localStorage.getItem(TAB_LAYOUT_KEYS[tab]);
      if (raw) loaded[tab] = JSON.parse(raw);
    });
    if (Object.keys(loaded).length) setTabOrders(prev => ({ ...prev, ...loaded }));
    const paid = localStorage.getItem("fixed_paid");
    if (paid) setPaidFixed(new Set(JSON.parse(paid)));
    const fo = localStorage.getItem("fixed_expense_order");
    if (fo) setFixedOrder(JSON.parse(fo));
  }, []);

  const load = useCallback(async () => {
    // Core per-month data
    try {
      const [s, f, v] = await Promise.all([
        apiFetch<Summary>(`/finance/summary?month=${month}`),
        apiFetch<FixedExpense[]>("/finance/fixed"),
        apiFetch<VarExpense[]>(`/finance/variable?month=${month}`),
      ]);
      setSummary(s); setFixed(f); setVariable(v);
    } catch (e) { console.error("Finance core fetch failed:", e); }
    // Income — isolated so a Supabase lookup failure doesn't block charts
    try {
      const inc = await apiFetch<{ amount: number }>("/finance/income");
      setIncome(inc.amount);
    } catch { /* ignore */ }
    // All-time variable data for trend/frequency charts
    try {
      const av = await apiFetch<VarExpense[]>("/finance/variable/all");
      setAllVariable(av);
    } catch (e) { console.error("All-variable fetch failed:", e); }
    // Savings — optional, sheet may not exist yet
    try {
      const [sv, asv] = await Promise.all([
        apiFetch<Saving[]>(`/finance/savings?month=${month}`),
        apiFetch<Saving[]>("/finance/savings/all"),
      ]);
      setSavings(sv); setAllSavings(asv);
    } catch { /* ignore */ }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch<VarExpense[]>(`/finance/variable?month=${varMonth}`)
      .then(d => setVarMonthData(d))
      .catch(e => console.error("varMonth fetch:", e));
  }, [varMonth]);

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
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startSpan = spans[id] ?? DEFAULT_SPANS[id] ?? 1;
    const colWidth = getColWidth();
    function onMove(mv: MouseEvent) {
      const delta = Math.round((mv.clientX - startX) / (colWidth + GRID_GAP));
      handleSpanChange(id, Math.max(1, Math.min(NUM_COLS, startSpan + delta)));
    }
    function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
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
      const cur = tabOrders[activeTab];
      const next = arrayMove(cur, cur.indexOf(active.id as string), cur.indexOf(over.id as string));
      setTabOrders(prev => ({ ...prev, [activeTab]: next }));
      localStorage.setItem(TAB_LAYOUT_KEYS[activeTab], JSON.stringify(next));
    }
  }

  function onFixedDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const currentOrder = orderedFixed.map(f => f._index);
    const oldIdx = currentOrder.indexOf(active.id as number);
    const newIdx = currentOrder.indexOf(over.id as number);
    const next = arrayMove(currentOrder, oldIdx, newIdx);
    setFixedOrder(next);
    localStorage.setItem("fixed_expense_order", JSON.stringify(next));
  }

  async function addFixed() {
    if (!newFixed.item || !newFixed.cost) return;
    try { await apiFetch("/finance/fixed", { method: "POST", body: JSON.stringify({ item: newFixed.item, cost: parseFloat(newFixed.cost), comments: newFixed.comments }) }); setNewFixed({ item: "", cost: "", comments: "" }); load(); }
    catch (e) { alert(String(e)); }
  }
  async function saveEditFixed() {
    if (!editFixed) return;
    try { await apiFetch(`/finance/fixed/${editFixed._index}`, { method: "PUT", body: JSON.stringify({ item: editFixed.item, cost: parseFloat(editFixed.cost), comments: editFixed.comments }) }); setEditFixed(null); load(); }
    catch (e) { alert(String(e)); }
  }
  async function deleteFixed(idx: number) {
    try { await apiFetch(`/finance/fixed/${idx}`, { method: "DELETE" }); load(); } catch (e) { alert(String(e)); }
  }
  function togglePaidFixed(idx: number) {
    setPaidFixed(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      localStorage.setItem("fixed_paid", JSON.stringify([...next]));
      return next;
    });
  }
  function clearPaidFixed() {
    setPaidFixed(new Set());
    localStorage.removeItem("fixed_paid");
  }
  function shiftVarMonth(delta: number) {
    setVarMonth(prev => {
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }
  function reloadVarMonthData() {
    apiFetch<VarExpense[]>(`/finance/variable?month=${varMonth}`)
      .then(d => setVarMonthData(d))
      .catch(() => {});
  }

  async function addVar() {
    if (!newVar.category || !newVar.description || !newVar.amount) return;
    try { await apiFetch("/finance/variable", { method: "POST", body: JSON.stringify({ date: newVar.date, category: newVar.category, description: newVar.description, amount: parseFloat(newVar.amount) }) }); setNewVar({ date: new Date().toISOString().slice(0, 10), category: "", description: "", amount: "" }); load(); reloadVarMonthData(); }
    catch (e) { alert(String(e)); }
  }
  async function saveEditVar() {
    if (!editVar) return;
    try { await apiFetch(`/finance/variable/${editVar._index}`, { method: "PUT", body: JSON.stringify({ date: editVar.date, category: editVar.category, description: editVar.description, amount: parseFloat(editVar.amount) }) }); setEditVar(null); load(); reloadVarMonthData(); }
    catch (e) { alert(String(e)); }
  }
  async function deleteVar(idx: number) {
    try { await apiFetch(`/finance/variable/${idx}`, { method: "DELETE" }); load(); reloadVarMonthData(); } catch (e) { alert(String(e)); }
  }

  async function addSaving() {
    if (!newSaving.category || !newSaving.description || !newSaving.amount) return;
    try { await apiFetch("/finance/savings", { method: "POST", body: JSON.stringify({ date: newSaving.date, category: newSaving.category, description: newSaving.description, amount: parseFloat(newSaving.amount) }) }); setNewSaving({ date: new Date().toISOString().slice(0, 10), category: "", description: "", amount: "" }); load(); }
    catch (e) { alert(String(e)); }
  }
  async function saveEditSaving() {
    if (!editSaving) return;
    try { await apiFetch(`/finance/savings/${editSaving._index}`, { method: "PUT", body: JSON.stringify({ date: editSaving.date, category: editSaving.category, description: editSaving.description, amount: parseFloat(editSaving.amount) }) }); setEditSaving(null); load(); }
    catch (e) { alert(String(e)); }
  }
  async function deleteSaving(idx: number) {
    try { await apiFetch(`/finance/savings/${idx}`, { method: "DELETE" }); load(); } catch (e) { alert(String(e)); }
  }

  // ── Chart data computations ──────────────────────────────────────────────────

  const pieData = summary ? Object.entries(summary.by_category).map(([name, value]) => ({ name, value })) : [];

  const allMonths = [...new Set(allVariable.map(v => v.date.slice(0, 7)))].sort();
  const allCategories = [...new Set(allVariable.map(v => v.category))];

  const trendData = allMonths.map(m => {
    const row: Record<string, number | string> = { month: formatMonth(m) };
    allCategories.forEach(cat => {
      row[cat] = allVariable.filter(v => v.date.startsWith(m) && v.category === cat)
        .reduce((sum, v) => sum + parseAmt(v.amount), 0);
    });
    return row;
  });

  const countData = allMonths.map(m => ({
    month: formatMonth(m),
    count: allVariable.filter(v => v.date.startsWith(m)).length,
  }));
  const avgData = allMonths.map(m => {
    const entries = allVariable.filter(v => v.date.startsWith(m));
    const total = entries.reduce((s, v) => s + parseAmt(v.amount), 0);
    return { month: formatMonth(m), avg: entries.length ? Math.round(total / entries.length * 100) / 100 : 0 };
  });

  const savingsMonths = [...new Set(allSavings.map(s => s.date.slice(0, 7)))].sort();
  const savingsCategories = [...new Set(allSavings.map(s => s.category))];
  const savingsPieData = Object.entries(
    allSavings.filter(s => s.date.startsWith(month)).reduce((acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + parseAmt(s.amount);
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));
  const savingsBarData = savingsMonths.map(m => {
    const row: Record<string, number | string> = { month: formatMonth(m) };
    savingsCategories.forEach(cat => {
      row[cat] = allSavings.filter(s => s.date.startsWith(m) && s.category === cat)
        .reduce((sum, s) => sum + parseAmt(s.amount), 0);
    });
    return row;
  });

  const cur = summary?.currency ?? "SGD";
  const balance = income - (summary?.fixed_total ?? 0) - (summary?.variable_total ?? 0);

  const { visible: financeVisible } = useFinanceVisibility();
  const finHidden = financeVisible ? "" : "finance-hidden";

  // ── Widgets ──────────────────────────────────────────────────────────────────

  const sortedVarData = [...varMonthData].sort((a, b) => b.date.localeCompare(a.date));
  const todayYM = new Date().toISOString().slice(0, 7);

  const searchResults = varSearch.trim()
    ? allVariable
        .filter(v =>
          [v.description || "", v.category || ""].some(f =>
            f.toLowerCase().includes(varSearch.toLowerCase())
          )
        )
        .sort((a, b) => b.date.localeCompare(a.date))
    : null;

  const displayedVarData = searchResults ?? sortedVarData;

  const sortedSavings = [...savings].sort((a, b) => b.date.localeCompare(a.date));

  const orderedFixed: FixedExpense[] = fixedOrder.length
    ? [
        ...fixedOrder
          .map(idx => fixed.find(f => f._index === idx))
          .filter((f): f is FixedExpense => f !== undefined),
        ...fixed.filter(f => !fixedOrder.includes(f._index)),
      ]
    : fixed;

  const widgets: Record<string, React.ReactNode> = {

    summary: (
      <div className="glass" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div className="label-cyan">◈ Monthly Summary</div>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="cyber-input"
            style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, width: "auto" }} />
        </div>
        <div className={finHidden}>
        {summary ? (
          <div className="finance-blur" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {/* Income tile */}
            <div style={{ padding: "16px", background: "rgba(7,13,31,0.5)", borderRadius: 12, border: "1px solid var(--border)" }}>
              <div className="label" style={{ marginBottom: 8 }}>Income</div>
              <div className="metric-value" style={{ fontSize: 22, color: "#34d399" }}>
                {cur} {income.toFixed(2)}
              </div>
            </div>
            {/* Fixed tile */}
            <div style={{ padding: "16px", background: "rgba(7,13,31,0.5)", borderRadius: 12, border: "1px solid var(--border)" }}>
              <div className="label" style={{ marginBottom: 8 }}>Fixed</div>
              <div className="metric-value" style={{ fontSize: 22, color: "var(--text-2)" }}>{cur} {summary.fixed_total.toFixed(2)}</div>
              {income > 0 && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{(summary.fixed_total / income * 100).toFixed(0)}% of income</div>}
            </div>
            {/* Variable tile */}
            <div style={{ padding: "16px", background: "rgba(7,13,31,0.5)", borderRadius: 12, border: "1px solid var(--border)" }}>
              <div className="label" style={{ marginBottom: 8 }}>Variable</div>
              <div className="metric-value" style={{ fontSize: 22, color: "var(--cyan)" }}>{cur} {summary.variable_total.toFixed(2)}</div>
              {income > 0 && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{(summary.variable_total / income * 100).toFixed(0)}% of income</div>}
            </div>
            {/* Balance tile */}
            <div style={{ padding: "16px", background: "rgba(7,13,31,0.5)", borderRadius: 12, border: "1px solid var(--border)" }}>
              <div className="label" style={{ marginBottom: 8 }}>Balance</div>
              <div className="metric-value" style={{ fontSize: 22, color: income > 0 ? (balance >= 0 ? "#34d399" : "var(--orange)") : "var(--text-3)" }}>
                {income > 0 ? `${cur} ${balance.toFixed(2)}` : "—"}
              </div>
              {income > 0 && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{(balance / income * 100).toFixed(0)}% of income</div>}
            </div>
          </div>
        ) : <p style={{ color: "var(--text-3)", fontSize: 13 }}>Loading…</p>}
        </div>
      </div>
    ),

    spending_breakdown: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>◉ Variable Expense Breakdown — {formatMonthFull(month)}</div>
        <div className={`${finHidden} finance-blur`} style={{ flex: 1, minHeight: 0 }}>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="45%" outerRadius={75} dataKey="value" nameKey="name"
                labelLine={false}
                label={({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }) => {
                  if (percent < 0.05) return null;
                  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                  const x = cx + r * Math.cos((-midAngle) * Math.PI / 180);
                  const y = cy + r * Math.sin((-midAngle) * Math.PI / 180);
                  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontFamily="var(--font-mono)">{`${(percent * 100).toFixed(0)}%`}</text>;
                }}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === "number" ? `${cur} ${v.toFixed(2)}` : ""} />
              <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)" }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <p style={{ color: "var(--text-3)", fontSize: 13 }}>No variable expenses this month.</p>}
        </div>
      </div>
    ),

    spending_trend: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>◈ Spending Trend — by Category</div>
        <div className={`${finHidden} finance-blur`} style={{ flex: 1, minHeight: 0 }}>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={50} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === "number" ? `${cur} ${v.toFixed(2)}` : ""} />
              <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-3)" }} />
              {allCategories.map((cat, i) => (
                <Line key={cat} type="monotone" dataKey={cat} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : <p style={{ color: "var(--text-3)", fontSize: 13 }}>No data yet.</p>}
        </div>
      </div>
    ),

    spending_frequency: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 12 }}>⬡ Spending Frequency</div>
        <div className={`${finHidden} finance-blur`} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {countData.length > 0 ? (
          <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>ENTRY COUNT / MONTH</div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countData}>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="var(--cyan)" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="count" position="top" style={{ fill: "var(--text-3)", fontSize: 9, fontFamily: "var(--font-mono)" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>AVG AMOUNT / ENTRY ({cur})</div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={avgData}>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === "number" ? `${cur} ${v.toFixed(2)}` : ""} />
                    <Line type="monotone" dataKey="avg" stroke="var(--orange)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : <p style={{ color: "var(--text-3)", fontSize: 13 }}>No data yet.</p>}
        </div>
      </div>
    ),

    savings_trend: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 12 }}>◑ Savings Trend</div>
        <div className={`${finHidden} finance-blur`} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {savingsPieData.length > 0 || savingsBarData.length > 0 ? (
          <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>{formatMonthFull(month).toUpperCase()}</div>
              {savingsPieData.length > 0 ? (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={savingsPieData} cx="50%" cy="45%" outerRadius={60} dataKey="value" nameKey="name">
                        {savingsPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === "number" ? `${cur} ${v.toFixed(2)}` : ""} />
                      <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-3)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p style={{ color: "var(--text-3)", fontSize: 12 }}>No savings this month.</p>}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>BY MONTH</div>
              {savingsBarData.length > 0 ? (
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={savingsBarData}>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                      <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === "number" ? `${cur} ${v.toFixed(2)}` : ""} />
                      {savingsCategories.map((cat, i) => (
                        <Bar key={cat} dataKey={cat} stackId="a" fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p style={{ color: "var(--text-3)", fontSize: 12 }}>No monthly data.</p>}
            </div>
          </div>
        ) : <p style={{ color: "var(--text-3)", fontSize: 13 }}>No savings recorded yet.</p>}
        </div>
      </div>
    ),

    savings: (
      <div className="glass" style={{ padding: "24px" }}>
        <div className="label-cyan" style={{ marginBottom: 16 }}>◈ Savings — {month}</div>
        <div className={finHidden}>
        <div style={{ overflowX: "auto", overflowY: "auto", marginBottom: 20 }}>
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Description</th><th style={{ textAlign: "right" }}>Amount</th><th /></tr>
            </thead>
            <tbody className="finance-blur">
              {sortedSavings.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No savings this month.</td></tr>
              )}
              {sortedSavings.map((s) => (
                <tr key={s._index}>
                  {editSaving?._index === s._index ? (
                    <>
                      <td><input value={editSaving.date} onChange={e => setEditSaving(p => p && { ...p, date: e.target.value })} style={{ ...inputStyle, width: 110, padding: "4px 8px", fontSize: 12 }} /></td>
                      <td><input value={editSaving.category} onChange={e => setEditSaving(p => p && { ...p, category: e.target.value })} style={{ ...inputStyle, width: 90, padding: "4px 8px", fontSize: 12 }} /></td>
                      <td><input value={editSaving.description} onChange={e => setEditSaving(p => p && { ...p, description: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                      <td><input value={editSaving.amount} onChange={e => setEditSaving(p => p && { ...p, amount: e.target.value })} style={{ ...inputStyle, width: 80, padding: "4px 8px", fontSize: 12, textAlign: "right" }} /></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={saveEditSaving} style={{ color: "var(--cyan)", fontSize: 11, background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Save</button>
                        <button onClick={() => setEditSaving(null)} style={{ color: "var(--text-3)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{s.date}</td>
                      <td style={{ color: "var(--text-2)" }}>{s.category}</td>
                      <td>{s.description}</td>
                      <td style={{ textAlign: "right", color: "#34d399", fontFamily: "var(--font-mono)" }}>{parseFloat(s.amount).toFixed(2)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => setEditSaving({ ...s })} className="btn-icon" style={{ fontSize: 11, marginRight: 4 }}>✎</button>
                        <button onClick={() => deleteSaving(s._index)} className="btn-danger">✕</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="label" style={{ marginBottom: 10 }}>Add Saving</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <input type="date" value={newSaving.date} onChange={e => setNewSaving(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, width: 140 }} className="cyber-input" />
            <input value={newSaving.category} onChange={e => setNewSaving(p => ({ ...p, category: e.target.value }))} placeholder="Category" style={{ ...inputStyle, width: 120 }} className="cyber-input" />
            <input value={newSaving.description} onChange={e => setNewSaving(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={{ ...inputStyle, flex: 1, minWidth: 140 }} className="cyber-input" />
            <input value={newSaving.amount} onChange={e => setNewSaving(p => ({ ...p, amount: e.target.value }))} placeholder="Amount" type="number" step="0.01" style={{ ...inputStyle, width: 100 }} className="cyber-input" />
            <button onClick={addSaving} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
          </div>
        </div>
      </div>
    ),

    variable_expenses: (
      <div className="glass" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="label-cyan">⬡ Variable Expenses — {formatMonthFull(varMonth)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button onClick={() => shiftVarMonth(-1)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-2)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", transition: "border-color 0.15s, color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
            >‹</button>
            <button onClick={() => shiftVarMonth(1)} disabled={varMonth >= todayYM} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: varMonth >= todayYM ? "var(--text-3)" : "var(--text-2)", cursor: varMonth >= todayYM ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", opacity: varMonth >= todayYM ? 0.4 : 1, transition: "border-color 0.15s, color 0.15s" }}
              onMouseEnter={e => { if (varMonth < todayYM) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = varMonth >= todayYM ? "var(--text-3)" : "var(--text-2)"; }}
            >›</button>
          </div>
        </div>
        <div className={finHidden}>
        <div style={{ overflowX: "auto", overflowY: "auto", marginBottom: 20 }}>
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Description</th><th style={{ textAlign: "right" }}>Amount</th><th /></tr>
            </thead>
            <tbody className="finance-blur">
              {sortedVarData.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No expenses this month.</td></tr>
              )}
              {sortedVarData.map((v) => (
                <tr key={v._index}>
                  {editVar?._index === v._index ? (
                    <>
                      <td><input value={editVar.date} onChange={e => setEditVar(p => p && { ...p, date: e.target.value })} style={{ ...inputStyle, width: 110, padding: "4px 8px", fontSize: 12 }} /></td>
                      <td><input value={editVar.category} onChange={e => setEditVar(p => p && { ...p, category: e.target.value })} style={{ ...inputStyle, width: 90, padding: "4px 8px", fontSize: 12 }} /></td>
                      <td><input value={editVar.description} onChange={e => setEditVar(p => p && { ...p, description: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                      <td><input value={editVar.amount} onChange={e => setEditVar(p => p && { ...p, amount: e.target.value })} style={{ ...inputStyle, width: 80, padding: "4px 8px", fontSize: 12, textAlign: "right" }} /></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={saveEditVar} style={{ color: "var(--cyan)", fontSize: 11, background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Save</button>
                        <button onClick={() => setEditVar(null)} style={{ color: "var(--text-3)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{v.date}</td>
                      <td style={{ color: "var(--text-2)" }}>{v.category}</td>
                      <td>{v.description}</td>
                      <td style={{ textAlign: "right", color: "var(--orange)", fontFamily: "var(--font-mono)" }}>{parseAmt(v.amount).toFixed(2)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => setEditVar({ ...v })} className="btn-icon" style={{ fontSize: 11, marginRight: 4 }}>✎</button>
                        <button onClick={() => deleteVar(v._index)} className="btn-danger">✕</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="label" style={{ marginBottom: 10 }}>Add Expense</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <input type="date" value={newVar.date} onChange={e => setNewVar(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, width: 140 }} className="cyber-input" />
            <input value={newVar.category} onChange={e => setNewVar(p => ({ ...p, category: e.target.value }))} placeholder="Category" style={{ ...inputStyle, width: 120 }} className="cyber-input" />
            <input value={newVar.description} onChange={e => setNewVar(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={{ ...inputStyle, flex: 1, minWidth: 140 }} className="cyber-input" />
            <input value={newVar.amount} onChange={e => setNewVar(p => ({ ...p, amount: e.target.value }))} placeholder="Amount" type="number" step="0.01" style={{ ...inputStyle, width: 100 }} className="cyber-input" />
            <button onClick={addVar} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
          </div>
        </div>
      </div>
    ),

    fixed_expenses: (
      <div className="glass" style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="label-cyan">◷ Fixed Expenses</div>
          {paidFixed.size > 0 && (
            <button onClick={clearPaidFixed} style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-3)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", letterSpacing: "0.05em", transition: "color 0.15s, border-color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.4)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
            >CLEAR ALL</button>
          )}
        </div>
        <div className={finHidden}>
        <div style={{ overflowX: "auto", overflowY: "auto", marginBottom: 20 }}>
          <table className="data-table">
            <thead>
              <tr><th style={{ width: 32 }} /><th>Item</th><th style={{ textAlign: "right" }}>Cost/mo</th><th>Notes</th><th /></tr>
            </thead>
            <tbody className="finance-blur">
              {fixed.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No fixed expenses.</td></tr>
              )}
              {fixed.map((f) => {
                const isPaid = paidFixed.has(f._index);
                return (
                <tr key={f._index} style={{ opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>
                  <td style={{ paddingRight: 4 }}>
                    <input
                      type="checkbox"
                      checked={isPaid}
                      onChange={() => togglePaidFixed(f._index)}
                      style={{ accentColor: "var(--cyan)", width: 14, height: 14, cursor: "pointer" }}
                    />
                  </td>
                  {editFixed?._index === f._index ? (
                    <>
                      <td><input value={editFixed.item} onChange={e => setEditFixed(p => p && { ...p, item: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                      <td><input value={editFixed.cost} onChange={e => setEditFixed(p => p && { ...p, cost: e.target.value })} style={{ ...inputStyle, width: 80, padding: "4px 8px", fontSize: 12, textAlign: "right" }} /></td>
                      <td><input value={editFixed.comments} onChange={e => setEditFixed(p => p && { ...p, comments: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={saveEditFixed} style={{ color: "var(--cyan)", fontSize: 11, background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Save</button>
                        <button onClick={() => setEditFixed(null)} style={{ color: "var(--text-3)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ textDecoration: isPaid ? "line-through" : "none" }}>{f.item}</td>
                      <td style={{ textAlign: "right", color: isPaid ? "var(--text-3)" : "var(--cyan)", fontFamily: "var(--font-mono)", textDecoration: isPaid ? "line-through" : "none" }}>{parseFloat(f.cost).toFixed(2)}</td>
                      <td style={{ color: "var(--text-3)", fontSize: 12 }}>{f.comments}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => setEditFixed({ ...f })} className="btn-icon" style={{ fontSize: 11, marginRight: 4 }}>✎</button>
                        <button onClick={() => deleteFixed(f._index)} className="btn-danger">✕</button>
                      </td>
                    </>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="label" style={{ marginBottom: 10 }}>Add Fixed Expense</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newFixed.item} onChange={e => setNewFixed(p => ({ ...p, item: e.target.value }))} placeholder="Item" style={{ ...inputStyle, flex: 1 }} className="cyber-input" />
            <input value={newFixed.cost} onChange={e => setNewFixed(p => ({ ...p, cost: e.target.value }))} placeholder="Cost" type="number" step="0.01" style={{ ...inputStyle, width: 100 }} className="cyber-input" />
            <input value={newFixed.comments} onChange={e => setNewFixed(p => ({ ...p, comments: e.target.value }))} placeholder="Notes" style={{ ...inputStyle, width: 120 }} className="cyber-input" />
            <button onClick={addFixed} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
          </div>
        </div>
      </div>
    ),
  };

  const currentOrder = tabOrders[activeTab];

  const panel: React.CSSProperties = {
    background: "var(--bg-1)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
  };
  const metaRow: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)",
    textTransform: "uppercase", letterSpacing: "0.08em",
  };
  const formLabel: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)",
    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12,
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div className="label-cyan" style={{ marginBottom: 8 }}>◈ Financial Intelligence</div>
        <h1 style={{ fontFamily: "var(--font-space)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>Finance</h1>
      </div>
      <div style={{ display: "flex", marginBottom: 28, borderBottom: "1px solid var(--border)" }}>
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: "8px 20px", background: "none", border: "none",
            borderBottom: activeTab === id ? "2px solid var(--cyan)" : "2px solid transparent",
            color: activeTab === id ? "var(--cyan)" : "var(--text-3)",
            fontFamily: "var(--font-mono)", fontSize: 12, cursor: "pointer",
            letterSpacing: "0.08em", marginBottom: -1,
            transition: "color 0.15s, border-color 0.15s", textTransform: "uppercase",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Fixed Expenses ─────────────────────────────────────────────── */}
      {activeTab === "fixed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={metaRow}>
            <span>{fixed.length} items · {cur} {fixed.reduce((s, f) => s + parseFloat(f.cost || "0"), 0).toFixed(2)} /mo</span>
            {paidFixed.size > 0 && (
              <button onClick={clearPaidFixed} style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-3)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", letterSpacing: "0.05em", transition: "color 0.15s, border-color 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
              >CLEAR ALL</button>
            )}
          </div>
          <div style={{ ...panel, padding: "20px 24px" }}>
            <div style={formLabel}>Add Fixed Expense</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newFixed.item} onChange={e => setNewFixed(p => ({ ...p, item: e.target.value }))} placeholder="Item" style={{ ...inputStyle, flex: 1 }} className="cyber-input" />
              <input value={newFixed.cost} onChange={e => setNewFixed(p => ({ ...p, cost: e.target.value }))} placeholder="Cost" type="number" step="0.01" style={{ ...inputStyle, width: 100 }} className="cyber-input" />
              <input value={newFixed.comments} onChange={e => setNewFixed(p => ({ ...p, comments: e.target.value }))} placeholder="Notes" style={{ ...inputStyle, width: 120 }} className="cyber-input" />
              <button onClick={addFixed} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
            </div>
          </div>
          <div style={{ ...panel, overflow: "hidden" }}>
            <div className={finHidden} style={{ overflowX: "auto" }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFixedDragEnd}>
                <SortableContext items={orderedFixed.map(f => f._index)} strategy={verticalListSortingStrategy}>
                  <table className="data-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ width: 20 }} />
                        <th style={{ width: 32 }} />
                        <th>Item</th>
                        <th style={{ textAlign: "right" }}>Cost/mo</th>
                        <th>Notes</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="finance-blur">
                      {orderedFixed.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No fixed expenses.</td></tr>
                      )}
                      {orderedFixed.map((f) => {
                        const isPaid = paidFixed.has(f._index);
                        return (
                          <SortableFixedRow key={f._index} id={f._index}>
                            <td style={{ paddingRight: 4, opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>
                              <input type="checkbox" checked={isPaid} onChange={() => togglePaidFixed(f._index)} style={{ accentColor: "var(--cyan)", width: 14, height: 14, cursor: "pointer" }} />
                            </td>
                            {editFixed?._index === f._index ? (
                              <>
                                <td><input value={editFixed.item} onChange={e => setEditFixed(p => p && { ...p, item: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                                <td><input value={editFixed.cost} onChange={e => setEditFixed(p => p && { ...p, cost: e.target.value })} style={{ ...inputStyle, width: 80, padding: "4px 8px", fontSize: 12, textAlign: "right" }} /></td>
                                <td><input value={editFixed.comments} onChange={e => setEditFixed(p => p && { ...p, comments: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                  <button onClick={saveEditFixed} style={{ color: "var(--cyan)", fontSize: 11, background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Save</button>
                                  <button onClick={() => setEditFixed(null)} style={{ color: "var(--text-3)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ textDecoration: isPaid ? "line-through" : "none", opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>{f.item}</td>
                                <td style={{ textAlign: "right", color: isPaid ? "var(--text-3)" : "var(--cyan)", fontFamily: "var(--font-mono)", textDecoration: isPaid ? "line-through" : "none", opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>{parseFloat(f.cost).toFixed(2)}</td>
                                <td style={{ color: "var(--text-3)", fontSize: 12, opacity: isPaid ? 0.45 : 1, transition: "opacity 0.2s" }}>{f.comments}</td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                  <button onClick={() => setEditFixed({ ...f })} className="btn-icon" style={{ fontSize: 11, marginRight: 4 }}>✎</button>
                                  <button onClick={() => deleteFixed(f._index)} className="btn-danger">✕</button>
                                </td>
                              </>
                            )}
                          </SortableFixedRow>
                        );
                      })}
                    </tbody>
                  </table>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      )}

      {/* ── Variable Expenses ──────────────────────────────────────────── */}
      {activeTab === "variable" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={metaRow}>
            <span>
              {searchResults
                ? `${searchResults.length} results · ${cur} ${searchResults.reduce((s, v) => s + parseAmt(v.amount), 0).toFixed(2)} — all months`
                : `${sortedVarData.length} entries · ${cur} ${sortedVarData.reduce((s, v) => s + parseAmt(v.amount), 0).toFixed(2)} — ${formatMonthFull(varMonth)}`
              }
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                value={varSearch}
                onChange={e => setVarSearch(e.target.value)}
                placeholder="Search expenses…"
                style={{ ...inputStyle, padding: "5px 10px", fontSize: 12, width: 180 }}
                className="cyber-input"
              />
              {!searchResults && (
                <>
                  <button onClick={() => shiftVarMonth(-1)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-2)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", transition: "border-color 0.15s, color 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
                  >‹</button>
                  <button onClick={() => shiftVarMonth(1)} disabled={varMonth >= todayYM} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: varMonth >= todayYM ? "var(--text-3)" : "var(--text-2)", cursor: varMonth >= todayYM ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", opacity: varMonth >= todayYM ? 0.4 : 1, transition: "border-color 0.15s, color 0.15s" }}
                    onMouseEnter={e => { if (varMonth < todayYM) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)"; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = varMonth >= todayYM ? "var(--text-3)" : "var(--text-2)"; }}
                  >›</button>
                </>
              )}
            </div>
          </div>
          <div style={{ ...panel, padding: "20px 24px" }}>
            <div style={formLabel}>Add Expense</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <input type="date" value={newVar.date} onChange={e => setNewVar(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, width: 140 }} className="cyber-input" />
              <input value={newVar.category} onChange={e => setNewVar(p => ({ ...p, category: e.target.value }))} placeholder="Category" style={{ ...inputStyle, width: 120 }} className="cyber-input" />
              <input value={newVar.description} onChange={e => setNewVar(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={{ ...inputStyle, flex: 1, minWidth: 140 }} className="cyber-input" />
              <input value={newVar.amount} onChange={e => setNewVar(p => ({ ...p, amount: e.target.value }))} placeholder="Amount" type="number" step="0.01" style={{ ...inputStyle, width: 100 }} className="cyber-input" />
              <button onClick={addVar} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
            </div>
          </div>
          <div style={{ ...panel, overflow: "hidden" }}>
            <div className={finHidden} style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style={{ textAlign: "right" }}>Amount</th><th /></tr></thead>
                <tbody className="finance-blur">
                  {displayedVarData.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No expenses found.</td></tr>}
                  {displayedVarData.map((v) => (
                    <tr key={v._index}>
                      {editVar?._index === v._index ? (
                        <>
                          <td><input value={editVar.date} onChange={e => setEditVar(p => p && { ...p, date: e.target.value })} style={{ ...inputStyle, width: 110, padding: "4px 8px", fontSize: 12 }} /></td>
                          <td><input value={editVar.category} onChange={e => setEditVar(p => p && { ...p, category: e.target.value })} style={{ ...inputStyle, width: 90, padding: "4px 8px", fontSize: 12 }} /></td>
                          <td><input value={editVar.description} onChange={e => setEditVar(p => p && { ...p, description: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                          <td><input value={editVar.amount} onChange={e => setEditVar(p => p && { ...p, amount: e.target.value })} style={{ ...inputStyle, width: 80, padding: "4px 8px", fontSize: 12, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button onClick={saveEditVar} style={{ color: "var(--cyan)", fontSize: 11, background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Save</button>
                            <button onClick={() => setEditVar(null)} style={{ color: "var(--text-3)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{v.date}</td>
                          <td style={{ color: "var(--text-2)" }}>{v.category}</td>
                          <td>{v.description}</td>
                          <td style={{ textAlign: "right", color: "var(--orange)", fontFamily: "var(--font-mono)" }}>{parseAmt(v.amount).toFixed(2)}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button onClick={() => setEditVar({ ...v })} className="btn-icon" style={{ fontSize: 11, marginRight: 4 }}>✎</button>
                            <button onClick={() => deleteVar(v._index)} className="btn-danger">✕</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Savings ────────────────────────────────────────────────────── */}
      {activeTab === "savings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={metaRow}>
            <span>{sortedSavings.length} entries · {cur} {sortedSavings.reduce((s, sv) => s + parseAmt(sv.amount), 0).toFixed(2)} — {formatMonthFull(month)}</span>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="cyber-input"
              style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, width: "auto" }} />
          </div>
          <div style={{ ...panel, padding: "20px 24px" }}>
            <div style={formLabel}>Add Saving</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <input type="date" value={newSaving.date} onChange={e => setNewSaving(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, width: 140 }} className="cyber-input" />
              <input value={newSaving.category} onChange={e => setNewSaving(p => ({ ...p, category: e.target.value }))} placeholder="Category" style={{ ...inputStyle, width: 120 }} className="cyber-input" />
              <input value={newSaving.description} onChange={e => setNewSaving(p => ({ ...p, description: e.target.value }))} placeholder="Description" style={{ ...inputStyle, flex: 1, minWidth: 140 }} className="cyber-input" />
              <input value={newSaving.amount} onChange={e => setNewSaving(p => ({ ...p, amount: e.target.value }))} placeholder="Amount" type="number" step="0.01" style={{ ...inputStyle, width: 100 }} className="cyber-input" />
              <button onClick={addSaving} className="btn-primary" style={{ fontSize: 13, whiteSpace: "nowrap" }}>Add</button>
            </div>
          </div>
          <div style={{ ...panel, overflow: "hidden" }}>
            <div className={finHidden} style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style={{ textAlign: "right" }}>Amount</th><th /></tr></thead>
                <tbody className="finance-blur">
                  {sortedSavings.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>No savings this month.</td></tr>}
                  {sortedSavings.map((s) => (
                    <tr key={s._index}>
                      {editSaving?._index === s._index ? (
                        <>
                          <td><input value={editSaving.date} onChange={e => setEditSaving(p => p && { ...p, date: e.target.value })} style={{ ...inputStyle, width: 110, padding: "4px 8px", fontSize: 12 }} /></td>
                          <td><input value={editSaving.category} onChange={e => setEditSaving(p => p && { ...p, category: e.target.value })} style={{ ...inputStyle, width: 90, padding: "4px 8px", fontSize: 12 }} /></td>
                          <td><input value={editSaving.description} onChange={e => setEditSaving(p => p && { ...p, description: e.target.value })} style={{ ...inputStyle, width: "100%", padding: "4px 8px", fontSize: 12 }} /></td>
                          <td><input value={editSaving.amount} onChange={e => setEditSaving(p => p && { ...p, amount: e.target.value })} style={{ ...inputStyle, width: 80, padding: "4px 8px", fontSize: 12, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button onClick={saveEditSaving} style={{ color: "var(--cyan)", fontSize: 11, background: "none", border: "none", cursor: "pointer", marginRight: 6 }}>Save</button>
                            <button onClick={() => setEditSaving(null)} style={{ color: "var(--text-3)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{s.date}</td>
                          <td style={{ color: "var(--text-2)" }}>{s.category}</td>
                          <td>{s.description}</td>
                          <td style={{ textAlign: "right", color: "#34d399", fontFamily: "var(--font-mono)" }}>{parseFloat(s.amount).toFixed(2)}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button onClick={() => setEditSaving({ ...s })} className="btn-icon" style={{ fontSize: 11, marginRight: 4 }}>✎</button>
                            <button onClick={() => deleteSaving(s._index)} className="btn-danger">✕</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Overview (DnD grid) ────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={currentOrder} strategy={rectSortingStrategy}>
            <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
              {currentOrder.map((id) => (
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
      )}
    </div>
  );
}
