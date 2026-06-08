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

const STATE_COLORS: Record<string, string> = {
  listening: "var(--cyan)",
  thinking:  "var(--violet)",
  speaking:  "#fb923c",
};

const HEADER_H = 52;
const TABBAR_H = 48;

// ── Home orb (connected) — inside LiveKitRoom ─────────────────────────────────
function ConnectedHomeOrb() {
  const { state } = useVoiceAssistant();
  return (
    <div style={{
      height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 14, pointerEvents: "none",
    }}>
      <FridayOrb state={state} width={240} height={240} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: STATE_COLORS[state] ?? "var(--text-3)",
          boxShadow: STATE_COLORS[state] ? `0 0 8px ${STATE_COLORS[state]}` : "none",
        }} />
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          letterSpacing: "0.1em", textTransform: "uppercase",
          color: STATE_COLORS[state] ?? "var(--text-3)",
        }}>
          {state ?? "idle"}
        </span>
      </div>
    </div>
  );
}

// ── Session FAB (connected) — inside LiveKitRoom ──────────────────────────────
function SessionFabConnected({ onDisconnect }: { onDisconnect: () => void }) {
  const { state }            = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const micPub  = localParticipant?.getTrackPublication(Track.Source.Microphone);
  const isMuted = micPub?.isMuted ?? false;

  function toggleMic() { localParticipant?.setMicrophoneEnabled(isMuted); }

  const stateColor = STATE_COLORS[state] ?? "var(--cyan)";

  return (
    <>
      {/* End-session button — above the main FAB */}
      <button
        onClick={onDisconnect}
        aria-label="End session"
        style={{
          position: "fixed", bottom: 96, right: 20, zIndex: 50,
          width: 36, height: 36, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(248,113,113,0.1)",
          border: "1px solid rgba(248,113,113,0.35)",
          color: "#f87171", fontSize: 14, cursor: "pointer",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          transition: "all 0.2s",
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        ⏻
      </button>

      {/* Main FAB — mic toggle + voice state */}
      <button
        onClick={toggleMic}
        aria-label={isMuted ? "Unmute" : "Mute"}
        style={{
          position: "fixed", bottom: 28, right: 20, zIndex: 50,
          width: 56, height: 56, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isMuted
            ? "rgba(71,85,105,0.3)"
            : `rgba(34,211,238,0.12)`,
          border: `2px solid ${isMuted ? "rgba(71,85,105,0.5)" : stateColor}`,
          color: isMuted ? "var(--text-3)" : stateColor,
          fontSize: 22, cursor: "pointer",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          boxShadow: isMuted
            ? "0 4px 16px rgba(0,0,0,0.4)"
            : `0 4px 24px ${stateColor}44`,
          transition: "all 0.2s",
        }}
      >
        {isMuted ? "🔇" : "🎙"}
      </button>
    </>
  );
}

// ── Session FAB (disconnected / connecting) ───────────────────────────────────
function SessionFabIdle({
  connecting,
  onConnect,
}: {
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      aria-label="Start session"
      style={{
        position: "fixed", bottom: 28, right: 20, zIndex: 50,
        width: 56, height: 56, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(34,211,238,0.08)",
        border: "2px solid rgba(34,211,238,0.35)",
        color: connecting ? "var(--text-3)" : "var(--cyan)",
        fontSize: connecting ? 14 : 22,
        cursor: connecting ? "not-allowed" : "pointer",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 4px 20px rgba(34,211,238,0.12)",
        transition: "all 0.2s",
        animation: connecting ? "pulse 1.2s ease-in-out infinite" : "none",
      }}
    >
      {connecting ? "…" : "◎"}
    </button>
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

      {/* Top tab bar */}
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
              <span style={{ fontSize: 16, opacity: active ? 1 : 0.5, fontFamily: "var(--font-space)" }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: 9, letterSpacing: "0.05em", fontFamily: "var(--font-space)" }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Content area — full height below tab bar */}
      <div style={{
        position: "absolute",
        top: HEADER_H + TABBAR_H,
        bottom: 0, left: 0, right: 0,
        overflowY: showHome ? "hidden" : "auto",
        overscrollBehavior: "contain",
      }}>
        {/* Disconnected home — orb + hint */}
        {showHome && !token && (
          <div style={{
            height: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 12,
          }}>
            <FridayOrb state="disconnected" width={240} height={240} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--text-3)", letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>
              {connecting ? "Connecting…" : "Tap ◎ to start"}
            </span>
          </div>
        )}

        {/* Tab content — always mounted when selected */}
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "plans"    && <PlansTab />}
        {activeTab === "finance"  && <FinanceTab />}
        {activeTab === "fitness"  && <FitnessTab />}
        {activeTab === "notes"    && <NotesTab />}
      </div>

      {/* LiveKit — connected orb (home only) + connected FAB */}
      {token ? (
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect
          audio
          onDisconnected={handleDisconnect}
          style={{ display: "contents" }}
        >
          <RoomAudioRenderer />
          {showHome && <ConnectedHomeOrb />}
          <SessionFabConnected onDisconnect={handleDisconnect} />
        </LiveKitRoom>
      ) : (
        <SessionFabIdle connecting={connecting} onConnect={handleConnect} />
      )}

      <MobileSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Pulse keyframe for connecting state */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.92); }
        }
      `}</style>
    </div>
  );
}
