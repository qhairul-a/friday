"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        sessionStorage.setItem("friday_alive", "1");
        router.push("/");
      } else {
        const data = await res.json();
        setError(data.error ?? "Invalid password.");
        setPassword("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050b14] flex items-center justify-center px-4">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#00d4ff 1px, transparent 1px), linear-gradient(90deg, #00d4ff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-[0.4em] text-[#00d4ff]">
            F.R.I.D.A.Y
          </h1>
          <p className="text-[#4a7a9b] text-sm mt-2 tracking-wide">
            Fully Responsive Intelligent Digital Assistant for You
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
            <span className="text-[10px] text-[#4a7a9b] uppercase tracking-widest">
              Secure Access
            </span>
          </div>
        </div>

        {/* Login card */}
        <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b] mb-2">
                Password
              </label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                className="w-full bg-[#060e1c] border border-[#1a3a5c] rounded-lg px-4 py-3 text-sm text-white placeholder-[#2a4a6b] focus:outline-none focus:border-[#00d4ff]/50 focus:ring-1 focus:ring-[#00d4ff]/20 transition-all disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <span>⚠</span> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-3 rounded-lg text-sm font-semibold tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: loading
                  ? "rgba(0,212,255,0.05)"
                  : "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.3)",
                color: "#00d4ff",
              }}
              onMouseEnter={(e) => {
                if (!loading)
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(0,212,255,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = loading
                  ? "rgba(0,212,255,0.05)"
                  : "rgba(0,212,255,0.08)";
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
                  Authenticating…
                </span>
              ) : (
                "Initiate"
              )}
            </button>
          </form>
        </div>


      </div>

      {/* Bottom credit */}
      <p className="absolute bottom-5 left-0 right-0 text-center text-[10px] text-[#2a4a6b] tracking-widest uppercase">
        Powered by Qentico
      </p>
    </div>
  );
}
