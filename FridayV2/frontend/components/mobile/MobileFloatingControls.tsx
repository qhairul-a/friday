"use client";

import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";

interface MobileFloatingControlsProps {
  onDisconnect: () => void;
}

export default function MobileFloatingControls({ onDisconnect }: MobileFloatingControlsProps) {
  const { localParticipant } = useLocalParticipant();
  const micPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
  const isMuted = micPub?.isMuted ?? false;

  function toggleMic() {
    localParticipant?.setMicrophoneEnabled(isMuted);
  }

  return (
    <div style={{
      position: "absolute",
      bottom: "calc(20px + env(safe-area-inset-bottom))",
      right: 16,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
      zIndex: 10,
    }}>
      {/* End Session pill */}
      <button
        onClick={onDisconnect}
        style={{
          padding: "8px 18px",
          borderRadius: 100,
          background: "rgba(248,113,113,0.1)",
          border: "1px solid rgba(248,113,113,0.25)",
          color: "#f87171",
          fontFamily: "var(--font-space)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        ⏻ End
      </button>

      {/* Mic button */}
      <button
        onClick={toggleMic}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        style={{
          width: 42, height: 42,
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isMuted ? "rgba(71,85,105,0.3)" : "rgba(34,211,238,0.12)",
          border: `1.5px solid ${isMuted ? "rgba(71,85,105,0.5)" : "rgba(34,211,238,0.5)"}`,
          color: isMuted ? "var(--text-3)" : "var(--cyan)",
          fontSize: 18,
          cursor: "pointer",
          boxShadow: isMuted ? "none" : "0 0 16px rgba(34,211,238,0.12)",
          transition: "all 0.2s",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {isMuted ? "🔇" : "🎙"}
      </button>
    </div>
  );
}
