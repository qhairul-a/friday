"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useFinanceVisibility } from "@/lib/finance-visibility";

interface Summary {
  month: string;
  fixed_total: number;
  variable_total: number;
  total: number;
  currency: string;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 8.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: 8,
};

export default function FinanceTab() {
  const { visible } = useFinanceVisibility();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ summaries: Summary[] }>("/finance/summary")
      .then(d => { setSummary(d.summaries?.[0] ?? null); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  function fmt(val: number): string {
    if (!visible) return "SGD ••••";
    return `SGD ${val.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (loading) return (
    <div style={{ padding: 16, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
  );
  if (error) return (
    <div style={{ padding: 16, color: "#f87171", fontFamily: "var(--font-mono)", fontSize: 11 }}>Error: {error}</div>
  );
  if (!summary) return (
    <div style={{ padding: 16, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>No data</div>
  );

  const rows: { label: string; value: string; color: string }[] = [
    { label: "Fixed Expenses",    value: fmt(summary.fixed_total),    color: "#f87171" },
    { label: "Variable Expenses", value: fmt(summary.variable_total), color: "var(--orange)" },
    { label: "Total Spent",       value: fmt(summary.total),          color: "var(--text-1)" },
  ];

  return (
    <div style={{ padding: "14px 14px 80px" }}>
      <div style={sectionLabel}>{fmtMonth(summary.month)}</div>
      <div style={{
        background: "rgba(251,191,36,0.04)",
        border: "1px solid rgba(251,191,36,0.1)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 10,
      }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            paddingBottom: i < rows.length - 1 ? 10 : 0,
            marginBottom: i < rows.length - 1 ? 10 : 0,
            borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
          }}>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>{r.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: r.color }}>
              {r.value}
            </span>
          </div>
        ))}
        {!visible && (
          <p style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", textAlign: "center", marginTop: 10 }}>
            tap 👁 to reveal
          </p>
        )}
      </div>
    </div>
  );
}
