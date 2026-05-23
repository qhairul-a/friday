"use client";

import { useState, useEffect, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
} from "@livekit/components-react";
import "@livekit/components-styles";

type OrbState = "idle" | "connecting" | "connected";

export default function VoiceOrbMini() {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function connect() {
    setOrbState("connecting");
    setError("");
    try {
      const res = await fetch("/api/livekit-token");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setToken(data.token);
      setUrl(data.url);
      setOrbState("connected");
    } catch {
      setError("Agent offline");
      setOrbState("idle");
    }
  }

  function disconnect() {
    setToken("");
    setUrl("");
    setOrbState("idle");
  }

  if (orbState === "connected") {
    return (
      <LiveKitRoom token={token} serverUrl={url} connect audio video={false} onDisconnected={disconnect}
        className="flex flex-col items-center"
      >
        <RoomAudioRenderer />
        <ActiveMiniOrb onDisconnect={disconnect} />
      </LiveKitRoom>
    );
  }

  const isConnecting = orbState === "connecting";
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={connect}
        disabled={isConnecting}
        className="relative flex items-center justify-center cursor-pointer disabled:cursor-wait group"
        style={{ width: 140, height: 140 }}
      >
        {[140, 118, 98, 80].map((size, i) => (
          <div
            key={size}
            className="absolute rounded-full border border-[#00d4ff]"
            style={{
              width: size, height: size,
              opacity: 0.08 + i * 0.06,
              animation: `spin ${20 - i * 4}s linear infinite ${i % 2 ? "reverse" : ""}`,
              left: "50%", top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
        <div
          className="relative z-10 rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-105"
          style={{
            width: 64, height: 64,
            background: "radial-gradient(circle at 35% 35%, #0d2a3a, #050b14)",
            border: "1px solid rgba(0,212,255,0.4)",
            boxShadow: "0 0 20px rgba(0,212,255,0.15)",
          }}
        >
          {isConnecting ? (
            <div className="w-5 h-5 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="flex gap-0.5 items-end h-4">
              {[2, 4, 6, 4, 2].map((h, i) => (
                <div key={i} className="w-0.5 bg-[#00d4ff] rounded-full opacity-40"
                  style={{ height: h * 2, animation: `pulse ${1.5 + i * 0.2}s ease-in-out infinite` }} />
              ))}
            </div>
          )}
        </div>
      </button>
      <div className="text-center">
        <p className="text-[10px] font-bold tracking-[0.3em] text-[#4a7a9b]">F.R.I.D.A.Y</p>
        <p className="text-[9px] text-[#364c61] mt-0.5">{isConnecting ? "Connecting…" : "Tap to activate"}</p>
        {error && <p className="text-[9px] text-red-400 mt-0.5">{error}</p>}
      </div>
    </div>
  );
}

function ActiveMiniOrb({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const isListening = state === "listening";
  const isSpeaking = state === "speaking";
  const ringColor = isSpeaking ? "#00d4ff" : isListening ? "#00ff88" : "#00d4ff";

  const [lines, setLines] = useState<{ id: string; text: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finals = agentTranscriptions.filter((s) => s.final);
    setLines((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const newOnes = finals
        .filter((s) => !existingIds.has(s.id))
        .map((s) => ({ id: s.id, text: s.text }));
      return newOnes.length ? [...prev, ...newOnes] : prev;
    });
  }, [agentTranscriptions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <button
        onClick={onDisconnect}
        className="relative flex items-center justify-center cursor-pointer"
        style={{ width: 140, height: 140 }}
        title="End session"
      >
        {[140, 118, 98, 80].map((size, i) => (
          <div
            key={size}
            className="absolute rounded-full border"
            style={{
              width: size, height: size,
              borderColor: `${ringColor}${Math.round((0.1 + i * 0.08) * (isSpeaking || isListening ? 2 : 1) * 255).toString(16).padStart(2, "0")}`,
              animation: `spin ${20 - i * 4}s linear infinite ${i % 2 ? "reverse" : ""}`,
              left: "50%", top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
        <div
          className="relative z-10 rounded-full flex items-center justify-center transition-all duration-500"
          style={{
            width: 64, height: 64,
            background: "radial-gradient(circle at 35% 35%, #0d2a3a, #050b14)",
            border: `1px solid ${ringColor}`,
            boxShadow: `0 0 25px ${isSpeaking ? "rgba(0,212,255,0.4)" : isListening ? "rgba(0,255,136,0.3)" : "rgba(0,212,255,0.1)"}`,
          }}
        >
          <div className="w-10 h-5">
            <BarVisualizer state={state} trackRef={audioTrack} barCount={6} className="w-full h-full" options={{ minHeight: 2 }} />
          </div>
        </div>
      </button>
      <div className="text-center">
        <p className="text-[10px] font-bold tracking-[0.3em] text-[#4a7a9b]">F.R.I.D.A.Y</p>
        <p className="text-[9px] mt-0.5" style={{ color: isListening ? "#00ff88" : isSpeaking ? "#00d4ff" : "#364c61" }}>
          {isListening ? "Listening…" : isSpeaking ? "Speaking…" : state === "thinking" ? "Thinking…" : "Active"}
        </p>
      </div>
      {lines.length > 0 && (
        <div className="w-full overflow-y-auto px-3 py-2 bg-[#060e1c] rounded-xl border border-[#1a3a5c] text-left" style={{ maxHeight: 100 }}>
          {lines.map((l, i) => (
            <p
              key={l.id}
              className={`text-[10px] leading-relaxed ${i === lines.length - 1 ? "text-white" : "text-[#4a7a9b]"}`}
            >
              {l.text}
            </p>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
