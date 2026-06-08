"use client";

import { useState, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  VoiceAssistantControlBar,
} from "@livekit/components-react";

interface VoiceChatProps {
  livekitUrl: string;
}

function FridayInterface() {
  const { state, audioTrack } = useVoiceAssistant();

  const stateLabel: Record<string, string> = {
    disconnected: "Press connect to speak with Friday",
    connecting: "Connecting…",
    initializing: "Initializing…",
    listening: "Friday is listening…",
    thinking: "Friday is thinking…",
    speaking: "Friday is speaking…",
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 480, width: "100%", padding: "2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 300, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
        FRIDAY
      </h1>
      <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "2.5rem" }}>
        {stateLabel[state] ?? state}
      </p>

      <div style={{ height: 80, marginBottom: "2rem" }}>
        <BarVisualizer
          state={state}
          trackRef={audioTrack}
          barCount={20}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <VoiceAssistantControlBar />
    </div>
  );
}

export default function VoiceChat({ livekitUrl }: VoiceChatProps) {
  const [token, setToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/livekit-token");
      const data = await res.json();
      setToken(data.token);
    } catch (e) {
      console.error("Failed to get token", e);
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setToken(null);
    setConnecting(false);
  }, []);

  if (!token) {
    return (
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 300, letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
          FRIDAY
        </h1>
        <button
          onClick={connect}
          disabled={connecting}
          style={{
            padding: "0.75rem 2.5rem",
            background: "transparent",
            border: "1px solid #555",
            borderRadius: 4,
            color: "#f0f0f0",
            fontSize: "0.9rem",
            cursor: connecting ? "not-allowed" : "pointer",
            letterSpacing: "0.05em",
          }}
        >
          {connecting ? "Connecting…" : "Connect"}
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect
      audio
      onDisconnected={disconnect}
    >
      <RoomAudioRenderer />
      <FridayInterface />
    </LiveKitRoom>
  );
}
