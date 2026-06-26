"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFinanceVisibility } from "@/lib/finance-visibility";

const NAV = [
  { href: "/overview",     label: "Overview",     icon: "⬡" },
  { href: "/productivity", label: "Productivity",  icon: "◷" },
  { href: "/finance",      label: "Finance",       icon: "◈" },
  { href: "/notes",        label: "Notes",         icon: "◱" },
];

function EyeOpen({ glow }: { glow?: boolean }) {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" style={{ display: "block", filter: glow ? "drop-shadow(0 0 4px rgba(34,211,238,0.6))" : undefined }}>
      <path d="M1 7C4 1.5 16 1.5 19 7C16 12.5 4 12.5 1 7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="10" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="10" cy="7" r="0.8" fill="currentColor"/>
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" style={{ display: "block" }}>
      <path d="M1 7C4 1.5 16 1.5 19 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="6.5" y1="6.5" x2="6" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="10" y1="6.8" x2="10" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <line x1="13.5" y1="6.5" x2="14" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const { visible, toggle } = useFinanceVisibility();

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  const settingsActive = pathname.startsWith("/settings");
  const dividerMargin  = collapsed ? "0 8px" : "0 24px";

  function NavTooltip({ label }: { label: string }) {
    return (
      <div style={{
        position: "absolute",
        left: "calc(100% + 10px)",
        top: "50%",
        transform: "translateY(-50%)",
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        color: "var(--text-1)",
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 12,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 50,
        fontFamily: "var(--font-space)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}>
        {label}
      </div>
    );
  }

  return (
    <aside style={{
      width: collapsed ? 64 : 240,
      minHeight: "100vh",
      background: "rgba(7, 13, 31, 0.95)",
      borderRight: "1px solid var(--border)",
      backdropFilter: "blur(20px)",
      display: "flex",
      flexDirection: "column",
      padding: "32px 0",
      flexShrink: 0,
      position: "sticky",
      top: 0,
      height: "100vh",
      transition: "width 0.25s ease",
      overflow: "hidden",
    }}>

      {/* Logo */}
      <div style={{
        padding: collapsed ? "0 0 36px" : "0 24px 36px",
        display: "flex",
        alignItems: collapsed ? "center" : "flex-start",
        flexDirection: "column",
        paddingLeft: collapsed ? 0 : 24,
        alignSelf: collapsed ? "stretch" : "auto",
      }}>
        {collapsed ? (
          <div style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}>
            <span style={{
              fontFamily: "var(--font-space)",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--cyan)",
              textShadow: "0 0 20px rgba(34,211,238,0.4)",
            }}>Fri</span>
            <div style={{ position: "relative" }}>
              <button
                onClick={toggle}
                onMouseEnter={() => setHoveredHref("finance-toggle")}
                onMouseLeave={() => setHoveredHref(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 24,
                  background: "transparent",
                  border: `1px solid ${visible ? "rgba(34,211,238,0.5)" : "var(--border)"}`,
                  borderRadius: 8,
                  color: visible ? "var(--cyan)" : "var(--text-3)",
                  cursor: "pointer",
                  fontSize: 13,
                  lineHeight: 1,
                  transition: "border-color 0.2s, color 0.2s",
                  fontFamily: "var(--font-space)",
                }}
              >
                {visible ? <EyeOpen glow /> : <EyeClosed />}
              </button>
              {hoveredHref === "finance-toggle" && <NavTooltip label={visible ? "Hide figures" : "Show figures"} />}
            </div>
          </div>
        ) : (
          <>
            <div style={{
              fontFamily: "var(--font-space)",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--cyan)",
              textShadow: "0 0 20px rgba(34,211,238,0.4)",
            }}>
              FRIDAY
            </div>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--text-3)",
              marginTop: 4,
              textTransform: "uppercase",
            }}>
              Personal AI v2.0
            </div>
            <button
              onClick={toggle}
              title={visible ? "Hide figures" : "Show figures"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 14,
                width: 32,
                height: 24,
                background: "transparent",
                border: `1px solid ${visible ? "rgba(34,211,238,0.5)" : "var(--border)"}`,
                borderRadius: 8,
                color: visible ? "var(--cyan)" : "var(--text-3)",
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1,
                transition: "border-color 0.2s, color 0.2s",
                fontFamily: "var(--font-space)",
              }}
            >
              {visible ? "◉" : "⊗"}
            </button>
          </>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)", margin: `${dividerMargin} 16px`, transition: "margin 0.25s ease" }} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: "none", position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: collapsed ? 0 : 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: active ? "var(--cyan-dim)" : "transparent",
                  border: active ? "1px solid rgba(34,211,238,0.2)" : "1px solid transparent",
                  color: active ? "var(--cyan)" : "var(--text-3)",
                  fontFamily: "var(--font-space)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: "0.01em",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  setHoveredHref(item.href);
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  setHoveredHref(null);
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {active && (
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: "20%",
                    bottom: "20%",
                    width: 3,
                    borderRadius: 4,
                    background: "var(--cyan)",
                    boxShadow: "0 0 8px var(--cyan)",
                  }} />
                )}
                <span style={{ fontSize: 15, opacity: active ? 1 : 0.6, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && item.label}
                {collapsed && hoveredHref === item.href && <NavTooltip label={item.label} />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)", margin: `8px ${collapsed ? "8px" : "24px"}`, transition: "margin 0.25s ease" }} />

      {/* Settings */}
      <div style={{ padding: "0 12px", position: "relative" }}>
        <Link href="/settings" style={{ textDecoration: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 12,
              padding: "10px 14px",
              borderRadius: 10,
              background: settingsActive ? "var(--cyan-dim)" : "transparent",
              border: settingsActive ? "1px solid rgba(34,211,238,0.2)" : "1px solid transparent",
              color: settingsActive ? "var(--cyan)" : "var(--text-3)",
              fontFamily: "var(--font-space)",
              fontSize: 13,
              fontWeight: settingsActive ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              setHoveredHref("/settings");
              if (!settingsActive) {
                (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
                (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.04)";
              }
            }}
            onMouseLeave={(e) => {
              setHoveredHref(null);
              if (!settingsActive) {
                (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }
            }}
          >
            {settingsActive && (
              <div style={{
                position: "absolute",
                left: 0,
                top: "20%",
                bottom: "20%",
                width: 3,
                borderRadius: 4,
                background: "var(--cyan)",
                boxShadow: "0 0 8px var(--cyan)",
              }} />
            )}
            <span style={{ fontSize: 15, opacity: settingsActive ? 1 : 0.6, flexShrink: 0 }}>⚙</span>
            {!collapsed && "Settings"}
            {collapsed && hoveredHref === "/settings" && <NavTooltip label="Settings" />}
          </div>
        </Link>
      </div>

      {/* Logout */}
      <div style={{ padding: "4px 12px 0", position: "relative" }}>
        <button
          onClick={logout}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: collapsed ? 0 : 12,
            padding: "10px 14px",
            width: "100%",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: 10,
            color: "var(--text-3)",
            fontFamily: "var(--font-space)",
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            setHoveredHref("logout");
            (e.currentTarget as HTMLElement).style.color = "#f87171";
            (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.06)";
          }}
          onMouseLeave={(e) => {
            setHoveredHref(null);
            (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <span style={{ opacity: 0.6, flexShrink: 0 }}>⏻</span>
          {!collapsed && "Logout"}
          {collapsed && hoveredHref === "logout" && <NavTooltip label="Logout" />}
        </button>
      </div>

    </aside>
  );
}
