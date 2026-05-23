"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const WEATHER_ICON: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  80: "🌦️", 81: "🌧️", 82: "🌧️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

const WEATHER_LABEL: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
  80: "Light showers", 81: "Showers", 82: "Heavy showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

interface WeatherData { temp: number; feelsLike: number; code: number; }

const NAV_LINKS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/routine", label: "Routine" },
  { href: "/goals", label: "Goals" },
  { href: "/notes", label: "Notes" },
  { href: "/finance", label: "Finance" },
  { href: "/profile", label: "Profile" },
  { href: "/onboarding", label: "⚙", title: "Settings" },
];

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export default function DashboardHeader({ activeTab }: { activeTab?: string }) {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=1.3521&longitude=103.8198&current=temperature_2m,weathercode,apparent_temperature")
      .then(r => r.json())
      .then(d => setWeather({ temp: Math.round(d.current.temperature_2m), feelsLike: Math.round(d.current.apparent_temperature), code: d.current.weathercode }))
      .catch(() => {});
  }, []);

  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <header className="hidden md:flex h-16 border-b border-[#1a3a5c] items-center px-6 shrink-0 bg-[#07101f]">
      {/* Left — branding */}
      <div className="flex items-center gap-3 w-64 shrink-0">
        <Link href="/" className="text-base font-bold tracking-[0.25em] text-[#00d4ff] hover:text-white transition-colors">
          F.R.I.D.A.Y
        </Link>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#00ff88] border border-[#00ff88]/30 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
          Online
        </span>
      </div>

      {/* Center — clock + date + weather */}
      <div className="flex-1 flex justify-center">
        <div className="text-center select-none">
          <div className="text-xl font-mono font-bold text-white tracking-widest" suppressHydrationWarning>{time}</div>
          <div className="text-[11px] text-[#5b9bd5] mt-0.5" suppressHydrationWarning>{date}</div>
          {weather && (
            <div className="text-[10px] text-[#4a7a9b] mt-0.5 flex items-center justify-center gap-1.5">
              <span>{WEATHER_ICON[weather.code] ?? "🌡️"}</span>
              <span>{weather.temp}°C · {WEATHER_LABEL[weather.code] ?? "Singapore"}</span>
              <span className="text-[#364c61]">· Feels {weather.feelsLike}°C</span>
            </div>
          )}
        </div>
      </div>

      {/* Right — nav */}
      <nav className="w-64 shrink-0 flex justify-end items-center gap-5">
        {NAV_LINKS.map(({ href, label, title }) => (
          <Link
            key={href}
            href={href}
            title={title}
            className={`text-[11px] uppercase tracking-wider transition-colors ${
              activeTab === href
                ? "text-[#00d4ff] font-semibold"
                : "text-[#4a7a9b] hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="text-[11px] uppercase tracking-wider text-[#4a7a9b] hover:text-red-400 transition-colors"
          title="Sign out"
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
