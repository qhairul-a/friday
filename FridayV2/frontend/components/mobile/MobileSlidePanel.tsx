"use client";

import { useState, useRef } from "react";
import OverviewTab from "./tabs/OverviewTab";
import PlansTab from "./tabs/PlansTab";
import FinanceTab from "./tabs/FinanceTab";
import FitnessTab from "./tabs/FitnessTab";
import NotesTab from "./tabs/NotesTab";
import MobileFloatingControls from "./MobileFloatingControls";

const TABS = [
  { id: "overview", label: "Overview", icon: "⬡" },
  { id: "plans",    label: "Plans",    icon: "◷" },
  { id: "finance",  label: "Finance",  icon: "◈" },
  { id: "fitness",  label: "Fitness",  icon: "♡" },
  { id: "notes",    label: "Notes",    icon: "◱" },
] as const;

type TabId = typeof TABS[number]["id"];

interface MobileSlidePanelProps {
  open: boolean;
  onClose: () => void;
  onDisconnect: () => void;
}

export default function MobileSlidePanel({ open, onClose, onDisconnect }: MobileSlidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const touchStartY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 60) onClose();
    touchStartY.current = null;
  }

  function tabColor(id: TabId) {
    return id === "finance" ? "var(--orange)" : "var(--cyan)";
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 56,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        background: "rgba(8,12,28,0.88)",
        backdropFilter: "blur(32px) saturate(1.5)",
        WebkitBackdropFilter: "blur(32px) saturate(1.5)",
        borderTop: "1px solid rgba(34,211,238,0.2)",
        borderRadius: "22px 22px 0 0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      {/* Drag handle — swipe down to close */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 0 6px",
          flexShrink: 0,
          touchAction: "none",
        }}
      >
        <div style={{ width: 36, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid rgba(34,211,238,0.08)",
        overflowX: "auto",
        flexShrink: 0,
        padding: "0 12px",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      } as React.CSSProperties}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const color  = active ? tabColor(tab.id) : "var(--text-3)";
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "8px 10px 6px",
                fontFamily: "var(--font-space)",
                fontSize: 11,
                whiteSpace: "nowrap",
                flexShrink: 0,
                color,
                background: "none",
                border: "none",
                borderBottom: `2px solid ${active ? tabColor(tab.id) : "transparent"}`,
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "plans"    && <PlansTab />}
        {activeTab === "finance"  && <FinanceTab />}
        {activeTab === "fitness"  && <FitnessTab />}
        {activeTab === "notes"    && <NotesTab />}
      </div>

      {/* Floating controls — mic + end session */}
      <MobileFloatingControls onDisconnect={onDisconnect} />
    </div>
  );
}
