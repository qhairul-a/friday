"use client";

import { useState, useEffect, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import ParticleOrb, { type ParticleState } from "./particle-orb";

type OrbState = "idle" | "connecting" | "connected";

export default function VoiceOrbMini() {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [token, setToken]       = useState("");
  const [url, setUrl]           = useState("");
  const [error, setError]       = useState("");

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
      <LiveKitRoom
        token={token}
        serverUrl={url}
        connect
        audio
        video={false}
        onDisconnected={disconnect}
        className="flex flex-col items-center"
      >
        <RoomAudioRenderer />
        <ActiveMiniOrb onDisconnect={disconnect} />
      </LiveKitRoom>
    );
  }

  const isConnecting = orbState === "connecting";
  const particleState: ParticleState = isConnecting ? "connecting" : "idle";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={connect}
        disabled={isConnecting}
        className="relative flex items-center justify-center cursor-pointer disabled:cursor-wait group"
        style={{ width: 140, height: 140 }}
      >
        {/* Particle cloud */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ParticleOrb size={140} state={particleState} />
        </div>

        {/* Dark orb core */}
        <div
          className="relative z-10 rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-105"
          style={{
            width: 64,
            height: 64,
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
                <div
                  key={i}
                  className="w-0.5 bg-[#00d4ff] rounded-full opacity-40"
                  style={{ height: h * 2, animation: `pulse ${1.5 + i * 0.2}s ease-in-out infinite` }}
                />
              ))}
            </div>
          )}
        </div>
      </button>

      <div className="text-center">
        <p className="text-[10px] font-bold tracking-[0.3em] text-[#4a7a9b]">F.R.I.D.A.Y</p>
        <p className="text-[9px] text-[#364c61] mt-0.5">
          {isConnecting ? "Connecting…" : "Tap to activate"}
        </p>
        {error && <p className="text-[9px] text-red-400 mt-0.5">{error}</p>}
      </div>
    </div>
  );
}

// ── Active mini orb ──────────────────────────────────────────────────────────

function ActiveMiniOrb({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();

  // ── Audio level analysis ──────────────────────────────────────────────────
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mst = (audioTrack as any)?.publication?.track?.mediaStreamTrack as MediaStreamTrack | undefined;
    if (!mst) return;

    let audioCtx: AudioContext;
    let raf: number;
    try {
      audioCtx = new AudioContext();
      const source   = audioCtx.createMediaStreamSource(new MediaStream([mst]));
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        analyser.getByteFrequencyData(data);
        const slice = data.slice(0, 64);
        const avg   = slice.reduce((a, b) => a + b, 0) / slice.length;
        setAudioLevel(Math.min(avg / 100, 2));
        raf = requestAnimationFrame(tick);
      }
      tick();
    } catch {
      // degrade silently
    }

    return () => {
      cancelAnimationFrame(raf);
      audioCtx?.close();
    };
  }, [audioTrack]);

  // ── Transcription feed ────────────────────────────────────────────────────
  const [lines, setLines] = useState<{ id: string; text: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finals = agentTranscriptions.filter((s) => s.final);
    setLines((prev) => {
      const seen = new Set(prev.map((l) => l.id));
      const next = finals.filter((s) => !seen.has(s.id)).map((s) => ({ id: s.id, text: s.text }));
      return next.length ? [...prev, ...next] : prev;
    });
  }, [agentTranscriptions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const isListening = state === "listening";
  const isSpeaking  = state === "speaking";
  const coreColor   = isListening ? "#00ff88" : "#00d4ff";

  const particleState = (
    ["connecting","initializing","listening","thinking","speaking"].includes(state)
      ? state
      : "thinking"
  ) as ParticleState;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <button
        onClick={onDisconnect}
        className="relative flex items-center justify-center cursor-pointer"
        style={{ width: 140, height: 140 }}
        title="End session"
      >
        {/* Particle cloud */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ParticleOrb size={140} state={particleState} audioLevel={audioLevel} />
        </div>

        {/* Dark orb core */}
        <div
          className="relative z-10 rounded-full flex items-center justify-center transition-all duration-150"
          style={{
            width: 64,
            height: 64,
            background: "radial-gradient(circle at 35% 35%, #0d2a3a, #050b14)",
            border: `1px solid ${coreColor}`,
            boxShadow: isListening
              ? `0 0 ${20 + audioLevel * 25}px rgba(0,255,136,${0.2 + audioLevel * 0.35})`
              : `0 0 ${20 + audioLevel * 25}px rgba(0,212,255,${0.2 + audioLevel * 0.35})`,
          }}
        >
          <div
            className="rounded-full transition-all duration-100"
            style={{
              width:   Math.max(6, 6 + audioLevel * 18),
              height:  Math.max(6, 6 + audioLevel * 18),
              background: `radial-gradient(circle, ${coreColor} 0%, transparent 70%)`,
              opacity: 0.35 + audioLevel * 0.65,
            }}
          />
        </div>
      </button>

      <div className="text-center">
        <p className="text-[10px] font-bold tracking-[0.3em] text-[#4a7a9b]">F.R.I.D.A.Y</p>
        <p
          className="text-[9px] mt-0.5"
          style={{ color: isListening ? "#00ff88" : isSpeaking ? "#00d4ff" : "#364c61" }}
        >
          {isListening ? "Listening…" : isSpeaking ? "Speaking…" : state === "thinking" ? "Thinking…" : "Active"}
        </p>
      </div>

      {lines.length > 0 && (
        <div
          className="w-full overflow-y-auto px-3 py-2 bg-[#060e1c] rounded-xl border border-[#1a3a5c] text-left"
          style={{ maxHeight: 100 }}
        >
          {lines.map((l, i) => (
            <p
              key={l.id}
              className={`text-[10px] leading-relaxed ${
                i === lines.length - 1 ? "text-white" : "text-[#4a7a9b]"
              }`}
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
