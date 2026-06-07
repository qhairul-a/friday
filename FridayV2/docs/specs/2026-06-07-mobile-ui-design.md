# Friday Mobile UI/UX Design Spec

**Date:** 2026-06-07  
**Status:** Approved

---

## 1. Overview

Friday's mobile experience centres the **orb** — the full-screen animated visual that represents Friday's conversational state. Everything else (data panels, navigation, settings) lives behind a swipe-up drawer so it never disrupts the primary voice interaction.

---

## 2. Layout Architecture

### Two-layer model

| Layer | What it contains | Z-order |
|-------|-----------------|---------|
| **Orb layer** | Canvas orb, header controls, home-screen mic/session controls | bottom |
| **Panel layer** | Frosted-glass full-panel drawer with tab navigation | top |

The orb is always running and always visible. The panel slides over it — the orb glows behind the frosted glass — so switching tabs or scrolling data never interrupts Friday.

### Screen stack (single route, no page navigation)

```
MobileHome (root)
├── OrbCanvas          ← always mounted, never unmounted
├── MobileHeader       ← always visible (FRIDAY wordmark + icon buttons)
├── HomeControls       ← visible only when panel is closed
│   ├── MicButton
│   └── EndSessionPill
└── SlidePanel         ← mounts over orb, orb still renders behind
    ├── DragHandle
    ├── TabBar          [Overview | Plans | Finance | Fitness | Notes]
    ├── TabContent      ← swaps content, does NOT remount OrbCanvas
    └── FloatingControls
        ├── MicButton
        └── EndSessionPill
```

---

## 3. Home Screen (Panel Closed)

The default view when Friday is active.

- **Orb** fills the screen edge-to-edge (full viewport canvas)
- **Header** sits at the top with FRIDAY wordmark left, icon buttons right
- **MicButton** centred below the orb (42px circle, cyan border)
- **End Session pill** below the mic button (red-tinted, `rgba(248,113,113,0.15)`)
- Swipe up anywhere on the orb → panel slides up to cover ~86% of screen

### Disconnected state

When no LiveKit session is active:

- Orb is fully dimmed / grey (disconnected state animation)
- MicButton hidden
- EndSession hidden
- **"Start Session"** button centred on screen (cyan filled, rounded pill)
- Tapping Start Session initiates LiveKit connection → orb transitions to idle

---

## 4. Slide Panel

### Geometry

```
top: 56px          ← leaves header visible behind panel
bottom: 0
border-radius: 22px 22px 0 0
background: rgba(8, 12, 28, 0.88)
backdrop-filter: blur(32px) saturate(1.5)
border-top: 1px solid rgba(34, 211, 238, 0.2)
```

The orb canvas renders behind the panel at all times — the frosted glass lets the glow bleed through.

### Opening / closing

- **Swipe up** on home screen → panel slides up
- **Swipe down** on panel (from drag-handle area) → panel closes, home controls reappear
- Panel open/close does not affect orb state, mic state, or LiveKit session

### Drag handle

36 × 3px pill, centred at the top of the panel. Tapping it also toggles open/closed.

---

## 5. Tab Navigation

Five tabs inside the panel. Switching tabs does not re-mount the orb or affect audio.

| Tab | Icon | Content |
|-----|------|---------|
| Overview | ⬡ | Key widgets: tasks, weather, upcoming events |
| Plans | ◷ | Productivity / routines view |
| Finance | ◈ | Balances, expenses, savings (SGD) |
| Fitness | ♡ | Health metrics, workout log |
| Notes | ◱ | Quick notes / voice-to-text log |

Tab bar is horizontally scrollable, `overflow-x: auto`, no scrollbar shown.

---

## 6. Header Controls

Always visible — both on the home screen and visible above the panel when panel is open.

```
[FRIDAY]                    [👁  ⚙]
  wordmark                  action icons
```

### Finance visibility toggle (👁)

Masks all monetary values across the Finance tab with `SGD ••••`.

| State | Appearance | Meaning |
|-------|-----------|---------|
| Visible | Orange circle, `rgba(251,191,36,0.1)` border, 👁 | Figures showing |
| Hidden | Grey circle, `rgba(71,85,105,0.35)` border, 🙈 | Figures masked |
| Other tab active | Dimmed orange (30% opacity) | Tappable but not in effect |

**Behaviour:**
- Tapping toggles immediately, no confirmation
- State persists to `localStorage` key `friday_finance_hidden`
- Applies to all monetary values: balances, expenses, income, savings, net worth
- Masked format: `SGD ••••` (category labels remain readable)
- Toggle is always in the header on every screen so user can pre-set before switching to Finance tab

### Settings button (⚙)

Cyan circle, `rgba(34,211,238,0.1)` background. Tapping slides up a settings bottom sheet.

#### Settings sheet

```
┌──────────────────────────────┐
│  ▬▬▬  (drag pill)            │
│  SETTINGS                    │
│  ○ Friday's Memory      ›    │
│  ○ Overview Widgets     ›    │
│  ○ Appearance           ›    │
│  ─────────────────────────   │
│  ⏻  Sign Out                 │
└──────────────────────────────┘
```

- Sheet slides up over the panel (or home screen) with `border-radius: 22px 22px 0 0`
- Background behind sheet dims to 30% opacity
- Swipe down or tap outside → sheet dismisses
- **Sign Out** is at the bottom, red-tinted (`#f87171`), no extra confirmation dialog (one tap = signed out, consistent with mobile patterns)

---

## 7. Orb States

The `FridayOrb` component (`components/FridayOrb.tsx`) drives all states. State is controlled by the LiveKit session lifecycle — the mobile layout passes the same `state` prop as the desktop.

| State | Visual | When |
|-------|--------|------|
| `disconnected` | Fully dimmed, grey particles | No session active |
| `idle` | Gentle cyan breathing glow, free-drift particles | Session active, no speech |
| `listening` | Bright cyan + waveform ring | User speaking (VAD active) |
| `thinking` | Violet pulse | LLM generating response |
| `speaking` | Orange colour blend, particles orbit in rings | Friday speaking |
| `muted` | Dimmed cyan, static | User has manually muted mic |

---

## 8. Mic Behaviour

**The mic is NEVER auto-muted by Friday.** User has full control at all times.

| Mic state | MicButton appearance | What happens |
|-----------|---------------------|-------------|
| Live | Cyan border, filled | User can speak anytime |
| Muted (user) | Grey border, dimmed | Friday ignores audio input |

- When Friday is **speaking** and the user speaks: Friday stops, orb transitions to `listening`
- MicButton label: `"speak to respond"` during Friday's speaking state (not "muted")
- Mic button is present in **both** home controls (below orb) and floating controls inside the panel

---

## 9. Floating Controls (Panel Open)

When the panel is open, the home-screen mic and End Session controls are replaced by a floating action cluster in the **bottom-right corner** of the panel.

```
┌──────────────────────────┐
│   tab content area       │
│                          │
│              [ ⏻ End  ] │  ← EndSession pill
│              [   🎤   ] │  ← MicButton (42px circle)
└──────────────────────────┘
```

- Both controls float above the tab content with `position: fixed` within the panel
- Same visual style as home-screen controls
- MicButton: 42px circle, cyan border (live) / grey (muted)
- EndSession pill: `rgba(248, 113, 113, 0.15)` background, `#f87171` text

---

## 10. Session Lifecycle

```
[Disconnected]
     │ tap "Start Session"
     ▼
[Connecting / Initializing]  ← orb shows connecting animation
     │ LiveKit connected
     ▼
[Idle]  ← orb breathes gently
     │ user speaks
     ▼
[Listening]  ← orb brightens, waveform
     │ user stops speaking
     ▼
[Thinking]  ← orb pulses violet
     │ Friday responds
     ▼
[Speaking]  ← orb orange, user can interrupt anytime
     │ Friday finishes (or user speaks over)
     ▼
[Idle]  ← loop continues
     │
     │ user taps "End Session"
     ▼
[Disconnected]  ← orb dims, "Start Session" button appears
```

---

## 11. CSS Design Tokens (mobile-specific)

These match the existing desktop tokens:

```css
--cyan: #22d3ee
--violet: #a78bfa
--orange: #fbbf24
--red: #f87171
--bg-base: #07091f
--text-1: #f0f9ff
--text-2: #94a3b8
--text-3: #475569

/* Panel glass */
--panel-bg: rgba(8, 12, 28, 0.88)
--panel-blur: blur(32px) saturate(1.5)
--panel-border: rgba(34, 211, 238, 0.2)
```

---

## 12. Out of Scope

- Onboarding / first-launch flow
- Push notifications
- Biometric lock for finance figures
- Landscape orientation support
- Tablet layout

These can be addressed in follow-up specs.
