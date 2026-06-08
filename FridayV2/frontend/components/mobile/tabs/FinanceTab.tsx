"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useFinanceVisibility } from "@/lib/finance-visibility";

interface Summary {
  month: string;
  fixed_total: number;
  variable_total: number;
  total: number;
  currency: string;
  by_category: Record<string, number>;
}
interface VarExpense { _index: number; date: string; category: string; description: string; amount: string }
interface FixedExpense { _index: number; item: string; cost: string; comments: string }

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}
function parseAmt(s: string | number): number {
  return parseFloat(String(s).replace(/[$,\s]/g, "")) || 0;
}

const SECTION: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 8.5,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: "var(--text-3)", marginBottom: 8, marginTop: 16,
};
const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(34,211,238,0.07)",
  borderRadius: 12, padding: "12px 14px", marginBottom: 8,
};
const TILE: React.CSSProperties = {
  flex: 1, padding: "12px 10px", borderRadius: 10,
  background: "rgba(7,13,31,0.5)",
  border: "1px solid rgba(255,255,255,0.05)",
  display: "flex", flexDirection: "column", gap: 4,
};

const CAT_COLORS = ["var(--cyan)","var(--violet)","#fb923c","#34d399","#60a5fa","#f472b6","#fbbf24","#a78bfa"];

export default function FinanceTab() {
  const { visible } = useFinanceVisibility();

  const [month,   setMonth]   = useState(new Date().toISOString().slice(0,7));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [variable,setVariable]= useState<VarExpense[]>([]);
  const [fixed,   setFixed]   = useState<FixedExpense[]>([]);
  const [income,  setIncome]  = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, v, f] = await Promise.all([
        apiFetch<Summary>(`/finance/summary?month=${month}`),
        apiFetch<VarExpense[]>(`/finance/variable?month=${month}`),
        apiFetch<FixedExpense[]>("/finance/fixed"),
      ]);
      setSummary(s); setVariable(v); setFixed(f);
      try {
        const inc = await apiFetch<{ amount: number }>("/finance/income");
        setIncome(inc.amount);
      } catch { /* income optional */ }
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  function shiftMonth(delta: number) {
    setMonth(prev => {
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }

  function fmt(val: number): string {
    if (!visible) return "••••";
    const cur = summary?.currency ?? "SGD";
    return `${cur} ${val.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (loading) return (
    <div style={{ padding: 16, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
  );
  if (error) return (
    <div style={{ padding: 16, color: "#f87171", fontFamily: "var(--font-mono)", fontSize: 11 }}>Error: {error}</div>
  );

  const balance = income > 0 ? income - (summary?.fixed_total ?? 0) - (summary?.variable_total ?? 0) : null;
  const cur = summary?.currency ?? "SGD";

  const categories = summary
    ? Object.entries(summary.by_category).sort((a, b) => b[1] - a[1])
    : [];
  const maxCat = categories[0]?.[1] ?? 1;

  const recentVar = [...variable]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div style={{ padding: "14px 14px 80px" }}>

      {/* Month navigator */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 4,
      }}>
        <button onClick={() => shiftMonth(-1)} style={{
          background: "none", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 6,
          color: "var(--text-2)", cursor: "pointer", fontSize: 16, lineHeight: 1,
          padding: "3px 10px",
        }}>‹</button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cyan)", letterSpacing: "0.1em" }}>
          {fmtMonth(month)}
        </span>
        <button
          onClick={() => shiftMonth(1)}
          disabled={month >= new Date().toISOString().slice(0,7)}
          style={{
            background: "none", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 6,
            color: "var(--text-2)", cursor: "pointer", fontSize: 16, lineHeight: 1,
            padding: "3px 10px",
            opacity: month >= new Date().toISOString().slice(0,7) ? 0.3 : 1,
          }}
        >›</button>
      </div>

      {/* Summary tiles */}
      <div style={SECTION}>Monthly Summary</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {income > 0 && (
          <div style={TILE}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-3)", letterSpacing: "0.1em" }}>INCOME</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "#34d399" }}>
              {visible ? `${cur} ${income.toFixed(2)}` : "••••"}
            </span>
          </div>
        )}
        <div style={TILE}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-3)", letterSpacing: "0.1em" }}>FIXED</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "#f87171" }}>
            {summary ? fmt(summary.fixed_total) : "—"}
          </span>
          {income > 0 && summary && visible && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-3)" }}>
              {(summary.fixed_total / income * 100).toFixed(0)}% of income
            </span>
          )}
        </div>
        <div style={TILE}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-3)", letterSpacing: "0.1em" }}>VARIABLE</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--cyan)" }}>
            {summary ? fmt(summary.variable_total) : "—"}
          </span>
          {income > 0 && summary && visible && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-3)" }}>
              {(summary.variable_total / income * 100).toFixed(0)}% of income
            </span>
          )}
        </div>
        {balance !== null && (
          <div style={TILE}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-3)", letterSpacing: "0.1em" }}>BALANCE</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: balance >= 0 ? "#34d399" : "var(--orange)" }}>
              {visible ? `${cur} ${balance.toFixed(2)}` : "••••"}
            </span>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <>
          <div style={SECTION}>Spending by Category</div>
          <div style={CARD}>
            {categories.map(([cat, amt], i) => (
              <div key={cat} style={{
                marginBottom: i < categories.length - 1 ? 10 : 0,
                paddingBottom: i < categories.length - 1 ? 10 : 0,
                borderBottom: i < categories.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>{cat}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: CAT_COLORS[i % CAT_COLORS.length] }}>
                    {visible ? `${cur} ${amt.toFixed(2)}` : "••••"}
                  </span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    background: CAT_COLORS[i % CAT_COLORS.length],
                    width: `${(amt / maxCat) * 100}%`,
                    opacity: visible ? 0.7 : 0,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recent variable expenses */}
      <div style={SECTION}>Recent Expenses</div>
      <div style={CARD}>
        {recentVar.length === 0
          ? <p style={{ color: "var(--text-3)", fontSize: 12 }}>No expenses this month</p>
          : recentVar.map((v, i) => (
            <div key={v._index} style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              paddingBottom: i < recentVar.length - 1 ? 8 : 0,
              marginBottom: i < recentVar.length - 1 ? 8 : 0,
              borderBottom: i < recentVar.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2 }}>{v.description}</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)" }}>
                  {v.category} · {v.date}
                </p>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--orange)", flexShrink: 0, marginLeft: 8 }}>
                {visible ? parseAmt(v.amount).toFixed(2) : "••••"}
              </span>
            </div>
          ))
        }
      </div>

      {/* Fixed expenses */}
      {fixed.length > 0 && (
        <>
          <div style={SECTION}>Fixed Expenses</div>
          <div style={CARD}>
            {fixed.map((f, i) => (
              <div key={f._index} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                paddingBottom: i < fixed.length - 1 ? 8 : 0,
                marginBottom: i < fixed.length - 1 ? 8 : 0,
                borderBottom: i < fixed.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <span style={{ fontSize: 11, color: "var(--text-2)" }}>{f.item}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#f87171", flexShrink: 0, marginLeft: 8 }}>
                  {visible ? `${parseFloat(f.cost).toFixed(2)}` : "••••"}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", letterSpacing: "0.08em" }}>TOTAL / MO</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#f87171" }}>
                {visible ? `${cur} ${fixed.reduce((s, f) => s + parseFloat(f.cost || "0"), 0).toFixed(2)}` : "••••"}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
