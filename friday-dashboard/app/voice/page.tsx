"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  VoiceAssistantControlBar,
} from "@livekit/components-react";
import "@livekit/components-styles";

type SessionState = "idle" | "connecting" | "connected";

export default function VoicePage() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function connect() {
    setSessionState("connecting");
    setError("");
    try {
      const res = await fetch("/api/livekit-token");
      if (!res.ok) throw new Error("Failed to get session token");
      const data = await res.json();
      setToken(data.token);
      setUrl(data.url);
      setSessionState("connected");
    } catch (e) {
      setError("Could not connect. Is the voice agent running?");
      setSessionState("idle");
    }
  }

  function disconnect() {
    setToken("");
    setUrl("");
    setSessionState("idle");
  }

  if (sessionState !== "connected") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Talk to Friday</h1>
          <p className="text-gray-400 mt-2 text-sm">Real-time voice conversation</p>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={connect}
          disabled={sessionState === "connecting"}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-8 py-4 rounded-2xl text-lg font-medium transition-colors flex items-center gap-3"
        >
          <span className="text-2xl">🎙</span>
          {sessionState === "connecting" ? "Connecting…" : "Start session"}
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      audio
      video={false}
      onDisconnected={disconnect}
      className="min-h-screen bg-gray-950 flex flex-col items-center justify-center"
    >
      <RoomAudioRenderer />
      <ActiveSession onDisconnect={disconnect} />
    </LiveKitRoom>
  );
}

function ActiveSession({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack } = useVoiceAssistant();

  return (
    <div className="flex flex-col items-center gap-8 p-8 w-full max-w-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Friday</h1>
        <p className="text-gray-400 text-sm mt-1 capitalize">{state}</p>
      </div>

      <div className="w-full h-24">
        <BarVisualizer
          state={state}
          trackRef={audioTrack}
          barCount={32}
          className="w-full h-full"
          options={{ minHeight: 4 }}
        />
      </div>

      <VoiceAssistantControlBar />

      <button
        onClick={onDisconnect}
        className="text-gray-500 hover:text-red-400 text-sm transition-colors mt-4"
      >
        End session
      </button>
    </div>
  );
}
