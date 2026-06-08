"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  VoiceAssistantControlBar,
  useLocalParticipant,
  useTrackTranscription,
} from "@livekit/components-react";
import FridayOrb from "./FridayOrb";
import { Track } from "livekit-client";

// ─── Module-scope types and constants ────────────────────────────────────────

type Turn = { id: string; from: "user" | "friday"; text: string; startTime: number };

const STATE_COLORS: Record<string, string> = {
  listening: "var(--cyan)",
  thinking: "var(--violet)",
  speaking: "var(--orange)",
};

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

// ─────────────────────────────────────────────────────────────────────────────

function PanelContent({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, agentTranscriptions } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();

  const stateColor = STATE_COLORS[state] ?? "var(--text-3)";

  // Resolve local mic track for user transcription
  const micPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
  const localMicRef = micPub && localParticipant
    ? { participant: localParticipant, publication: micPub, source: Track.Source.Microphone as const }
    : undefined;
  // useTrackTranscription is @deprecated; migrate to useTranscriptions() when the library ships a replacement that surfaces non-final segments
  const { segments: userSegments } = useTrackTranscription(localMicRef);

  // Accumulate final turns — agentTranscriptions is a rolling buffer and drops old entries
  const [turnHistory, setTurnHistory] = useState<Turn[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newFinals: Turn[] = [
      ...agentTranscriptions
        .filter(s => s.final && !seenIdsRef.current.has(s.id))
        .map(s => ({ id: s.id, from: "friday" as const, text: s.text, startTime: s.startTime })),
      ...userSegments
        .filter(s => s.final && !seenIdsRef.current.has(s.id))
        .map(s => ({ id: s.id, from: "user" as const, text: s.text, startTime: s.startTime })),
    ];
    if (newFinals.length > 0) {
      newFinals.forEach(t => seenIdsRef.current.add(t.id));
      setTurnHistory(prev => [...prev, ...newFinals].sort((a, b) => a.startTime - b.startTime));
    }
  }, [agentTranscriptions, userSegments]);

  const liveAgentTurn = agentTranscriptions.find(s => !s.final);
  const liveUserTurn  = userSegments.find(s => !s.final);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turnHistory.length, liveAgentTurn?.text, liveUserTurn?.text]);

  const isEmpty = turnHistory.length === 0 && !liveAgentTurn && !liveUserTurn;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{
          fontFamily: "var(--font-space)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--cyan)",
          letterSpacing: "0.1em",
        }}>FRIDAY</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: stateColor, boxShadow: `0 0 6px ${stateColor}` }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {STATE_LABELS[state] ?? state}
          </span>
        </div>
        <button onClick={onDisconnect} className="btn-icon" style={{ fontSize: 11 }}>✕</button>
      </div>

      {/* Orb */}
      <div style={{
        height: 180,
        flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at center, rgba(34,211,238,0.04) 0%, transparent 70%)",
        overflow: "hidden",
      }}>
        <FridayOrb state={state} width={320} height={180} />
      </div>

      {/* Transcript */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {isEmpty ? (
          <p style={{ color: "var(--text-3)", fontSize: 12, textAlign: "center", marginTop: 20, fontFamily: "var(--font-mono)" }}>
            Speak to begin…
          </p>
        ) : (
          <>
            {turnHistory.map(turn => (
              <div key={turn.id} style={{ display: "flex", justifyContent: turn.from === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%",
                  padding: "8px 12px",
                  borderRadius: turn.from === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: turn.from === "user" ? "var(--cyan-dim)" : "rgba(167,139,250,0.1)",
                  border: `1px solid ${turn.from === "user" ? "rgba(34,211,238,0.2)" : "rgba(167,139,250,0.2)"}`,
                  color: "var(--text-1)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  {turn.text}
                </div>
              </div>
            ))}

            {liveUserTurn && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{
                  maxWidth: "82%",
                  padding: "8px 12px",
                  borderRadius: "12px 12px 2px 12px",
                  background: "var(--cyan-dim)",
                  border: "1px solid rgba(34,211,238,0.35)",
                  color: "var(--text-1)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  {liveUserTurn.text}
                  <span style={{
                    display: "inline-block",
                    width: 2,
                    height: "1em",
                    background: "var(--cyan)",
                    marginLeft: 2,
                    verticalAlign: "middle",
                    animation: "friday-blink 0.9s step-end infinite",
                  }} />
                </div>
              </div>
            )}

            {liveAgentTurn && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{
                    maxWidth: "82%",
                    padding: "8px 12px",
                    borderRadius: "12px 12px 12px 2px",
                    background: "rgba(167,139,250,0.15)",
                    border: "1px solid rgba(167,139,250,0.35)",
                    color: "var(--text-1)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}>
                    {liveAgentTurn.text}
                    <span style={{
                      display: "inline-block",
                      width: 2,
                      height: "1em",
                      background: "var(--violet)",
                      marginLeft: 2,
                      verticalAlign: "middle",
                      animation: "friday-blink 0.9s step-end infinite",
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "var(--violet)", opacity: 0.7, fontFamily: "var(--font-mono)", paddingLeft: 4 }}>
                  Friday speaking…
                </span>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Controls */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
        <VoiceAssistantControlBar />
      </div>
    </div>
  );
}

export default function VoicePanel() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "";

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/livekit-token");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToken(data.token);
      setOpen(true);
    } catch (err) {
      console.error("[VoicePanel] connect error:", err);
      alert("Could not connect to Friday. Check console for details.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setToken(null);
    setOpen(false);
  }, []);

  return (
    <>
      {!open && (
        <button
          onClick={connect}
          disabled={connecting}
          style={{
            position: "fixed",
            bottom: 28,
            right: 28,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 22px",
            background: "linear-gradient(135deg, var(--cyan) 0%, var(--violet) 100%)",
            color: "var(--bg-base)",
            fontFamily: "var(--font-space)",
            fontWeight: 600,
            fontSize: 13,
            border: "none",
            borderRadius: 100,
            cursor: "pointer",
            boxShadow: "0 4px 24px rgba(34,211,238,0.25)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(34,211,238,0.35)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(34,211,238,0.25)";
          }}
        >
          {connecting ? "Connecting…" : "🎙 Talk to Friday"}
        </button>
      )}

      {open && token && (
        <div
          className="glass"
          style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            zIndex: 50,
            width: 320,
            height: 620,
            borderTopLeftRadius: 20,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 -8px 48px rgba(34,211,238,0.12)",
            overflow: "hidden",
          }}
        >
          <LiveKitRoom
            token={token}
            serverUrl={livekitUrl}
            connect
            audio
            onDisconnected={disconnect}
            style={{ display: "contents" }}
          >
            <RoomAudioRenderer />
            <PanelContent onDisconnect={disconnect} />
          </LiveKitRoom>
        </div>
      )}
    </>
  );
}
