# Voice Panel Live Transcript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-empty `useChat()` transcript with a live bidirectional conversation view showing user speech (right, teal) and Friday's replies (left, violet), word-by-word as each side speaks.

**Architecture:** `PanelContent` in `VoicePanel.tsx` currently calls `useChat()` which only captures text-channel messages — the voice agent never sends those, so the transcript area is always blank. The fix swaps to `agentTranscriptions` from `useVoiceAssistant()` (Friday's side, already in the hook) and adds `useTrackTranscription` on the local mic publication (user's side). Both return `ReceivedTranscriptionSegment[]` with a `final` flag; non-final segments render with a blinking cursor, final segments lock in as permanent bubbles sorted by `startTime`.

**Tech Stack:** Next.js 14+, `@livekit/components-react@^2.0.0`, `livekit-client@^2.0.0`, TypeScript, inline React styles

---

## File Map

| Action | File |
|--------|------|
| Modify | `FridayV2/frontend/components/VoicePanel.tsx` (entire `PanelContent` function, lines 1–94) |

No other files touched. No backend changes.

---

### Task 1: Update imports at the top of VoicePanel.tsx

**Files:**
- Modify: `FridayV2/frontend/components/VoicePanel.tsx:1-11`

- [ ] **Step 1: Replace the import block**

Open `FridayV2/frontend/components/VoicePanel.tsx`. Replace lines 1–11 (everything from `"use client"` through the closing `}` of the `@livekit/components-react` import) with:

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  VoiceAssistantControlBar,
  useLocalParticipant,
  useTrackTranscription,
} from "@livekit/components-react";
import { Track } from "livekit-client";
```

Key changes from original:
- Added `useRef`, `useEffect` to React imports
- Added `useLocalParticipant`, `useTrackTranscription` to livekit imports
- Removed `useChat`
- Added `Track` import from `livekit-client`

- [ ] **Step 2: Verify TypeScript sees no import errors**

```bash
cd FridayV2/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: either clean output or errors only about the `PanelContent` body (not the imports). Import errors would look like `Module '"@livekit/components-react"' has no exported member 'useTrackTranscription'` — if you see that, the installed version differs; run `npm ls @livekit/components-react` to confirm it's `^2.0.0`.

---

### Task 2: Rewrite the PanelContent function

**Files:**
- Modify: `FridayV2/frontend/components/VoicePanel.tsx:13-94`

This replaces the entire `PanelContent` function (lines 13–94 in the original). The outer `VoicePanel` component (lines 96–196) is **not touched**.

- [ ] **Step 1: Replace PanelContent**

Replace the `function PanelContent` block (lines 13–94) with the following complete implementation:

```tsx
function PanelContent({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();

  const stateColors: Record<string, string> = {
    listening: "var(--cyan)",
    thinking: "var(--violet)",
    speaking: "var(--orange)",
  };
  const stateColor = stateColors[state] ?? "var(--text-3)";

  const stateLabel: Record<string, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting…",
    initializing: "Initializing…",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
  };

  // Resolve local mic track for user transcription
  const micPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
  const localMicRef = micPub && localParticipant
    ? { participant: localParticipant, publication: micPub, source: Track.Source.Microphone as const }
    : undefined;
  const { segments: userSegments } = useTrackTranscription(localMicRef);

  // Build unified turn list
  type Turn = { id: string; from: "user" | "friday"; text: string; startTime: number };

  const finalTurns: Turn[] = [
    ...agentTranscriptions
      .filter(s => s.final)
      .map(s => ({ id: s.id, from: "friday" as const, text: s.text, startTime: s.startTime })),
    ...userSegments
      .filter(s => s.final)
      .map(s => ({ id: s.id, from: "user" as const, text: s.text, startTime: s.startTime })),
  ].sort((a, b) => a.startTime - b.startTime);

  const liveAgentTurn = agentTranscriptions.find(s => !s.final);
  const liveUserTurn  = userSegments.find(s => !s.final);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalTurns.length, liveAgentTurn?.text, liveUserTurn?.text]);

  const isEmpty = finalTurns.length === 0 && !liveAgentTurn && !liveUserTurn;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`@keyframes friday-blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>

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
            {stateLabel[state] ?? state}
          </span>
        </div>
        <button onClick={onDisconnect} className="btn-icon" style={{ fontSize: 11 }}>✕</button>
      </div>

      {/* Transcript */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {isEmpty ? (
          <p style={{ color: "var(--text-3)", fontSize: 12, textAlign: "center", marginTop: 20, fontFamily: "var(--font-mono)" }}>
            Speak to begin…
          </p>
        ) : (
          <>
            {finalTurns.map(turn => (
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
                      background: "#a78bfa",
                      marginLeft: 2,
                      verticalAlign: "middle",
                      animation: "friday-blink 0.9s step-end infinite",
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "#6b4fa8", fontFamily: "var(--font-mono)", paddingLeft: 4 }}>
                  Friday speaking…
                </span>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Visualizer + Controls */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)" }}>
        <div style={{ height: 36, marginBottom: 8 }}>
          <BarVisualizer state={state} trackRef={audioTrack} barCount={20} style={{ width: "100%", height: "100%" }} />
        </div>
        <VoiceAssistantControlBar />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check — expect clean**

```bash
cd FridayV2/frontend
npx tsc --noEmit 2>&1 | head -40
```

Expected: no output (clean). If you see `Property 'startTime' does not exist on type 'ReceivedTranscriptionSegment'`, the `livekit-client` version installed uses a different field name — run `grep -r "startTime\|firstReceivedTime" node_modules/livekit-client/dist/src/room/types.d.ts` and replace `s.startTime` with whichever field exists.

- [ ] **Step 3: Commit**

```bash
cd FridayV2/frontend
git add components/VoicePanel.tsx
git commit -m "feat: live bidirectional transcript in voice panel"
```

---

### Task 3: Visual verification

**Files:** none (read-only verification)

- [ ] **Step 1: Start dev server**

```bash
cd FridayV2/frontend
npm run dev
```

Open the app in your browser. Click "Talk to Friday" to open the voice panel.

- [ ] **Step 2: Verify idle state**

With the panel open but before speaking, confirm "Speak to begin…" is still visible in the middle area.

- [ ] **Step 3: Verify your speech appears**

Say something. Confirm:
- A teal bubble appears on the **right** as you speak, words building up
- A blinking `▌` cursor is visible at the end of the in-progress text
- The cursor disappears and the bubble locks in when you stop speaking

- [ ] **Step 4: Verify Friday's reply appears**

After Friday responds, confirm:
- A violet bubble appears on the **left**, words building up as she speaks
- A "Friday speaking…" label appears beneath the live bubble
- Both cursor and label disappear once she finishes

- [ ] **Step 5: Verify conversation history**

After a back-and-forth exchange, scroll up to confirm earlier messages are preserved and correctly interleaved (your turns right, Friday's left, in time order).
