"use client";

import { useRouter } from "next/navigation";

interface MobileSettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

const SETTINGS_ITEMS = [
  { icon: "◈", bg: "rgba(34,211,238,0.08)",   color: "var(--cyan)",   label: "Friday's Memory" },
  { icon: "⬡", bg: "rgba(167,139,250,0.08)",  color: "var(--violet)", label: "Overview Widgets" },
  { icon: "◑", bg: "rgba(148,163,184,0.08)",  color: "var(--text-2)", label: "Appearance" },
] as const;

export default function MobileSettingsSheet({ open, onClose }: MobileSettingsSheetProps) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: "rgba(0,0,0,0.5)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s",
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          zIndex: 51,
          background: "rgba(9,13,28,0.97)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          borderTop: "1px solid rgba(34,211,238,0.18)",
          borderRadius: "22px 22px 0 0",
          padding: "12px 0 calc(24px + env(safe-area-inset-bottom))",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Drag pill */}
        <div style={{
          width: 36, height: 3, borderRadius: 2,
          background: "rgba(255,255,255,0.14)",
          margin: "0 auto 16px",
        }} />

        {/* Section label */}
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-3)",
          padding: "0 20px",
          marginBottom: 10,
        }}>
          Settings
        </div>

        {SETTINGS_ITEMS.map(item => (
          <div
            key={item.label}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: item.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, color: item.color, flexShrink: 0,
            }}>
              {item.icon}
            </div>
            <span style={{ fontFamily: "var(--font-space)", fontSize: 13, color: "var(--text-2)" }}>
              {item.label}
            </span>
            <span style={{ marginLeft: "auto", color: "var(--text-3)", fontSize: 14 }}>›</span>
          </div>
        ))}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            width: "100%",
            padding: "13px 20px",
            marginTop: 4,
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-space)", fontSize: 13, fontWeight: 600,
            color: "#f87171",
            textAlign: "left",
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(248,113,113,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, flexShrink: 0,
          }}>
            ⏻
          </div>
          Sign Out
        </button>
      </div>
    </>
  );
}
