"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/overview");
    } else {
      setError("Access denied. Invalid passcode.");
    }
  }

  return (
    <div
      className="grid-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        padding: 24,
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "fixed",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600,
        height: 600,
        background: "radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        {/* Card */}
        <div className="glass glow-cyan" style={{ padding: "48px 40px" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="label-cyan" style={{ marginBottom: 12 }}>
              ◈ Secure Access
            </div>
            <h1 style={{
              fontFamily: "var(--font-space)",
              fontSize: 32,
              fontWeight: 700,
              color: "var(--text-1)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              marginBottom: 12,
            }}>
              Initialize Session
            </h1>
            <p style={{ color: "var(--text-3)", fontSize: 13, lineHeight: 1.6 }}>
              Verify identity to resume operations with FRIDAY
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Passcode</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your passcode"
                className="cyber-input"
                autoFocus
              />
            </div>

            {error && (
              <div style={{
                padding: "10px 14px",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 10,
                color: "#f87171",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary"
              style={{ width: "100%", marginTop: 8, padding: "14px 24px", fontSize: 15 }}
            >
              {loading ? "Authenticating…" : "INITIATE →"}
            </button>
          </form>

          {/* Footer */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
          }}>
            <span className="label">V2.0 · Friday OS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
