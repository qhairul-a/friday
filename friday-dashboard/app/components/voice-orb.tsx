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
      if (!res.ok) throw new Error(data.error ?? "Could not connect.");
      setToken(data.token);
      setUrl(data.url);
      setOrbState("connected");
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Connection timed out. Is the agent worker running?"
          : err instanceof Error
          ? err.message
          : "Could not connect. Is the agent running?";
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

// ── Idle / Connecting orb ────────────────────────────────────────────────────

function IdleOrb({ state, onConnect, error }: { state: OrbState; onConnect: () => void; error: string }) {
  const isConnecting = state === "connecting";
  const particleState: ParticleState = isConnecting ? "connecting" : "idle";

  return (
    <div className="flex flex-col items-center gap-8">
      <button
        onClick={onConnect}
        disabled={isConnecting}
        className="relative flex items-center justify-center cursor-pointer disabled:cursor-wait group"
        style={{ width: 280, height: 280 }}
      >
        {/* Particle cloud background */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ParticleOrb size={280} state={particleState} />
        </div>

        {/* Dark orb core — sits above particles */}
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
            <div className="flex gap-0.5 items-end h-6">
              {[3, 5, 8, 5, 3].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-[#00d4ff] rounded-full opacity-40"
                  style={{ height: h * 2, animation: `pulse ${1.5 + i * 0.2}s ease-in-out infinite` }}
                />
              ))}
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

// ── Connected orb ────────────────────────────────────────────────────────────

function ConnectedOrb({ onDisconnect, onTimeout }: { onDisconnect: () => void; onTimeout: () => void }) {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();

  const stateRef = useRef(state);
  stateRef.current = state;

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
        // Focus on voice-range frequencies (lower half of bins)
        const slice = data.slice(0, 64);
        const avg   = slice.reduce((a, b) => a + b, 0) / slice.length;
        setAudioLevel(Math.min(avg / 100, 2));
        raf = requestAnimationFrame(tick);
      }
      tick();
    } catch {
      // AudioContext blocked (e.g. autoplay policy) — degrade silently
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

  // ── Agent timeout ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      const s = stateRef.current;
      if (s !== "listening" && s !== "thinking" && s !== "speaking") onTimeout();
    }, 30000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived visuals ───────────────────────────────────────────────────────
  const isListening = state === "listening";
  const isSpeaking  = state === "speaking";
  const coreColor   = isListening ? "#00ff88" : "#00d4ff";
  const coreGlow    = isListening
    ? `0 0 ${30 + audioLevel * 40}px rgba(0,255,136,${0.25 + audioLevel * 0.35})`
    : `0 0 ${30 + audioLevel * 40}px rgba(0,212,255,${0.25 + audioLevel * 0.35})`;

  const statusLabel: Record<string, string> = {
    connecting:   "Connecting…",
    initializing: "Initializing…",
    listening:    "Listening…",
    thinking:     "Thinking…",
    speaking:     "Speaking…",
  };

  // Map LiveKit state → ParticleState (same strings, TypeScript just needs the cast)
  const particleState = (
    ["connecting","initializing","listening","thinking","speaking"].includes(state)
      ? state
      : "thinking"
  ) as ParticleState;

  return (
    <div className="flex flex-col items-center gap-8">
      <button
        onClick={onDisconnect}
        className="relative flex items-center justify-center cursor-pointer group"
        style={{ width: 280, height: 280 }}
        title="Click to end session"
      >
        {/* Particle cloud */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ParticleOrb size={280} state={particleState} audioLevel={audioLevel} />
        </div>

        {/* Dark orb core — pulsing inner glow driven by audio */}
        <div
          className="relative z-10 rounded-full flex items-center justify-center transition-all duration-150"
          style={{
            width: 130,
            height: 130,
            background: "radial-gradient(circle at 35% 35%, #0d2a3a, #050b14)",
            border: `1px solid ${coreColor}`,
            boxShadow: coreGlow,
          }}
        >
          {/* Audio-reactive inner pulse dot */}
          <div
            className="rounded-full transition-all duration-100"
            style={{
              width:   Math.max(8, 8 + audioLevel * 28),
              height:  Math.max(8, 8 + audioLevel * 28),
              background: `radial-gradient(circle, ${coreColor} 0%, transparent 70%)`,
              opacity: 0.35 + audioLevel * 0.65,
            }}
          />
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
          <div
            className="w-80 overflow-y-auto mt-3 px-3 py-2 bg-[#060e1c] rounded-xl border border-[#1a3a5c] text-left"
            style={{ maxHeight: 100 }}
          >
            {lines.map((l, i) => (
              <p
                key={l.id}
                className={`text-[11px] leading-relaxed ${
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
    </div>
  );
}
