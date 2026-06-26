"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Task  { id: string; title: string; status: string }
interface Event { id: string; title: string; start: string }
interface WeatherData {
  city: string; country: string;
  temp: number; feels_like: number; temp_min: number; temp_max: number;
  description: string; icon: string;
  humidity: number; wind_speed: number; wind_dir: string;
  visibility: number; clouds: number; pressure: number;
  sunrise: string; sunset: string;
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(34,211,238,0.07)",
  borderRadius: 12,
  padding: "12px 14px",
  marginBottom: 10,
};
const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 8.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-3)",
  marginBottom: 8,
};
const row: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  paddingBottom: 8,
  marginBottom: 8,
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

interface VarExpense { date: string; category: string; description: string; amount: string }

export default function OverviewTab() {
  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [events,         setEvents]         = useState<Event[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [weather,        setWeather]        = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError,   setWeatherError]   = useState<string | null>(null);
  const [top5Month,      setTop5Month]      = useState(new Date().toISOString().slice(0, 7));
  const [top5Expenses,   setTop5Expenses]   = useState<VarExpense[]>([]);

  async function loadWeather(lat: number, lon: number) {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const w = await apiFetch<WeatherData>(`/weather?lat=${lat}&lon=${lon}`);
      setWeather(w);
    } catch (e) {
      setWeatherError(e instanceof Error ? e.message : "Failed to load weather");
    } finally {
      setWeatherLoading(false);
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) { loadWeather(1.3521, 103.8198); return; }
    navigator.geolocation.getCurrentPosition(
      pos => loadWeather(pos.coords.latitude, pos.coords.longitude),
      ()  => loadWeather(1.3521, 103.8198),
    );
  }

  useEffect(() => {
    requestLocation();
    Promise.all([
      apiFetch<Task[]>("/tasks").catch(() => [] as Task[]),
      apiFetch<Event[]>("/calendar?days=1").catch(() => [] as Event[]),
    ]).then(([t, e]) => {
      setTasks(t.filter(x => x.status !== "completed").slice(0, 5));
      setEvents(e.slice(0, 3));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    apiFetch<VarExpense[]>(`/finance/variable?month=${top5Month}`)
      .then(v => {
        const sorted = [...v]
          .filter(x => !isNaN(parseFloat(String(x.amount).replace(/[$,]/g, ""))))
          .sort((a, b) =>
            parseFloat(String(b.amount).replace(/[$,]/g, "")) -
            parseFloat(String(a.amount).replace(/[$,]/g, ""))
          )
          .slice(0, 5);
        setTop5Expenses(sorted);
      })
      .catch(() => setTop5Expenses([]));
  }, [top5Month]);

  if (loading) return (
    <div style={{ padding: 16, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
  );

  return (
    <div style={{ padding: "14px 14px 80px" }}>

      {/* ── Weather ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...sectionLabel }}>
        <span>Weather</span>
        <button
          onClick={requestLocation}
          disabled={weatherLoading}
          style={{
            background: "none", border: "none", cursor: weatherLoading ? "default" : "pointer",
            color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
            padding: 0, opacity: weatherLoading ? 0.5 : 1,
          }}
        >
          {weatherLoading ? "…" : "◎ Locate"}
        </button>
      </div>
      <div style={card}>
        {weatherLoading && !weather ? (
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>Detecting location…</p>
        ) : weatherError ? (
          <p style={{ color: "#f97316", fontSize: 11, fontFamily: "var(--font-mono)" }}>
            Error: {weatherError}
          </p>
        ) : !weather ? (
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>Tap Locate to load weather</p>
        ) : (
          <>
            {/* Top row: icon + temp + city */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 32, lineHeight: 1 }}>{weather.icon}</span>
              <div>
                <div style={{ fontSize: 26, fontWeight: 600, color: "var(--text-1)", lineHeight: 1 }}>
                  {weather.temp}°C
                </div>
                <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                  {weather.city}, {weather.country}
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--text-2)" }}>{weather.description}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                  H:{weather.temp_max}° L:{weather.temp_min}°
                </div>
                <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                  Feels {weather.feels_like}°
                </div>
              </div>
            </div>

            {/* Data grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 10px",
              borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8,
            }}>
              {[
                ["💧", `${weather.humidity}%`, "Humidity"],
                ["💨", `${weather.wind_speed} km/h ${weather.wind_dir}`, "Wind"],
                ["👁", `${weather.visibility} km`, "Visibility"],
                ["☁️", `${weather.clouds}%`, "Clouds"],
                ["🔼", `${weather.pressure} hPa`, "Pressure"],
                ["🌅", weather.sunrise, "Sunrise"],
                ["🌇", weather.sunset, "Sunset"],
              ].map(([icon, val, label]) => (
                <div key={label as string} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <span style={{ fontSize: 11 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-2)" }}>{val}</div>
                    <div style={{ fontSize: 9, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={sectionLabel}>Open Tasks</div>
      <div style={card}>
        {tasks.length === 0
          ? <p style={{ color: "var(--text-3)", fontSize: 12 }}>No open tasks</p>
          : tasks.map(t => (
              <div key={t.id} style={row}>
                <span style={{ color: "var(--cyan)", fontSize: 11, marginTop: 1 }}>○</span>
                <span style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4 }}>{t.title}</span>
              </div>
            ))
        }
      </div>

      <div style={sectionLabel}>Today</div>
      <div style={card}>
        {events.length === 0
          ? <p style={{ color: "var(--text-3)", fontSize: 12 }}>No events today</p>
          : events.map(e => (
              <div key={e.id} style={row}>
                <span style={{ color: "var(--violet)", fontSize: 11, marginTop: 1 }}>◷</span>
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-1)", marginBottom: 2 }}>{e.title}</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{e.start}</p>
                </div>
              </div>
            ))
        }
      </div>

      {/* ── Top 5 Spent ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...sectionLabel }}>
        <span>Top 5 Spent</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setTop5Month(prev => {
              const [y, m] = prev.split("-").map(Number);
              const d = new Date(y, m - 2, 1);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            })}
            style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
          >‹</button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--cyan)", letterSpacing: "0.08em" }}>
            {(() => {
              const [y, m] = top5Month.split("-");
              const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              return `${mn[parseInt(m) - 1]} ${y}`;
            })()}
          </span>
          <button
            onClick={() => setTop5Month(prev => {
              const [y, m] = prev.split("-").map(Number);
              const d = new Date(y, m, 1);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            })}
            style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
          >›</button>
        </div>
      </div>
      <div style={card}>
        {top5Expenses.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 12 }}>No expenses this month.</p>
        ) : top5Expenses.map((exp, i) => {
          const amt = parseFloat(String(exp.amount).replace(/[$,]/g, ""));
          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              paddingBottom: i < top5Expenses.length - 1 ? 8 : 0,
              marginBottom: i < top5Expenses.length - 1 ? 8 : 0,
              borderBottom: i < top5Expenses.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", paddingTop: 2, width: 12, flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <p style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {exp.description || "—"}
                  </p>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "#fb923c", flexShrink: 0 }}>
                    {isNaN(amt) ? "—" : amt.toFixed(2)}
                  </span>
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)" }}>
                  <span style={{ background: "rgba(34,211,238,0.1)", borderRadius: 3, padding: "1px 5px", color: "var(--cyan)", marginRight: 4 }}>{exp.category}</span>
                  {exp.date}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
