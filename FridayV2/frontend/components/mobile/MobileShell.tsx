"use client";

import { useState, useCallback, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
} from "@livekit/components-react";
import FridayOrb from "@/components/FridayOrb";
import MobileHeader from "./MobileHeader";
import MobileHomeControls from "./MobileHomeControls";
import MobileSlidePanel from "./MobileSlidePanel";
import MobileSettingsSheet from "./MobileSettingsSheet";

const STATE_LABELS: Record<string, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting…",
  initializing: "Initializing…",
  "pre-connect-buffering": "Buffering…",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  failed: "Failed",
  idle: "Idle",
};

const STATE_COLORS: Record<string, string> = {
  listening: "var(--cyan)",
  thinking: "var(--violet)",
  speaking: "var(--orange, #fb923c)",
};

// ── Inner component: must be inside LiveKitRoom to use LK hooks ──────────────

function MobileConnectedView({ onDisconnect }: { onDisconnect: () => void }) {
  const { state } = useVoiceAssistant();
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Swipe-up on the home screen opens the panel
  const touchStartY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null || panelOpen) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta < -60) setPanelOpen(true);
    touchStartY.current = null;
  }

  return (
    <>
      {/* Orb layer — swipe up anywhere here to open panel */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "none",
          gap: 16,
        }}
      >
        <div style={{ transform: "translateY(-10%)" }}>
          <FridayOrb state={state} width={320} height={320} />
        </div>
        {/* State label */}
        <div style={{
          transform: "translateY(-10%)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: STATE_COLORS[state] ?? "var(--text-3)",
            boxShadow: STATE_COLORS[state] ? `0 0 8px ${STATE_COLORS[state]}` : "none",
          }} />
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: STATE_COLORS[state] ?? "var(--text-3)",
          }}>
            {STATE_LABELS[state] ?? state}
          </span>
        </div>
      </div>

      <MobileHeader onSettingsPress={() => setSettingsOpen(true)} />

      {!panelOpen && (
        <MobileHomeControls onDisconnect={onDisconnect} />
      )}

      <MobileSlidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onDisconnect={onDisconnect}
      />

      <MobileSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

// ── Root shell ────────────────────────────────────────────────────────────────

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "";

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/livekit-token");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToken(data.token);
    } catch (err) {
      console.error("[MobileShell] connect error:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setToken(null);
  }, []);

  return (
    <div
      className="grid-bg"
      style={{ position: "fixed", inset: 0, background: "var(--bg-base)", overflow: "hidden" }}
    >
      {/* Ambient glow — always present */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 35%, rgba(34,211,238,0.09) 0%, rgba(167,139,250,0.05) 30%, transparent 55%)",
        pointerEvents: "none",
      }} />

      {/* Orb base layer — visible in disconnected state */}
      {!token && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -58%)" }}>
          <FridayOrb state="disconnected" width={320} height={320} />
        </div>
      )}

      {/* Disconnected controls */}
      {!token && (
        <div style={{
          position: "absolute", bottom: 80, left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          {connecting && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)", letterSpacing: "0.08em" }}>
              Connecting…
            </p>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting}
            style={{
              padding: "14px 40px",
              background: connecting
                ? "rgba(34,211,238,0.15)"
                : "linear-gradient(135deg, var(--cyan), var(--violet))",
              color: connecting ? "var(--text-3)" : "var(--bg-base)",
              fontFamily: "var(--font-space)", fontWeight: 700, fontSize: 15,
              border: "none", borderRadius: 100, cursor: connecting ? "default" : "pointer",
              boxShadow: connecting ? "none" : "0 4px 24px rgba(34,211,238,0.25)",
              transition: "all 0.2s",
            }}
          >
            {connecting ? "Connecting…" : "Start Session"}
          </button>
        </div>
      )}

      {/* Connected: LiveKit session wraps the entire active UI */}
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
          <MobileConnectedView onDisconnect={handleDisconnect} />
        </LiveKitRoom>
      )}
    </div>
  );
}
