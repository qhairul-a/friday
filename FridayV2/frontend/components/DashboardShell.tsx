"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import VoicePanel from "./VoicePanel";
import MobileShell from "./mobile/MobileShell";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);

  if (isMobile) {
    return <MobileShell />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      <Sidebar collapsed={collapsed} />
      <main
        className="grid-bg"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "40px 48px",
          minWidth: 0,
          position: "relative",
          backgroundColor: "#070d1f",
        }}
      >
        {/* Collapse toggle — fixed so it stays visible when scrolling */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            position: "fixed",
            top: 20,
            left: collapsed ? 76 : 252,
            transition: "left 0.25s ease, background 0.15s, border-color 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            background: "rgba(7,13,31,0.8)",
            border: "1px solid rgba(34,211,238,0.25)",
            borderRadius: 8,
            color: "var(--cyan)",
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
            zIndex: 50,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.12)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.5)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(7,13,31,0.8)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,238,0.25)";
          }}
        >
          {collapsed ? "›" : "‹"}
        </button>

        {children}
      </main>
      <VoicePanel />
    </div>
  );
}
