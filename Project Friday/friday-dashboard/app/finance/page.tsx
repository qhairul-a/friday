"use client";

import { useEffect, useState } from "react";
import { supabase, USER_ID } from "@/lib/supabase";
import { FridayProfile } from "@/lib/types";
import PageShell from "../components/page-shell";
import FinanceNav from "../components/finance-nav";
import { useFinancePrivacy } from "@/hooks/useFinancePrivacy";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtAmount(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b] mb-4">{title}</h3>
      {children}
    </div>
  );
}

function BlurValue({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <span className={show ? "" : "blur-sm select-none pointer-events-none"}>
      {children}
    </span>
  );
}

function Row({
  label,
  value,
  accent,
  dim,
  show,
}: {
  label: string;
  value: string;
  accent?: boolean;
  dim?: boolean;
  show: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#0d1e30] last:border-0">
      <span className={`text-sm ${dim ? "text-[#364c61]" : "text-[#4a7a9b]"}`}>{label}</span>
      <span
        className={`text-sm font-mono font-medium ${accent ? "text-[#00d4ff]" : dim ? "text-[#364c61]" : "text-white"}`}
      >
        <BlurValue show={show}>{value}</BlurValue>
      </span>
    </div>
  );
}

const PIE_COLORS = [
  "#00ff88", // liabilities paid
  "#ef4444", // liabilities unpaid
  "#00d4ff",
  "#f59e0b",
  "#a78bfa",
  "#fb923c",
  "#34d399",
  "#f472b6",
  "#4a7a9b", // balance (last)
];

interface MonthData {
  month: string;
  total: number;
  count: number;
  avg: number;
  by_category: Record<string, number>;
}

interface SummaryData {
  current: MonthData;
  history: MonthData[];
}

function monthLabel(m: string) {
  return new Date(m + "-02").toLocaleString("default", { month: "short" });
}

function lastNMonths(n: number): string[] {
  const result: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function buildSummary(rows: { date: string; category: string; amount: number }[]): SummaryData {
  const months = lastNMonths(6);
  const byMonth: Record<string, { by_category: Record<string, number>; total: number; count: number }> = {};
  for (const m of months) byMonth[m] = { by_category: {}, total: 0, count: 0 };

  for (const row of rows) {
    const month = row.date.slice(0, 7);
    if (!byMonth[month]) continue;
    const amt = Number(row.amount) || 0;
    byMonth[month].by_category[row.category] =
      Math.round(((byMonth[month].by_category[row.category] ?? 0) + amt) * 100) / 100;
    byMonth[month].total += amt;
    byMonth[month].count++;
  }

  const history: MonthData[] = months.map((m) => {
    const d = byMonth[m];
    const total = Math.round(d.total * 100) / 100;
    return {
      month: m,
      total,
      count: d.count,
      avg: d.count > 0 ? Math.round((total / d.count) * 100) / 100 : 0,
      by_category: d.by_category,
    };
  });

  const current =
    history.find((h) => h.month === thisMonth()) ??
    { month: thisMonth(), total: 0, count: 0, avg: 0, by_category: {} };

  return { current, history };
}

function FinancePieChart({
  show,
  profile,
  summary,
}: {
  show: boolean;
  profile: FridayProfile;
  summary: SummaryData;
}) {
  const currency = profile.finance.currency || "SGD";
  const income = profile.finance.monthly_income ?? 0;
  const fixedExpenses = (profile.finance.liabilities_list ?? []).reduce(
    (s, l) => s + l.amount,
    0
  );

  const expenseEntries = Object.entries(summary.current.by_category);
  const totalExpenses = expenseEntries.reduce((s, [, v]) => s + v, 0);
  const balance = Math.max(0, income - fixedExpenses - totalExpenses);

  const data = [
    { name: "Fixed Expenses", value: fixedExpenses },
    ...expenseEntries.map(([name, value]) => ({ name, value })),
    { name: "Balance", value: balance },
  ].filter((d) => d.value > 0);

  const colors = [
    PIE_COLORS[0],
    ...expenseEntries.map((_, i) => PIE_COLORS[1 + (i % (PIE_COLORS.length - 2))]),
    PIE_COLORS[PIE_COLORS.length - 1],
  ];

  if (income === 0) {
    return (
      <div className="text-[#364c61] text-sm text-center py-8">
        Set your monthly income in Profile to see the breakdown.
      </div>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={105}
            dataKey="value"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const n = typeof value === "number" ? value : 0;
              const pct = income > 0 ? ((n / income) * 100).toFixed(1) : "0.0";
              const amount = show ? `${currency} ${fmtAmount(n)}` : "••••";
              return [`${amount} (${pct}%)`, name];
            }}
            contentStyle={{
              background: "#0a1628",
              border: "1px solid #1a3a5c",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#9ab" }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Breakdown list */}
      <div className="mt-2 flex flex-col gap-0.5">
        {data.map((item, i) => {
          const pct = income > 0 ? ((item.value / income) * 100).toFixed(1) : "0.0";
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[#060e1c] transition-colors"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }} />
              <span className="text-xs text-[#9ab] flex-1">{item.name}</span>
              <span className="text-xs font-mono text-white">
                <BlurValue show={show}>
                  {currency} {fmtAmount(item.value)}
                </BlurValue>
              </span>
              <span className="text-xs text-[#4a7a9b] w-12 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function FinanceTrendChart({
  show,
  summary,
  currency,
}: {
  show: boolean;
  summary: SummaryData;
  currency: string;
}) {
  const history = summary.history;
  const allCategories = Array.from(
    new Set(history.flatMap((m) => Object.keys(m.by_category)))
  );

  const chartData = history.map((m) => ({
    label: monthLabel(m.month),
    ...Object.fromEntries(allCategories.map((cat) => [cat, m.by_category[cat] ?? 0])),
  }));

  if (history.length < 2) {
    return (
      <div className="text-[#364c61] text-sm text-center py-6">
        Not enough history yet — check back next month.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
        <XAxis dataKey="label" tick={{ fill: "#4a7a9b", fontSize: 11 }} />
        <YAxis tick={{ fill: "#4a7a9b", fontSize: 11 }} width={48} />
        <Tooltip
          contentStyle={{
            background: "#0a1628",
            border: "1px solid #1a3a5c",
            borderRadius: 8,
            fontSize: 12,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any, name: any) => [
            show ? `${currency} ${fmtAmount(v as number)}` : "••••",
            name,
          ]}
        />
        <Legend formatter={(v) => <span style={{ color: "#9ab", fontSize: 11 }}>{v}</span>} />
        {allCategories.map((cat, i) => (
          <Line
            key={cat}
            type="monotone"
            dataKey={cat}
            stroke={PIE_COLORS[2 + (i % (PIE_COLORS.length - 3))]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function FinanceFrequencyChart({
  show,
  summary,
  currency,
}: {
  show: boolean;
  summary: SummaryData;
  currency: string;
}) {
  const history = summary.history;
  const chartData = history.map((m) => ({
    label: monthLabel(m.month),
    entries: m.count,
    avg: m.avg,
  }));

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Entries per month */}
      <div>
        <p className="text-[11px] text-[#4a7a9b] mb-3">Entries per month</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
            <XAxis dataKey="label" tick={{ fill: "#4a7a9b", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#4a7a9b", fontSize: 11 }} width={32} />
            <Tooltip
              contentStyle={{ background: "#0a1628", border: "1px solid #1a3a5c", borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [`${v} entries`, "Count"]}
            />
            <Bar dataKey="entries" fill="#00d4ff" radius={[4, 4, 0, 0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Avg amount per entry */}
      <div>
        <p className="text-[11px] text-[#4a7a9b] mb-3">Avg amount per entry</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
            <XAxis dataKey="label" tick={{ fill: "#4a7a9b", fontSize: 11 }} />
            <YAxis tick={{ fill: "#4a7a9b", fontSize: 11 }} width={48} />
            <Tooltip
              contentStyle={{ background: "#0a1628", border: "1px solid #1a3a5c", borderRadius: 8, fontSize: 12 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [
                show ? `${currency} ${fmtAmount(v as number)}` : "••••",
                "Avg / entry",
              ]}
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface SavingsMonthData {
  month: string;
  total: number;
  by_category: Record<string, number>;
}

const SAVINGS_COLORS: Record<string, string> = {
  "Emergency Fund": "#00ff88",
  Investment: "#a78bfa",
  Retirement: "#f472b6",
  Travel: "#f59e0b",
  Education: "#00d4ff",
  General: "#fb923c",
};

function SavingsTrendChart({ show, history, currency }: {
  show: boolean;
  history: SavingsMonthData[];
  currency: string;
}) {
  const allCategories = Array.from(new Set(history.flatMap((m) => Object.keys(m.by_category))));
  const chartData = history.map((m) => ({
    label: monthLabel(m.month),
    ...Object.fromEntries(allCategories.map((cat) => [cat, m.by_category[cat] ?? 0])),
  }));
  const totalThisMonth = history.find((m) => m.month === thisMonth())?.total ?? 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] text-[#4a7a9b]">Monthly savings by category</span>
        <span className="text-[11px] text-[#9ab]">
          This month:{" "}
          <span className={show ? "text-[#00ff88] font-mono" : "blur-sm select-none pointer-events-none"}>
            {currency} {fmtAmount(totalThisMonth)}
          </span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" />
          <XAxis dataKey="label" tick={{ fill: "#4a7a9b", fontSize: 11 }} />
          <YAxis tick={{ fill: "#4a7a9b", fontSize: 11 }} width={48} />
          <Tooltip
            contentStyle={{ background: "#0a1628", border: "1px solid #1a3a5c", borderRadius: 8, fontSize: 12 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any, name: any) => [
              show ? `${currency} ${fmtAmount(v as number)}` : "••••",
              name,
            ]}
          />
          <Legend formatter={(v) => <span style={{ color: "#9ab", fontSize: 11 }}>{v}</span>} />
          {allCategories.map((cat) => (
            <Bar key={cat} dataKey={cat} stackId="a" fill={SAVINGS_COLORS[cat] ?? "#4a7a9b"} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FinancePage() {
  const [profile, setProfile] = useState<FridayProfile | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [savingsHistory, setSavingsHistory] = useState<SavingsMonthData[] | null>(null);
  const [savingsAccumulated, setSavingsAccumulated] = useState<{ total: number; by_category: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const { show, toggle } = useFinancePrivacy();

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

  useEffect(() => {
    const sixMonthsAgo = lastNMonths(6)[0] + "-01";

    function fetchExpenses() {
      supabase
        .from("expenses")
        .select("date,category,amount")
        .eq("user_id", USER_ID)
        .gte("date", sixMonthsAgo)
        .order("date")
        .then(({ data, error }) => {
          if (error) {
            console.error("[Finance] expenses fetch error:", error);
            setSummaryLoading(false);
            return;
          }
          const rows = (data ?? []).map((r) => ({
            date: r.date as string,
            category: r.category as string,
            amount: Number(r.amount),
          }));
          setSummary(buildSummary(rows));
          setSummaryLoading(false);
        });
    }

    fetchExpenses();

    const channel = supabase
      .channel("expenses_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${USER_ID}` }, fetchExpenses)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function fetchSavings() {
      supabase
        .from("savings")
        .select("date,category,amount")
        .eq("user_id", USER_ID)
        .order("date")
        .then(({ data }) => {
          const allRows = data ?? [];

          // Accumulated totals (all time)
          const accByCat: Record<string, number> = {};
          let accTotal = 0;
          for (const row of allRows) {
            const amt = Number(row.amount) || 0;
            const cat = row.category as string;
            accByCat[cat] = Math.round(((accByCat[cat] ?? 0) + amt) * 100) / 100;
            accTotal = Math.round((accTotal + amt) * 100) / 100;
          }
          setSavingsAccumulated({ total: accTotal, by_category: accByCat });

          // Last 6 months for the chart
          const months = lastNMonths(6);
          const byMonth: Record<string, { by_category: Record<string, number>; total: number }> = {};
          for (const m of months) byMonth[m] = { by_category: {}, total: 0 };
          for (const row of allRows) {
            const month = (row.date as string).slice(0, 7);
            if (!byMonth[month]) continue;
            const amt = Number(row.amount) || 0;
            const cat = row.category as string;
            byMonth[month].by_category[cat] =
              Math.round(((byMonth[month].by_category[cat] ?? 0) + amt) * 100) / 100;
            byMonth[month].total = Math.round((byMonth[month].total + amt) * 100) / 100;
          }
          setSavingsHistory(months.map((m) => ({ month: m, ...byMonth[m] })));
        });
    }

    fetchSavings();
    const ch = supabase
      .channel("savings_overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "savings", filter: `user_id=eq.${USER_ID}` }, fetchSavings)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageShell activeTab="/finance" sidebarContent={<FinanceNav />}>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Finance</h1>
            <p className="text-[#4a7a9b] text-sm mt-1">Budget overview · Ask Friday for live spend data</p>
          </div>
          <button
            onClick={toggle}
            className="mt-1 text-[#4a7a9b] hover:text-[#00d4ff] transition-colors text-xl leading-none"
            title={show ? "Hide figures" : "Show figures"}
          >
            {show ? "👁" : "🙈"}
          </button>
        </div>

        {loading ? (
          <p className="text-[#4a7a9b] text-sm">Loading…</p>
        ) : !profile ? (
          <p className="text-[#4a7a9b] text-sm">No profile found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {/* Monthly Overview */}
            <Section title="Monthly Overview">
              {(() => {
                const income = profile.finance.monthly_income ?? 0;
                const cur = profile.finance.currency;
                const fixedExpense = (profile.finance.liabilities_list ?? []).reduce(
                  (s, l) => s + l.amount,
                  0
                );
                const variableExpense = summary?.current?.total ?? 0;
                const balance = income - fixedExpense - variableExpense;
                const month = thisMonth();
                const paidLiabilities = (profile.finance.liabilities_list ?? [])
                  .filter((l) => l.paid_month === month)
                  .reduce((s, l) => s + l.amount, 0);
                const paidPct = fixedExpense > 0 ? Math.round((paidLiabilities / fixedExpense) * 100) : 0;
                return (
                  <>
                    <Row show={show} label="Monthly Income" value={`${cur} ${income.toLocaleString()}`} accent />
                    <div className="flex items-center gap-3 py-2 border-b border-[#0d1e30]">
                      <span className="text-sm text-[#4a7a9b] shrink-0">Fixed Expense</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#060e1c] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.min(paidPct, 100)}%`,
                              background:
                                paidPct === 100
                                  ? "#00ff88"
                                  : paidPct > 50
                                  ? "linear-gradient(90deg,#00d4ff,#007a99)"
                                  : "#f59e0b",
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[#4a7a9b] shrink-0">
                          <BlurValue show={show}>{paidPct}%</BlurValue>
                        </span>
                      </div>
                      <span className="text-sm font-mono font-medium text-white shrink-0">
                        <BlurValue show={show}>{cur} {fixedExpense.toLocaleString()}</BlurValue>
                      </span>
                    </div>
                    <Row
                      show={show}
                      label={`Variable Expense${summaryLoading ? " (loading…)" : ""}`}
                      value={summaryLoading ? "—" : `${cur} ${variableExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                    <Row
                      show={show}
                      label="Balance"
                      value={`${cur} ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      accent
                    />
                  </>
                );
              })()}
            </Section>

            {/* Savings goals */}
            {(profile.finance.savings_goals ?? []).length > 0 && (
              <Section title="Savings Goals">
                <div className="flex flex-col gap-2">
                  {profile.finance.savings_goals.map((g, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-[#0d1e30] last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] mt-1.5 shrink-0" />
                      <span className="text-sm text-white">{g}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Spending Breakdown */}
            <Section title="Spending Breakdown">
              {summaryLoading ? (
                <div className="text-[#4a7a9b] text-sm text-center py-8">Loading chart…</div>
              ) : summary?.current ? (
                <FinancePieChart show={show} profile={profile} summary={summary} />
              ) : (
                <div className="text-[#364c61] text-sm text-center py-8">
                  Could not load spending data.
                </div>
              )}
            </Section>

            {/* Monthly Trends */}
            <Section title="Monthly Trends">
              {summaryLoading ? (
                <div className="text-[#4a7a9b] text-sm text-center py-6">Loading…</div>
              ) : summary ? (
                <FinanceTrendChart show={show} summary={summary} currency={profile.finance.currency || "SGD"} />
              ) : (
                <div className="text-[#364c61] text-sm text-center py-6">No data available.</div>
              )}
            </Section>

            {/* Spending Frequency */}
            <Section title="Spending Frequency">
              {summaryLoading ? (
                <div className="text-[#4a7a9b] text-sm text-center py-6">Loading…</div>
              ) : summary ? (
                <FinanceFrequencyChart show={show} summary={summary} currency={profile.finance.currency || "SGD"} />
              ) : (
                <div className="text-[#364c61] text-sm text-center py-6">No data available.</div>
              )}
            </Section>

            {/* Savings Trend */}
            <Section title="Savings Trend">
              {savingsHistory ? (
                savingsHistory.every((m) => m.total === 0) && !savingsAccumulated?.total ? (
                  <div className="text-[#364c61] text-sm text-center py-6">
                    No savings recorded yet — add entries in the Savings page.
                  </div>
                ) : (
                  <>
                    {!savingsHistory.every((m) => m.total === 0) && (
                      <SavingsTrendChart show={show} history={savingsHistory} currency={profile.finance.currency || "SGD"} />
                    )}
                    {savingsAccumulated && savingsAccumulated.total > 0 && (
                      <div className={`${!savingsHistory.every((m) => m.total === 0) ? "mt-5 pt-5 border-t border-[#0d1e30]" : ""}`}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b] mb-3">Accumulated Savings</p>
                        <div className="flex items-center justify-between mb-3 px-1">
                          <span className="text-sm text-[#9ab]">Total</span>
                          <span className={`text-lg font-mono font-bold text-[#00ff88] ${show ? "" : "blur-sm select-none pointer-events-none"}`}>
                            {profile.finance.currency || "SGD"} {fmtAmount(savingsAccumulated.total)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {Object.entries(savingsAccumulated.by_category)
                            .sort(([, a], [, b]) => b - a)
                            .map(([cat, amt]) => (
                              <div key={cat} className="flex items-center gap-3 px-1">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SAVINGS_COLORS[cat] ?? "#4a7a9b" }} />
                                <span className="text-xs text-[#9ab] flex-1">{cat}</span>
                                <span className={`text-xs font-mono text-white ${show ? "" : "blur-sm select-none pointer-events-none"}`}>
                                  {profile.finance.currency || "SGD"} {fmtAmount(amt)}
                                </span>
                                <span className="text-[10px] text-[#4a7a9b] w-10 text-right">
                                  {savingsAccumulated.total > 0 ? ((amt / savingsAccumulated.total) * 100).toFixed(0) : 0}%
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              ) : (
                <div className="text-[#4a7a9b] text-sm text-center py-6">Loading…</div>
              )}
            </Section>
          </div>
        )}
      </div>
    </PageShell>
  );
}
