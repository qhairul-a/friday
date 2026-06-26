"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LabelList,
} from "recharts";
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
interface VarExpense {
  _index: number; date: string; category: string;
  description: string; amount: string;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}
function fmtMonthShort(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]}-${y.slice(2)}`;
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
const AXIS  = { fill: "var(--text-3)", fontSize: 9, fontFamily: "var(--font-mono)" };
const GRID  = { strokeDasharray: "2 6", stroke: "rgba(34,211,238,0.06)" };
const TIP   = { background: "rgba(7,13,31,0.95)", border: "1px solid rgba(34,211,238,0.15)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10 };

export default function FinanceTab() {
  const { visible } = useFinanceVisibility();

  const [month,      setMonth]      = useState(new Date().toISOString().slice(0, 7));
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [variable,   setVariable]   = useState<VarExpense[]>([]);
  const [allVariable,setAllVariable]= useState<VarExpense[]>([]);
  const [income,     setIncome]     = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, v, av] = await Promise.all([
        apiFetch<Summary>(`/finance/summary?month=${month}`),
        apiFetch<VarExpense[]>(`/finance/variable?month=${month}`),
        apiFetch<VarExpense[]>("/finance/variable/all"),
      ]);
      setSummary(s); setVariable(v); setAllVariable(av);
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

  const balance = income > 0
    ? income - (summary?.fixed_total ?? 0) - (summary?.variable_total ?? 0)
    : null;
  const cur = summary?.currency ?? "SGD";

  // ── Category bar data (current month) ──────────────────────────────────────
  const categories = summary
    ? Object.entries(summary.by_category).sort((a, b) => b[1] - a[1])
    : [];
  const maxCat = categories[0]?.[1] ?? 1;

  // ── Pie data ────────────────────────────────────────────────────────────────
  const pieData = categories.map(([name, value]) => ({ name, value }));

  // ── Trend + frequency data (all-time) ──────────────────────────────────────
  const allMonths      = [...new Set(allVariable.map(v => v.date.slice(0, 7)))].sort();
  const allCategories  = [...new Set(allVariable.map(v => v.category))];

  const trendData = allMonths.map(m => {
    const row: Record<string, number | string> = { month: fmtMonthShort(m) };
    allCategories.forEach(cat => {
      row[cat] = allVariable
        .filter(v => v.date.startsWith(m) && v.category === cat)
        .reduce((s, v) => s + parseAmt(v.amount), 0);
    });
    return row;
  });

  const countData = allMonths.map(m => ({
    month: fmtMonthShort(m),
    count: allVariable.filter(v => v.date.startsWith(m)).length,
  }));

  const avgData = allMonths.map(m => {
    const entries = allVariable.filter(v => v.date.startsWith(m));
    const total   = entries.reduce((s, v) => s + parseAmt(v.amount), 0);
    return {
      month: fmtMonthShort(m),
      avg: entries.length ? Math.round((total / entries.length) * 100) / 100 : 0,
    };
  });

  const recentVar = [...variable].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <div style={{ padding: "14px 14px 80px" }}>

      {/* Month navigator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <button onClick={() => shiftMonth(-1)} style={{
          background: "none", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 6,
          color: "var(--text-2)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "3px 10px",
        }}>‹</button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cyan)", letterSpacing: "0.1em" }}>
          {fmtMonth(month)}
        </span>
        <button
          onClick={() => shiftMonth(1)}
          disabled={month >= new Date().toISOString().slice(0, 7)}
          style={{
            background: "none", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 6,
            color: "var(--text-2)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "3px 10px",
            opacity: month >= new Date().toISOString().slice(0, 7) ? 0.3 : 1,
          }}
        >›</button>
      </div>

      {/* ── Summary tiles ──────────────────────────────────────────────────── */}
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

      {/* ── Variable Expense Breakdown (pie) ───────────────────────────────── */}
      <div style={SECTION}>Variable Expense Breakdown</div>
      <div style={{ ...CARD, padding: "16px 14px" }}>
        {pieData.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>No variable expenses this month</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="44%"
                outerRadius={72} dataKey="value" nameKey="name"
                labelLine={false}
                label={({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }) => {
                  if (percent < 0.06) return null;
                  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                  const x = cx + r * Math.cos((-midAngle) * Math.PI / 180);
                  const y = cy + r * Math.sin((-midAngle) * Math.PI / 180);
                  return (
                    <text x={x} y={y} fill="white" textAnchor="middle"
                      dominantBaseline="central" fontSize={9} fontFamily="var(--font-mono)">
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
              >
                {pieData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={TIP}
                formatter={(v) => visible ? `${cur} ${(+(v ?? 0)).toFixed(2)}` : "••••"}
              />
              <Legend
                iconType="square" iconSize={8}
                wrapperStyle={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Category bar breakdown (current month) ─────────────────────────── */}
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

      {/* ── Spending Trend by Category (line) ──────────────────────────────── */}
      <div style={SECTION}>Spending Trend — by Category</div>
      <div style={{ ...CARD, padding: "16px 14px" }}>
        {trendData.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>Not enough data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                contentStyle={TIP}
                formatter={(v) => visible ? `${cur} ${(+(v ?? 0)).toFixed(2)}` : "••••"}
              />
              <Legend
                iconType="square" iconSize={8}
                wrapperStyle={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}
              />
              {allCategories.map((cat, i) => (
                <Line
                  key={cat} type="monotone" dataKey={cat}
                  stroke={CAT_COLORS[i % CAT_COLORS.length]}
                  strokeWidth={1.5} dot={false} activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Spending Frequency ─────────────────────────────────────────────── */}
      <div style={SECTION}>Spending Frequency</div>
      <div style={{ ...CARD, padding: "16px 14px" }}>
        {countData.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>Not enough data yet</p>
        ) : (
          <>
            {/* Entry count per month */}
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-3)", letterSpacing: "0.08em", marginBottom: 6 }}>
              ENTRIES / MONTH
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={countData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip contentStyle={TIP} />
                <Bar dataKey="count" fill="var(--cyan)" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="count" position="top"
                    style={{ fill: "var(--text-3)", fontSize: 8, fontFamily: "var(--font-mono)" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Avg amount per entry */}
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-3)", letterSpacing: "0.08em", marginTop: 12, marginBottom: 6 }}>
              AVG AMOUNT / ENTRY ({cur})
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={avgData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={TIP}
                  formatter={(v) => visible ? `${cur} ${(+(v ?? 0)).toFixed(2)}` : "••••"}
                />
                <Line
                  type="monotone" dataKey="avg"
                  stroke="var(--orange)" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* ── Recent Variable Expenses ────────────────────────────────────────── */}
      <div style={SECTION}>Recent Expenses</div>
      <div style={CARD}>
        {recentVar.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>No expenses this month</p>
        ) : recentVar.map((v, i) => (
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
        ))}
      </div>

      {/* ── Top 5 Spent (current month, derived from loaded variable data) ── */}
      {(() => {
        const top5 = [...variable]
          .filter(v => parseAmt(v.amount) > 0)
          .sort((a, b) => parseAmt(b.amount) - parseAmt(a.amount))
          .slice(0, 5);
        if (top5.length === 0) return null;
        return (
          <>
            <div style={SECTION}>Top 5 Spent — {fmtMonth(month)}</div>
            <div style={CARD}>
              {top5.map((v, i) => (
                <div key={v._index} style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  paddingBottom: i < top5.length - 1 ? 8 : 0,
                  marginBottom: i < top5.length - 1 ? 8 : 0,
                  borderBottom: i < top5.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", paddingTop: 2, width: 12, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                      <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.description}
                      </p>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--orange)", flexShrink: 0 }}>
                        {visible ? parseAmt(v.amount).toFixed(2) : "••••"}
                      </span>
                    </div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)" }}>
                      <span style={{ background: "rgba(34,211,238,0.1)", borderRadius: 3, padding: "1px 5px", color: "var(--cyan)", marginRight: 4 }}>{v.category}</span>
                      <span style={{ fontSize: 11, color: "var(--text-2)" }}>{v.date}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      })()}

    </div>
  );
}
