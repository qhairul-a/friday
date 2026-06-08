"use client";

import { useState, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import FridayOrb from "@/components/FridayOrb";
import MobileHeader from "./MobileHeader";
import MobileSettingsSheet from "./MobileSettingsSheet";
import OverviewTab from "./tabs/OverviewTab";
import PlansTab from "./tabs/PlansTab";
import FinanceTab from "./tabs/FinanceTab";
import FitnessTab from "./tabs/FitnessTab";
import NotesTab from "./tabs/NotesTab";

const TABS = [
  { id: "overview", label: "Overview", icon: "⬡" },
  { id: "plans",    label: "Plans",    icon: "◷" },
  { id: "finance",  label: "Finance",  icon: "◈" },
  { id: "fitness",  label: "Fitness",  icon: "♡" },
  { id: "notes",    label: "Notes",    icon: "◱" },
] as const;

type TabId = typeof TABS[number]["id"];

const STATE_LABELS: Record<string, string> = {
  disconnected: "Disconnected", connecting: "Connecting…",
  listening: "Listening", thinking: "Thinking",
  speaking: "Speaking", idle: "Idle",
};
const STATE_COLORS: Record<string, string> = {
  listening: "var(--cyan)", thinking: "var(--violet)", speaking: "#fb923c",
};

const HEADER_H  = 52;
const TABBAR_H  = 48;
const SESSION_H = 64;

// ── Connected orb view — inside LiveKitRoom ───────────────────────────────────
function ConnectedOrbView() {
  const { state } = useVoiceAssistant();
  const color = STATE_COLORS[state];
  return (
    <div style={{
      position: "absolute",
      top: HEADER_H + TABBAR_H, bottom: SESSION_H,
      left: 0, right: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 16,
      pointerEvents: "none",
    }}>
      <FridayOrb state={state} width={260} height={260} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: color ?? "var(--text-3)",
          boxShadow: color ? `0 0 8px ${color}` : "none",
        }} />
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          letterSpacing: "0.1em", textTransform: "uppercase",
          color: color ?? "var(--text-3)",
        }}>
          {STATE_LABELS[state] ?? state}
        </span>
      </div>
    </div>
  );
}

// ── Session bar — inside LiveKitRoom ─────────────────────────────────────────
function SessionBar({ onDisconnect }: { onDisconnect: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const micPub  = localParticipant?.getTrackPublication(Track.Source.Microphone);
  const isMuted = micPub?.isMuted ?? false;
  function toggleMic() { localParticipant?.setMicrophoneEnabled(isMuted); }

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: SESSION_H, zIndex: 30,
      paddingBottom: "env(safe-area-inset-bottom)",
      background: "rgba(8,12,28,0.95)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderTop: "1px solid rgba(34,211,238,0.12)",
      display: "flex", alignItems: "center",
      justifyContent: "center", gap: 16,
    }}>
      <button
        onClick={toggleMic}
        aria-label={isMuted ? "Unmute" : "Mute"}
        style={{
          width: 44, height: 44, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isMuted ? "rgba(71,85,105,0.25)" : "rgba(34,211,238,0.12)",
          border: `1.5px solid ${isMuted ? "rgba(71,85,105,0.5)" : "rgba(34,211,238,0.5)"}`,
          color: isMuted ? "var(--text-3)" : "var(--cyan)",
          fontSize: 20, cursor: "pointer", transition: "all 0.2s",
          boxShadow: isMuted ? "none" : "0 0 16px rgba(34,211,238,0.12)",
        }}
      >
        {isMuted ? "🔇" : "🎙"}
      </button>
      <button
        onClick={onDisconnect}
        style={{
          padding: "10px 24px", borderRadius: 100,
          background: "rgba(248,113,113,0.1)",
          border: "1px solid rgba(248,113,113,0.3)",
          color: "#f87171", fontFamily: "var(--font-space)",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        ⏻ End Session
      </button>
    </div>
  );
}

// ── Root shell ────────────────────────────────────────────────────────────────
export default function MobileShell() {
  const [activeTab,    setActiveTab]    = useState<TabId | null>(null);
  const [token,        setToken]        = useState<string | null>(null);
  const [connecting,   setConnecting]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "";

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const res  = await fetch("/api/livekit-token");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToken(data.token);
    } catch (err) {
      console.error("[MobileShell] connect error:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => setToken(null), []);

  // Tapping the active tab goes back to orb home
  function handleTabPress(id: TabId) {
    setActiveTab(prev => (prev === id ? null : id));
  }

  const showHome = activeTab === null;

  return (
    <div
      className="grid-bg"
      style={{ position: "fixed", inset: 0, background: "var(--bg-base)", overflow: "hidden" }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 35%, rgba(34,211,238,0.09) 0%, rgba(167,139,250,0.05) 30%, transparent 55%)",
      }} />

      {/* Header */}
      <MobileHeader onSettingsPress={() => setSettingsOpen(true)} />

      {/* Tab bar — always visible, no session required */}
      <nav style={{
        position: "fixed", top: HEADER_H, left: 0, right: 0,
        height: TABBAR_H, zIndex: 25,
        background: "rgba(8,12,28,0.92)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(34,211,238,0.1)",
        display: "flex",
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabPress(tab.id)}
              style={{
                flex: 1,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 3, background: "none", border: "none",
                borderBottom: `2px solid ${active ? "var(--cyan)" : "transparent"}`,
                color: active ? "var(--cyan)" : "var(--text-3)",
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
                paddingTop: 2,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{
                fontSize: 16, opacity: active ? 1 : 0.5,
                fontFamily: "var(--font-space)",
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 9, letterSpacing: "0.05em",
                fontFamily: "var(--font-space)",
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Content area */}
      <div style={{
        position: "absolute",
        top: HEADER_H + TABBAR_H,
        bottom: token ? SESSION_H : 0,
        left: 0, right: 0,
        overflowY: showHome ? "hidden" : "auto",
        overscrollBehavior: "contain",
      }}>
        {/* Home — orb + start button (not connected) */}
        {showHome && !token && (
          <div style={{
            height: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 20,
          }}>
            <FridayOrb state="disconnected" width={260} height={260} />
            {connecting ? (
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 11,
                color: "var(--text-3)", letterSpacing: "0.08em",
              }}>
                Connecting…
              </p>
            ) : (
              <button
                onClick={handleConnect}
                style={{
                  padding: "14px 40px",
                  background: "linear-gradient(135deg, var(--cyan), var(--violet))",
                  color: "var(--bg-base)", fontFamily: "var(--font-space)",
                  fontWeight: 700, fontSize: 15,
                  border: "none", borderRadius: 100, cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(34,211,238,0.25)",
                  transition: "all 0.2s",
                }}
              >
                Start Session
              </button>
            )}
          </div>
        )}

        {/* Tab content — rendered regardless of session state */}
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "plans"    && <PlansTab />}
        {activeTab === "finance"  && <FinanceTab />}
        {activeTab === "fitness"  && <FitnessTab />}
        {activeTab === "notes"    && <NotesTab />}
      </div>

      {/* LiveKit: connected orb (home only) + session bar */}
      {token && (
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect
          audio
          onDisconnected={handleDisconnect}
          style={{ display: "contents" }}
        >
          <RoomAudioRenderer />
          {showHome && <ConnectedOrbView />}
          <SessionBar onDisconnect={handleDisconnect} />
        </LiveKitRoom>
      )}

      <MobileSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
