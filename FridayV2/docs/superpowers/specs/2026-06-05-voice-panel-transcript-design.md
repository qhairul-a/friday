# Voice Panel — Live Bidirectional Transcript

**Date:** 2026-06-05  
**File:** `FridayV2/frontend/components/VoicePanel.tsx`  
**Scope:** `PanelContent` component only — no backend changes required

---

## Problem

The panel's transcript area always shows "Speak to begin…" even during active conversation. The current `useChat()` hook captures text-channel messages only; the Friday voice agent communicates exclusively via LiveKit's voice assistant transcription protocol, so `chatMessages` is always empty.

---

## Goal

Show both sides of the conversation — user speech (STT) and Friday's replies — word-by-word as they are spoken, inside the existing transcript area of `PanelContent`.

---

## Design

### Layout

- **User utterances** — right-aligned bubble, teal border (`rgba(0,212,255,0.2)`), teal background tint
- **Friday utterances** — left-aligned bubble, violet border (`rgba(167,139,250,0.2)`), violet background tint
- Conversation scrolls chronologically, newest at the bottom, auto-scrolls on new content

### Live (word-by-word) Behaviour

Each side has a "current" in-progress segment (non-final) and a list of completed segments (final):

| State | Display |
|-------|---------|
| Non-final segment exists | Live bubble with blinking cursor `▌` at end of text |
| Friday is the live speaker | Small "Friday speaking…" label beneath the live bubble |
| Segment becomes `final` | Cursor removed, bubble locked in, label disappears |
| No segments yet | "Speak to begin…" placeholder (existing copy) |

### Data Sources

| Side | Hook | Notes |
|------|------|-------|
| Friday | `useVoiceAssistant().agentTranscriptions` | Already imported; includes non-final segments |
| User | `useTrackTranscription(localMicTrack)` | New; `localMicTrack` resolved from `useLocalParticipant()` |

Both hooks return `ReceivedTranscriptionSegment[]` with identical shape (`id`, `text`, `final`, `startTime`).

### Unified Message Model

```ts
type Turn = {
  id: string;
  from: 'user' | 'friday';
  text: string;
  final: boolean;
  startTime: number;
};
```

Build the list by:
1. Tagging each `agentTranscription` segment as `from: 'friday'`
2. Tagging each `userSegment` as `from: 'user'`
3. Separating final turns (locked history) from the latest non-final turn per side (live bubble)
4. Sorting final turns by `startTime` to interleave user/friday correctly

### Hook Deprecation Note

`useTrackTranscription` is marked `@deprecated` in `@livekit/components-react@2` with a note to use `useTranscription` instead — but that hook does not exist in the installed version. The only available alternative, `useTranscriptions` (plural), returns `TextStreamData[]` which does not carry the `final` flag needed for streaming. `useTrackTranscription` remains the correct choice until the library ships the replacement.

### Resolving the Local Mic Track

```ts
const { localParticipant } = useLocalParticipant();
const micPublication = localParticipant?.getTrackPublication(Track.Source.Microphone);
const localMicTrackRef = micPublication
  ? { participant: localParticipant, publication: micPublication, source: Track.Source.Microphone }
  : undefined;
const { segments: userSegments } = useTrackTranscription(localMicTrackRef);
```

`useTrackTranscription` accepts `undefined` gracefully (returns empty segments).

---

## Changes Required

**`FridayV2/frontend/components/VoicePanel.tsx` — `PanelContent` only:**

1. Remove `useChat` import and `chatMessages` usage
2. Destructure `agentTranscriptions` from `useVoiceAssistant()` (add to existing destructure)
3. Add `useLocalParticipant` and `useTrackTranscription` imports
4. Add `Track` import from `livekit-client`
5. Build `localMicTrackRef` from local participant
6. Call `useTrackTranscription(localMicTrackRef)` → `userSegments`
7. Derive `finalTurns`, `liveAgentTurn`, `liveUserTurn` from both segment arrays
8. Replace the `chatMessages.length === 0 ? ... : chatMessages.map(...)` render block with the new unified turn list

No changes to `VoicePanel` (outer component), `LiveKitRoom` setup, `BarVisualizer`, `VoiceAssistantControlBar`, or any backend file.

---

## Edge Cases

- **Mic not yet published:** `localMicTrackRef` is `undefined` → `useTrackTranscription` returns `[]` → only Friday's side shows until mic is ready
- **Rapid back-to-back segments:** same-`id` segment updated in-place (LiveKit sends same `id` with updated `text` until `final: true`)
- **Both live at once:** unlikely (push-to-talk not used), but handled — both live bubbles can render simultaneously
- **Auto-scroll:** `useRef` on a bottom sentinel, scroll on any change to `finalTurns`, `liveAgentTurn`, or `liveUserTurn`

---

## Out of Scope

- Backend changes
- `voice-orb-mini.tsx` (separate component, separate improvement)
- Message persistence across sessions
- Copy/export of transcript
