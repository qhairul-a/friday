"use client";

import { useState } from "react";

// ── shared design tokens ──────────────────────────────────────────────────────
const BG        = "#070d1f";
const CYAN      = "#22d3ee";
const VIOLET    = "#a78bfa";
const TEXT1     = "#e2e8f0";
const TEXT3     = "#475569";
const GLASS     = "rgba(255,255,255,0.025)";
const BORDER    = "rgba(34,211,238,0.1)";

const TABS = [
  { id: "overview", label: "Overview", icon: "⬡" },
  { id: "plans",    label: "Plans",    icon: "◷" },
  { id: "finance",  label: "Finance",  icon: "◈" },
  { id: "notes",    label: "Notes",    icon: "◱" },
] as const;

// ── Orb placeholder ───────────────────────────────────────────────────────────
function Orb({ size = 120 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle at 38% 36%, ${CYAN}22 0%, ${VIOLET}18 40%, transparent 65%)`,
      border: `1.5px solid ${CYAN}44`,
      boxShadow: `0 0 ${size * 0.3}px ${CYAN}18, inset 0 0 ${size * 0.2}px ${VIOLET}12`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <div style={{
        width: size * 0.35, height: size * 0.35, borderRadius: "50%",
        background: `radial-gradient(circle, ${CYAN}55, transparent 70%)`,
        opacity: 0.7,
      }} />
    </div>
  );
}

// ── Fake content for active tabs ──────────────────────────────────────────────
function TabContent({ tab }: { tab: string }) {
  const items: Record<string, { label: string; val: string }[]> = {
    overview: [
      { label: "○  Buy groceries", val: "" },
      { label: "○  Call dentist", val: "" },
      { label: "◷  Team standup", val: "10:00" },
      { label: "◷  Lunch w/ Rina", val: "13:00" },
    ],
    plans: [
      { label: "✓  Morning run",     val: "06:30" },
      { label: "✓  Journaling",      val: "07:00" },
      { label: "○  Evening stretch", val: "20:00" },
      { label: "○  Read 30 min",     val: "21:30" },
    ],
    finance: [
      { label: "Fixed total",    val: "SGD 1,840" },
      { label: "Variable (Jun)", val: "SGD 612" },
      { label: "Total spend",    val: "SGD 2,452" },
    ],
    notes: [
      { label: "Project ideas — AI tools", val: "Jun 7" },
      { label: "Weekly review notes",      val: "Jun 5" },
      { label: "Reading list",             val: "Jun 3" },
    ],
  };
  const rows = items[tab] ?? [];
  return (
    <div style={{ padding: "12px 14px", overflowY: "auto", flex: 1 }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between",
          padding: "9px 12px",
          marginBottom: 6,
          background: GLASS,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          fontSize: 11,
          color: TEXT1,
        }}>
          <span>{r.label}</span>
          {r.val && <span style={{ color: CYAN, fontFamily: "monospace", fontSize: 10 }}>{r.val}</span>}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPTION A — Top tab bar (current implementation)
// ═══════════════════════════════════════════════════════════════════════════════
function OptionA() {
  const [active, setActive] = useState<string | null>(null);
  const HEADER = 44, TABS_H = 40;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: BG, overflow: "hidden" }}>
      {/* ambient */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 30%, rgba(34,211,238,0.08) 0%, transparent 55%)" }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: HEADER, zIndex: 20,
        background: "rgba(8,12,28,0.95)", borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
      }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.15em", color: CYAN }}>FRIDAY</span>
        <span style={{ color: TEXT3, fontSize: 14 }}>⚙</span>
      </div>

      {/* Tab bar — top */}
      <nav style={{
        position: "absolute", top: HEADER, left: 0, right: 0, height: TABS_H, zIndex: 20,
        background: "rgba(8,12,28,0.92)", borderBottom: `1px solid ${BORDER}`,
        display: "flex",
      }}>
        {TABS.map(t => {
          const on = active === t.id;
          return (
            <button key={t.id} onClick={() => setActive(on ? null : t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 2,
              background: "none", border: "none",
              borderBottom: `2px solid ${on ? CYAN : "transparent"}`,
              color: on ? CYAN : TEXT3, cursor: "pointer",
            }}>
              <span style={{ fontSize: 13, opacity: on ? 1 : 0.5 }}>{t.icon}</span>
              <span style={{ fontSize: 7, fontFamily: "monospace", letterSpacing: "0.05em" }}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div style={{
        position: "absolute", top: HEADER + TABS_H, bottom: 0, left: 0, right: 0,
        display: "flex", flexDirection: "column",
        overflowY: active ? "auto" : "hidden",
      }}>
        {active
          ? <TabContent tab={active} />
          : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <Orb size={110} />
              <button style={{
                padding: "10px 28px", borderRadius: 100,
                background: `linear-gradient(135deg, ${CYAN}, ${VIOLET})`,
                color: BG, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                fontFamily: "monospace",
              }}>Start Session</button>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPTION B — Bottom tab bar (mobile-native)
// ═══════════════════════════════════════════════════════════════════════════════
function OptionB() {
  const [active, setActive] = useState<string | null>(null);
  const HEADER = 44, TABS_H = 52;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: BG, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 40%, rgba(34,211,238,0.08) 0%, transparent 55%)" }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: HEADER, zIndex: 20,
        background: "rgba(8,12,28,0.95)", borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
      }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.15em", color: CYAN }}>FRIDAY</span>
        <span style={{ color: TEXT3, fontSize: 14 }}>⚙</span>
      </div>

      {/* Content */}
      <div style={{
        position: "absolute", top: HEADER, bottom: TABS_H, left: 0, right: 0,
        display: "flex", flexDirection: "column",
        overflowY: active ? "auto" : "hidden",
      }}>
        {active
          ? <TabContent tab={active} />
          : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <Orb size={120} />
              <button style={{
                padding: "10px 28px", borderRadius: 100,
                background: `linear-gradient(135deg, ${CYAN}, ${VIOLET})`,
                color: BG, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                fontFamily: "monospace",
              }}>Start Session</button>
            </div>
          )
        }
      </div>

      {/* Bottom tab bar */}
      <nav style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: TABS_H, zIndex: 20,
        background: "rgba(8,12,28,0.97)",
        borderTop: `1px solid ${BORDER}`,
        display: "flex", alignItems: "stretch",
      }}>
        {TABS.map(t => {
          const on = active === t.id;
          return (
            <button key={t.id} onClick={() => setActive(on ? null : t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              background: "none", border: "none",
              borderTop: `2px solid ${on ? CYAN : "transparent"}`,
              color: on ? CYAN : TEXT3, cursor: "pointer",
              transition: "color 0.15s",
            }}>
              <span style={{ fontSize: 15, opacity: on ? 1 : 0.45 }}>{t.icon}</span>
              <span style={{ fontSize: 7.5, fontFamily: "monospace", letterSpacing: "0.05em" }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPTION C — Bottom bar with centred session orb button
// ═══════════════════════════════════════════════════════════════════════════════
function OptionC() {
  const [active, setActive]       = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const HEADER = 44, TABS_H = 60;

  const left  = TABS.slice(0, 2);
  const right = TABS.slice(3);
  const mid   = TABS[2];  // Finance — replaced by orb button in centre

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: BG, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 40%, rgba(34,211,238,0.08) 0%, transparent 55%)" }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: HEADER, zIndex: 20,
        background: "rgba(8,12,28,0.95)", borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
      }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.15em", color: CYAN }}>FRIDAY</span>
        <span style={{ color: TEXT3, fontSize: 14 }}>⚙</span>
      </div>

      {/* Content */}
      <div style={{
        position: "absolute", top: HEADER, bottom: TABS_H, left: 0, right: 0,
        display: "flex", flexDirection: "column",
        overflowY: active ? "auto" : "hidden",
      }}>
        {active
          ? <TabContent tab={active} />
          : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <Orb size={120} />
              <span style={{
                fontFamily: "monospace", fontSize: 9, letterSpacing: "0.12em",
                color: connected ? CYAN : TEXT3, textTransform: "uppercase",
              }}>
                {connected ? "● Connected" : "Tap ◎ to start"}
              </span>
            </div>
          )
        }
      </div>

      {/* Bottom tab bar with centre orb button */}
      <nav style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: TABS_H, zIndex: 20,
        background: "rgba(8,12,28,0.97)",
        borderTop: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center",
      }}>
        {/* Left 2 tabs */}
        {left.map(t => {
          const on = active === t.id;
          return (
            <button key={t.id} onClick={() => setActive(on ? null : t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3, height: "100%",
              background: "none", border: "none",
              borderTop: `2px solid ${on ? CYAN : "transparent"}`,
              color: on ? CYAN : TEXT3, cursor: "pointer",
            }}>
              <span style={{ fontSize: 15, opacity: on ? 1 : 0.45 }}>{t.icon}</span>
              <span style={{ fontSize: 7.5, fontFamily: "monospace" }}>{t.label}</span>
            </button>
          );
        })}

        {/* Centre session orb button */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
          <button
            onClick={() => { setConnected(c => !c); setActive(null); }}
            style={{
              width: 48, height: 48, borderRadius: "50%",
              background: connected
                ? `radial-gradient(circle, ${CYAN}44, ${VIOLET}22)`
                : `rgba(34,211,238,0.08)`,
              border: `2px solid ${connected ? CYAN : CYAN + "55"}`,
              boxShadow: connected ? `0 0 18px ${CYAN}44` : "none",
              color: connected ? CYAN : TEXT3,
              fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s",
              position: "absolute", top: "50%", transform: "translateY(-50%)",
              marginTop: -4,
            }}
          >
            ◎
          </button>
        </div>

        {/* Right 2 tabs (skip Finance — it's in the original TABS[2] slot, replaced by orb) */}
        {right.map(t => {
          const on = active === t.id;
          return (
            <button key={t.id} onClick={() => setActive(on ? null : t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3, height: "100%",
              background: "none", border: "none",
              borderTop: `2px solid ${on ? CYAN : "transparent"}`,
              color: on ? CYAN : TEXT3, cursor: "pointer",
            }}>
              <span style={{ fontSize: 15, opacity: on ? 1 : 0.45 }}>{t.icon}</span>
              <span style={{ fontSize: 7.5, fontFamily: "monospace" }}>{t.label}</span>
            </button>
          );
        })}

        {/* Finance tab (mid) — right of the orb */}
        <button onClick={() => setActive(active === mid.id ? null : mid.id)} style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 3, height: "100%",
          background: "none", border: "none",
          borderTop: `2px solid ${active === mid.id ? CYAN : "transparent"}`,
          color: active === mid.id ? CYAN : TEXT3, cursor: "pointer",
        }}>
          <span style={{ fontSize: 15, opacity: active === mid.id ? 1 : 0.45 }}>{mid.icon}</span>
          <span style={{ fontSize: 7.5, fontFamily: "monospace" }}>{mid.label}</span>
        </button>
      </nav>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preview page
// ═══════════════════════════════════════════════════════════════════════════════
const OPTIONS = [
  {
    id: "A",
    label: "Top Tab Bar",
    desc: "Icons always visible just below the FRIDAY banner. Tapping a tab fills the screen below. Familiar if you've used tab-heavy apps like Notion or Telegram.",
    component: OptionA,
  },
  {
    id: "B",
    label: "Bottom Tab Bar",
    desc: "Icons sit at the very bottom — the native mobile pattern used by Instagram, WhatsApp, Twitter. More thumb-friendly. Orb takes the full centre stage.",
    component: OptionB,
  },
  {
    id: "C",
    label: "Bottom Bar + Session Button",
    desc: "4 page tabs + a centred orb button to start/end session. One tap to talk, tabs always at thumb reach. No separate 'Start Session' screen.",
    component: OptionC,
  },
];

export default function MobilePreviewPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04080f",
      color: TEXT1,
      fontFamily: "monospace",
      padding: "32px 24px 64px",
    }}>
      {/* Title */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <p style={{ fontSize: 10, letterSpacing: "0.2em", color: TEXT3, textTransform: "uppercase", marginBottom: 6 }}>
          Friday — Mobile Layout
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: CYAN, margin: 0 }}>
          Pick a layout
        </h1>
        <p style={{ fontSize: 11, color: TEXT3, marginTop: 8 }}>
          Tap around each mockup — they're interactive. Select one and tell Friday.
        </p>
      </div>

      {/* Phone mockups row */}
      <div style={{
        display: "flex",
        gap: 20,
        justifyContent: "center",
        flexWrap: "wrap",
        marginBottom: 32,
      }}>
        {OPTIONS.map(opt => {
          const Comp = opt.component;
          const picked = selected === opt.id;
          return (
            <div key={opt.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              {/* Badge */}
              <div style={{
                fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
                color: picked ? CYAN : TEXT3,
                padding: "3px 10px", borderRadius: 100,
                border: `1px solid ${picked ? CYAN + "88" : TEXT3 + "44"}`,
                background: picked ? CYAN + "12" : "transparent",
              }}>
                Option {opt.id} — {opt.label}
              </div>

              {/* Phone frame */}
              <div
                onClick={() => setSelected(opt.id)}
                style={{
                  width: 220, height: 440,
                  borderRadius: 24,
                  border: `2px solid ${picked ? CYAN : "rgba(255,255,255,0.1)"}`,
                  boxShadow: picked ? `0 0 24px ${CYAN}33` : "0 4px 24px rgba(0,0,0,0.5)",
                  overflow: "hidden",
                  cursor: "pointer",
                  position: "relative",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              >
                <Comp />
                {/* Selection overlay flash */}
                {picked && (
                  <div style={{
                    position: "absolute", inset: 0,
                    border: `2px solid ${CYAN}`,
                    borderRadius: 22,
                    pointerEvents: "none",
                  }} />
                )}
              </div>

              {/* Description */}
              <p style={{
                width: 220, fontSize: 10, lineHeight: 1.6,
                color: picked ? TEXT1 : TEXT3,
                textAlign: "center",
              }}>
                {opt.desc}
              </p>

              {/* Pick button */}
              <button
                onClick={() => setSelected(opt.id)}
                style={{
                  padding: "7px 22px", borderRadius: 100, fontSize: 10,
                  background: picked ? `linear-gradient(135deg, ${CYAN}, ${VIOLET})` : "transparent",
                  color: picked ? BG : TEXT3,
                  border: `1px solid ${picked ? "transparent" : TEXT3 + "44"}`,
                  cursor: "pointer", fontFamily: "monospace", fontWeight: 700,
                  transition: "all 0.2s",
                }}
              >
                {picked ? "✓ Selected" : "Select"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Selection banner */}
      {selected && (
        <div style={{
          maxWidth: 480, margin: "0 auto",
          padding: "14px 20px", borderRadius: 12,
          background: CYAN + "10",
          border: `1px solid ${CYAN}33`,
          textAlign: "center", fontSize: 11, color: CYAN,
        }}>
          You picked <strong>Option {selected}</strong>. Tell Friday which one you want and it'll be implemented.
        </div>
      )}
    </div>
  );
}
