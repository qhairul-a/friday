# FridayOrb Particle Motion Redesign

**Date:** 2026-06-06
**Component:** `FridayV2/frontend/components/FridayOrb.tsx`
**Status:** Approved

---

## Goal

Replace the current orbital-only particle motion with a two-mode system:

- **Idle / all non-speaking states** — particles are digital pixel squares that drift freely in any direction, bouncing off the spherical boundary wall and off each other. No orbiting.
- **Speaking state** — particles smoothly transition into a synchronized anti-clockwise orbit from wherever they currently are, then return to free drift when speaking ends.

---

## Particle Appearance

Particles are rendered as **square pixels** (not circles), snapped to the nearest integer coordinate for a crisp digital look.

| Property | Value |
|---|---|
| Shape | `fillRect` square, pixel-grid-snapped |
| Sizes | 2×2, 3×3, or 4×4 px, randomly assigned per particle |
| Center highlight | 1×1 white dot on pixels ≥ 3px (lit LED feel) |
| Drop shadow | 1px offset below-right at 15% opacity (depth cue) |
| Flicker | ~30% of particles randomly dim to 15% opacity for 1-2 frames, each at a unique phase offset |
| Scanline overlay | Horizontal lines every 2px at 6% black opacity over the whole canvas (CRT texture) |
| Glow | Soft radial gradient at center, minimal — so pixel shapes remain legible |

---

## Idle Physics (Free Drift)

Each particle has a constant speed assigned at init. Physics runs every frame:

1. **Move** — `fx += vx * dt`, `fy += vy * dt`
2. **Boundary bounce** — circular wall at radius `WALL_R`. When `dist(particle, center) ≥ WALL_R`, reflect the outward velocity component. Restore speed exactly to the particle's assigned `spd` after bounce (no momentum gain).
3. **Particle–particle collision** — O(n²) loop over ring particles (dust passes through). When two particles overlap (`dist < COL_R * 2`), perform an equal-mass elastic collision: exchange velocity components along the collision normal, then restore each particle's speed to its assigned `spd` (no energy creep).

**No damping. No wander force. No center spring.** Particles travel at constant speed in straight lines until something deflects them.

### Constants (idle)

| Constant | Value | Purpose |
|---|---|---|
| `WALL_R` | 88px | Spherical boundary radius |
| `COL_R` | 6px | Effective collision radius per particle |
| `PARTICLE_SPD` | 0.38 px/frame | Ring particle speed (constant) |
| Dust speed | `PARTICLE_SPD × 0.45` | Dust moves slower |

---

## Speaking Physics (Orbit)

When state transitions to `"speaking"`:

1. **Sync theta** — on the first frame of speaking, set each particle's `theta = atan2(fy - cy, fx - cx)`. This captures their current angle from center so orbit begins from exactly where they are.
2. **Blend in orbit** — `speakBlend` lerps from 0 → 1 at `LERP_RATE = 0.04`. Each frame:
   - `p.theta -= ORBIT_SPEED * speakBlend * dt` (anti-clockwise; negative)
   - `orbitX = cx + orbitR * cos(theta)`
   - `orbitY = cy + orbitR * sin(theta)`
   - Rendered position: `x = fx*(1-speakBlend) + orbitX*speakBlend`
   - Free drift (`fx/fy`) continues updating in the background during the blend
3. **Blend out** — when speaking ends, `speakBlend` lerps back to 0 and particles resume from their current `fx/fy` drift position.

### Constants (speaking)

| Constant | Value | Purpose |
|---|---|---|
| `ORBIT_SPEED` | 0.028 rad/frame | Angular velocity when fully speaking |
| `LERP_RATE` | 0.04 | Transition speed (same as existing `LERP_RATE`) |
| `ORBIT_RADII` | [28, 54, 80]px | Ring radii (inner, mid, outer) |
| Orbit direction | Anti-clockwise (`theta -=`) | |
| Dust orbit speed | `× 0.45` | Dust orbits slower than ring particles |

---

## Particle Initialisation Changes

`initParticles()` needs to change from spherical-coordinate orbit particles to flat 2D drift particles:

**Current:** theta/phi/radius spherical coords, all particles orbit same direction.

**New:**
- `fx, fy` — 2D free drift position (spread uniformly within `WALL_R` via `sqrt(rand) * WALL_R` for uniform density)
- `vx, vy` — velocity vector at a random angle with magnitude `spd`
- `spd` — constant speed, preserved through bounces
- `theta` — orbital angle (written on speak-start, unused during idle)
- `orbitR` — assigned orbit ring radius
- `px` — pixel size (2, 3, or 4)
- `flickerPhase`, `flickerRate` — per-particle flicker timing

Dust particles: same structure, lower speed, pass through other particles, smaller pixels.

---

## State Colour

- **Idle / non-speaking:** cyan (`[34, 211, 238]`) with violet (`[167, 139, 250]`) accent
- **Speaking:** lerps to orange (`[251, 191, 36]`) as `speakBlend` increases
- **Glow:** same lerp applied to the radial gradient centre colour

No changes to existing `STATE_TARGETS` lerp logic for `glowRadius` / `glowOpacity` — those continue to drive the glow sizing.

---

## 3D → 2D

The current implementation uses 3D spherical coordinates (theta, phi, radius) with a perspective projection and back-to-front depth sort for a sphere illusion. This redesign **drops the 3D projection entirely** — particles live in flat 2D canvas space. The depth-based `depthFactor` opacity/size scaling and `projected.sort()` are removed. The orb appearance is driven by the glow gradient and pixel flicker rather than simulated depth.

---

## What Does NOT Change

- Component API (`state`, `width`, `height` props) — unchanged
- State machine (`STATE_TARGETS`, `configRef`, `LERP_RATE`) — unchanged, still drives glow radius and opacity
- The `useEffect` / `requestAnimationFrame` scaffolding (setup, cleanup, `isRunningRef`) — unchanged
- The loop structure inside `drawFrame` stays; its body is replaced
- All non-speaking states (connecting, thinking, listening, etc.) use idle drift physics

---

## Scope

Single file: `FridayV2/frontend/components/FridayOrb.tsx`

The `Particle` interface, `initParticles()`, and the draw loop body all change. Everything else stays.
