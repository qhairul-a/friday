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

export default function VoiceOrb({ autoConnect = false }: { autoConnect?: boolean }) {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function connect() {
    setOrbState("connecting");
    setError("");
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
      const res = await fetch("/api/livekit-token", { signal: abort.signal });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not connect.");
      }
      setToken(data.token);
      setUrl(data.url);
      setOrbState("connected");
    } catch (err) {
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Connection timed out. Is the agent worker running?"
        : err instanceof Error ? err.message : "Could not connect. Is the agent running?";
      setError(msg);
      setOrbState("idle");
    } finally {
      clearTimeout(timer);
    }
  }

  useEffect(() => {
    if (!autoConnect) return;
    const t = setTimeout(() => connect(), 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function disconnect() {
    setToken("");
    setUrl("");
    setOrbState("idle");
  }

  function handleAgentTimeout() {
    disconnect();
    setError("Friday didn't respond in time. Make sure the agent worker is running, then try again.");
  }

  if (orbState === "connected") {
    return (
      <LiveKitRoom
        token={token}
        serverUrl={url}
        connect
        audio
        video={false}
        onDisconnected={disconnect}
        className="flex flex-col items-center justify-center w-full h-full"
      >
        <RoomAudioRenderer />
        <ConnectedOrb onDisconnect={disconnect} onTimeout={handleAgentTimeout} />
      </LiveKitRoom>
    );
  }

  return <IdleOrb state={orbState} onConnect={connect} error={error} />;
}

function Ring({ size, duration, reverse, opacity }: { size: number; duration: number; reverse?: boolean; opacity: number }) {
  return (
    <div
      className="absolute rounded-full border border-[#00d4ff]"
      style={{
        width: size,
        height: size,
        opacity,
        animation: `spin ${duration}s linear infinite ${reverse ? "reverse" : ""}`,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

function IdleOrb({ state, onConnect, error }: { state: OrbState; onConnect: () => void; error: string }) {
  const isConnecting = state === "connecting";
  return (
    <div className="flex flex-col items-center gap-8">
      <button
        onClick={onConnect}
        disabled={isConnecting}
        className="relative flex items-center justify-center cursor-pointer disabled:cursor-wait group"
        style={{ width: 280, height: 280 }}
      >
        <Ring size={280} duration={25} opacity={0.08} />
        <Ring size={240} duration={18} reverse opacity={0.12} />
        <Ring size={200} duration={12} opacity={0.18} />
        <Ring size={164} duration={8} reverse opacity={0.22} />

        {/* Pulsing halo */}
        <div
          className="absolute rounded-full"
          style={{
            width: 148,
            height: 148,
            background: "radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)",
            animation: "pulse 3s ease-in-out infinite",
          }}
        />

        {/* Main orb */}
        <div
          className="relative z-10 rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-105"
          style={{
            width: 130,
            height: 130,
            background: "radial-gradient(circle at 35% 35%, #0d2a3a, #050b14)",
            border: "1px solid rgba(0,212,255,0.4)",
            boxShadow: isConnecting
              ? "0 0 60px rgba(0,212,255,0.4), inset 0 0 30px rgba(0,212,255,0.05)"
              : "0 0 30px rgba(0,212,255,0.15), inset 0 0 20px rgba(0,212,255,0.03)",
          }}
        >
          {isConnecting ? (
            <div className="w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-0.5 items-end h-6">
                {[3, 5, 8, 5, 3].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-[#00d4ff] rounded-full opacity-40"
                    style={{ height: h * 2, animation: `pulse ${1.5 + i * 0.2}s ease-in-out infinite` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </button>

      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-[0.4em] text-white">F.R.I.D.A.Y</h2>
        <p className="text-sm text-[#5b9bd5] mt-2 flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5b9bd5] animate-pulse" />
          {isConnecting ? "Connecting to Friday…" : "Click orb to activate voice"}
        </p>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    </div>
  );
}

function ConnectedOrb({ onDisconnect, onTimeout }: { onDisconnect: () => void; onTimeout: () => void }) {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();

  // Keep a ref so the timeout closure reads the latest state without being in its deps
  const stateRef = useRef(state);
  stateRef.current = state;

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

  useEffect(() => {
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (s !== "listening" && s !== "thinking" && s !== "speaking") {
        onTimeout();
      }
    }, 12000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isListening = state === "listening";
  const isSpeaking = state === "speaking";

  const glowColor = isSpeaking
    ? "rgba(0,212,255,0.5)"
    : isListening
    ? "rgba(0,255,136,0.35)"
    : "rgba(0,212,255,0.15)";

  const ringColor = isSpeaking ? "#00d4ff" : isListening ? "#00ff88" : "#00d4ff";
  const ringOpacityMult = isSpeaking || isListening ? 2 : 1;

  const statusLabel: Record<string, string> = {
    connecting: "Connecting…",
    initializing: "Initializing…",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <button
        onClick={onDisconnect}
        className="relative flex items-center justify-center cursor-pointer group"
        style={{ width: 280, height: 280 }}
        title="Click to end session"
      >
        <div
          className="absolute rounded-full border"
          style={{
            width: 280,
            height: 280,
            borderColor: `${ringColor}${Math.round(0.08 * ringOpacityMult * 255).toString(16).padStart(2, "0")}`,
            animation: "spin 25s linear infinite",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        <div
          className="absolute rounded-full border"
          style={{
            width: 240,
            height: 240,
            borderColor: `${ringColor}${Math.round(0.12 * ringOpacityMult * 255).toString(16).padStart(2, "0")}`,
            animation: "spin 18s linear infinite reverse",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        <div
          className="absolute rounded-full border"
          style={{
            width: 200,
            height: 200,
            borderColor: `${ringColor}${Math.round(0.18 * ringOpacityMult * 255).toString(16).padStart(2, "0")}`,
            animation: "spin 12s linear infinite",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        <div
          className="absolute rounded-full border"
          style={{
            width: 164,
            height: 164,
            borderColor: `${ringColor}${Math.round(0.25 * ringOpacityMult * 255).toString(16).padStart(2, "0")}`,
            animation: "spin 8s linear infinite reverse",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Glow halo */}
        <div
          className="absolute rounded-full transition-all duration-700"
          style={{
            width: 148,
            height: 148,
            background: `radial-gradient(circle, ${glowColor.replace(")", ", 0.6)").replace("rgba", "rgba").split(",").slice(0, 3).join(",")}, 0.12) 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />

        {/* Main orb */}
        <div
          className="relative z-10 rounded-full flex items-center justify-center transition-all duration-500"
          style={{
            width: 130,
            height: 130,
            background: "radial-gradient(circle at 35% 35%, #0d2a3a, #050b14)",
            border: `1px solid ${ringColor}`,
            boxShadow: `0 0 50px ${glowColor}, inset 0 0 20px rgba(0,212,255,0.05)`,
          }}
        >
          <div className="w-20 h-10 flex items-center justify-center">
            <BarVisualizer
              state={state}
              trackRef={audioTrack}
              barCount={10}
              className="w-full h-full"
              options={{ minHeight: 3 }}
            />
          </div>
        </div>
      </button>

      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-[0.4em] text-white">F.R.I.D.A.Y</h2>
        <p
          className="text-sm mt-2 flex items-center justify-center gap-2 transition-colors duration-300"
          style={{ color: isListening ? "#00ff88" : isSpeaking ? "#00d4ff" : "#5b9bd5" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: isListening ? "#00ff88" : isSpeaking ? "#00d4ff" : "#5b9bd5" }}
          />
          {statusLabel[state] ?? "Active"}
        </p>
        <button
          onClick={onDisconnect}
          className="mt-4 text-xs text-[#364c61] hover:text-red-400 transition-colors"
        >
          End session
        </button>

        {lines.length > 0 && (
          <div className="w-80 overflow-y-auto mt-3 px-3 py-2 bg-[#060e1c] rounded-xl border border-[#1a3a5c] text-left" style={{ maxHeight: 100 }}>
            {lines.map((l, i) => (
              <p
                key={l.id}
                className={`text-[11px] leading-relaxed ${i === lines.length - 1 ? "text-white" : "text-[#4a7a9b]"}`}
              >
                {l.text}
              </p>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
