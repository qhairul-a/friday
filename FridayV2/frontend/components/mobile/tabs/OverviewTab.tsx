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

export default function OverviewTab() {
  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [events,         setEvents]         = useState<Event[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [weather,        setWeather]        = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  async function loadWeather(lat: number, lon: number) {
    setWeatherLoading(true);
    try {
      const w = await apiFetch<WeatherData>(`/weather?lat=${lat}&lon=${lon}`);
      setWeather(w);
    } catch { /* silent */ } finally {
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
    </div>
  );
}
