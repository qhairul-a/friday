"use client";

import FridayOrb from "@/components/FridayOrb";

export default function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid-bg"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-base)",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 35%, rgba(34,211,238,0.09) 0%, rgba(167,139,250,0.05) 30%, transparent 55%)",
        pointerEvents: "none",
      }} />

      {/* Orb — always centred, always mounted */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -58%)",
      }}>
        <FridayOrb state="disconnected" width={320} height={320} />
      </div>

      {/* Disconnected: Start Session */}
      <div style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}>
        <button
          style={{
            padding: "14px 40px",
            background: "linear-gradient(135deg, var(--cyan), var(--violet))",
            color: "var(--bg-base)",
            fontFamily: "var(--font-space)",
            fontWeight: 700,
            fontSize: 15,
            border: "none",
            borderRadius: 100,
            cursor: "pointer",
            boxShadow: "0 4px 24px rgba(34,211,238,0.25)",
          }}
        >
          Start Session
        </button>
      </div>
    </div>
  );
}
