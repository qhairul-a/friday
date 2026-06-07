"use client";

import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";

interface MobileHomeControlsProps {
  onDisconnect: () => void;
}

export default function MobileHomeControls({ onDisconnect }: MobileHomeControlsProps) {
  const { localParticipant } = useLocalParticipant();
  const micPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
  const isMuted = micPub?.isMuted ?? false;

  function toggleMic() {
    localParticipant?.setMicrophoneEnabled(isMuted);
  }

  return (
    <div style={{
      position: "absolute",
      bottom: "calc(56px + env(safe-area-inset-bottom))",
      left: 0,
      right: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
    }}>
      {/* Mic label */}
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: isMuted ? "var(--text-3)" : "rgba(34,211,238,0.6)",
      }}>
        {isMuted ? "mic off" : "speak to respond"}
      </span>

      {/* Mic button */}
      <button
        onClick={toggleMic}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        style={{
          width: 56, height: 56,
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isMuted ? "rgba(71,85,105,0.2)" : "rgba(34,211,238,0.1)",
          border: `2px solid ${isMuted ? "rgba(71,85,105,0.5)" : "rgba(34,211,238,0.5)"}`,
          color: isMuted ? "var(--text-3)" : "var(--cyan)",
          fontSize: 22,
          cursor: "pointer",
          boxShadow: isMuted ? "none" : "0 0 24px rgba(34,211,238,0.15)",
          transition: "all 0.2s",
        }}
      >
        {isMuted ? "🔇" : "🎙"}
      </button>

      {/* End Session */}
      <button
        onClick={onDisconnect}
        style={{
          padding: "10px 28px",
          borderRadius: 100,
          background: "rgba(248,113,113,0.1)",
          border: "1px solid rgba(248,113,113,0.3)",
          color: "#f87171",
          fontFamily: "var(--font-space)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "background 0.2s",
        }}
      >
        End Session
      </button>
    </div>
  );
}
