"use client";

import { useFinanceVisibility } from "@/lib/finance-visibility";

interface MobileHeaderProps {
  onSettingsPress: () => void;
  onHomePress: () => void;
}

function EyeOpen() {
  return (
    <svg width="18" height="13" viewBox="0 0 20 14" fill="none">
      <path d="M1 7C4 1.5 16 1.5 19 7C16 12.5 4 12.5 1 7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="10" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="10" cy="7" r="0.8" fill="currentColor"/>
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg width="18" height="13" viewBox="0 0 20 14" fill="none">
      <path d="M1 7C4 1.5 16 1.5 19 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="6.5" y1="6.5" x2="6" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="10" y1="6.8" x2="10" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="13.5" y1="6.5" x2="14" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

export default function MobileHeader({ onSettingsPress, onHomePress }: MobileHeaderProps) {
  const { visible, toggle } = useFinanceVisibility();

  return (
    <div style={{
      position: "absolute",
      top: 0, left: 0, right: 0,
      height: 56,
      zIndex: 30,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      paddingTop: "env(safe-area-inset-top)",
    }}>
      <button
        onClick={onHomePress}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: "4px 0",
          fontFamily: "var(--font-space)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(34,211,238,0.5)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        FRIDAY
      </button>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* Finance visibility toggle */}
        <button
          onClick={toggle}
          aria-label={visible ? "Hide finance figures" : "Show finance figures"}
          style={{
            width: 28, height: 28, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: visible ? "rgba(251,191,36,0.1)" : "rgba(71,85,105,0.2)",
            border: `1.5px solid ${visible ? "rgba(251,191,36,0.35)" : "rgba(71,85,105,0.35)"}`,
            color: visible ? "var(--orange)" : "var(--text-3)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {visible ? <EyeOpen /> : <EyeClosed />}
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsPress}
          aria-label="Open settings"
          style={{
            width: 28, height: 28, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(34,211,238,0.1)",
            border: "1.5px solid rgba(34,211,238,0.35)",
            color: "var(--cyan)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
