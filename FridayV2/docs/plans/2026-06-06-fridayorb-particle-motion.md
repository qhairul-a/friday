# FridayOrb Particle Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FridayOrb's 3D orbital particles with 2D digital pixel squares that bounce freely during idle and orbit anti-clockwise when Friday speaks.

**Architecture:** Single file rewrite. Drop 3D spherical projection entirely — particles live in flat 2D canvas space with billiard-ball physics (constant speed, elastic boundary + particle collisions). A `speakBlend` scalar (0→1, lerped at `LERP_RATE`) drives the smooth transition from free drift to anti-clockwise orbit. Existing glow/breath/burst logic from `configRef` is preserved unchanged.

**Tech Stack:** TypeScript, React (`useRef`, `useEffect`), HTML Canvas 2D API

---

### Task 1: Confirm baseline builds clean

**Files:**
- Run: `FridayV2/frontend/`

- [ ] **Step 1: Run the TypeScript build**

```bash
cd FridayV2/frontend
npm run build
```

Expected: build succeeds with no errors. If it fails, fix those errors before continuing — do not proceed past a broken baseline.

---

### Task 2: Rewrite `FridayV2/frontend/components/FridayOrb.tsx`

This is a complete file replacement. The component API (`state`, `width`, `height` props) and the `useEffect` scaffolding are preserved; everything inside them changes.

**Files:**
- Modify: `FridayV2/frontend/components/FridayOrb.tsx` (full rewrite)

- [ ] **Step 1: Replace the file with the implementation below**

Write the following complete file to `FridayV2/frontend/components/FridayOrb.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";

interface FridayOrbProps {
  state: string;
  width?: number;
  height?: number;
}

interface Particle {
  fx: number;          // free-drift x (always updated)
  fy: number;          // free-drift y (always updated)
  vx: number;          // x velocity
  vy: number;          // y velocity
  spd: number;         // constant speed magnitude — restored after every bounce/collision
  theta: number;       // orbital angle (synced from position when speaking starts)
  orbitR: number;      // orbit ring radius for this particle
  x: number;           // rendered x (blended between fx and orbit)
  y: number;           // rendered y
  px: number;          // pixel square size: 2, 3, or 4
  opacity: number;
  color: [number, number, number];
  flickerPhase: number;
  flickerRate: number;  // 0 = no flicker; >0 = dims every N*8 frames
  isDust: boolean;
}

interface OrbConfig {
  glowRadius: number;
  glowOpacity: number;
  burstAmp: number;
  burstFreq: number;
  breathAmp: number;
  breathFreq: number;
}

const CYAN:   [number, number, number] = [34,  211, 238];
const VIOLET: [number, number, number] = [167, 139, 250];
const ORANGE: [number, number, number] = [251, 191, 36];
const DIM:    [number, number, number] = [71,  85,  105];

// Physics
const COL_R        = 6;     // collision radius per ring particle (px)
const PARTICLE_SPD = 0.38;  // ring particle speed (px / 60fps frame)
const ORBIT_SPEED  = 0.028; // anti-clockwise orbital speed (rad / 60fps frame)
const PIXEL_SIZES  = [2, 2, 2, 3, 3, 4]; // weighted toward 2px

const LERP_RATE = 0.04;

const STATE_TARGETS: Record<string, OrbConfig> = {
  disconnected:            { glowRadius: 18, glowOpacity: 0.25, burstAmp: 0,    burstFreq: 0,     breathAmp: 0.04, breathFreq: 0.0005 },
  connecting:              { glowRadius: 26, glowOpacity: 0.35, burstAmp: 0.06, burstFreq: 0.002, breathAmp: 0.08, breathFreq: 0.0008 },
  initializing:            { glowRadius: 28, glowOpacity: 0.4,  burstAmp: 0.06, burstFreq: 0.002, breathAmp: 0.08, breathFreq: 0.001  },
  "pre-connect-buffering": { glowRadius: 28, glowOpacity: 0.4,  burstAmp: 0.06, burstFreq: 0.002, breathAmp: 0.08, breathFreq: 0.001  },
  idle:                    { glowRadius: 30, glowOpacity: 0.45, burstAmp: 0,    burstFreq: 0,     breathAmp: 0.10, breathFreq: 0.001  },
  listening:               { glowRadius: 34, glowOpacity: 0.5,  burstAmp: 0.08, burstFreq: 0.004, breathAmp: 0.12, breathFreq: 0.0015 },
  thinking:                { glowRadius: 38, glowOpacity: 0.55, burstAmp: 0.10, burstFreq: 0.006, breathAmp: 0.10, breathFreq: 0.002  },
  speaking:                { glowRadius: 52, glowOpacity: 0.7,  burstAmp: 0.28, burstFreq: 0.018, breathAmp: 0.15, breathFreq: 0.003  },
  failed:                  { glowRadius: 18, glowOpacity: 0.2,  burstAmp: 0,    burstFreq: 0,     breathAmp: 0.04, breathFreq: 0.0005 },
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function initParticles(cx: number, cy: number, wallR: number): Particle[] {
  const particles: Particle[] = [];
  const orbitRadii = [wallR * 0.31, wallR * 0.60, wallR * 0.90];
  const ringCounts = [12, 12, 10];

  for (let ri = 0; ri < 3; ri++) {
    for (let i = 0; i < ringCounts[ri]; i++) {
      const angle  = Math.random() * Math.PI * 2;
      // sqrt gives uniform area distribution instead of center-heavy
      const dist   = Math.sqrt(Math.random()) * (wallR - COL_R - 4);
      const vAngle = Math.random() * Math.PI * 2;
      particles.push({
        fx: cx + Math.cos(angle) * dist,
        fy: cy + Math.sin(angle) * dist,
        vx: Math.cos(vAngle) * PARTICLE_SPD,
        vy: Math.sin(vAngle) * PARTICLE_SPD,
        spd: PARTICLE_SPD,
        theta: angle,
        orbitR: orbitRadii[ri],
        x: cx, y: cy,
        px: PIXEL_SIZES[Math.floor(Math.random() * PIXEL_SIZES.length)],
        opacity: 0.65 + Math.random() * 0.35,
        color: Math.random() < 0.65 ? CYAN : VIOLET,
        flickerPhase: Math.floor(Math.random() * 60),
        flickerRate: Math.random() < 0.3 ? Math.floor(2 + Math.random() * 4) : 0,
        isDust: false,
      });
    }
  }

  const dustSpd = PARTICLE_SPD * 0.45;
  for (let i = 0; i < 14; i++) {
    const angle  = Math.random() * Math.PI * 2;
    const dist   = (0.70 + Math.random() * 0.35) * (wallR - 4);
    const vAngle = Math.random() * Math.PI * 2;
    particles.push({
      fx: cx + Math.cos(angle) * dist,
      fy: cy + Math.sin(angle) * dist,
      vx: Math.cos(vAngle) * dustSpd,
      vy: Math.sin(vAngle) * dustSpd,
      spd: dustSpd,
      theta: angle,
      orbitR: wallR * (0.85 + Math.random() * 0.18),
      x: cx, y: cy,
      px: 2,
      opacity: 0.20 + Math.random() * 0.25,
      color: Math.random() < 0.6 ? VIOLET : CYAN,
      flickerPhase: Math.floor(Math.random() * 60),
      flickerRate: 0,
      isDust: true,
    });
  }

  return particles;
}

export default function FridayOrb({ state, width = 320, height = 180 }: FridayOrbProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const particlesRef   = useRef<Particle[]>([]);
  const rafIdRef       = useRef<number>(0);
  const stateRef       = useRef<string>(state);
  const configRef      = useRef<OrbConfig>({ ...STATE_TARGETS["disconnected"] });
  const isRunningRef   = useRef(false);
  const speakBlendRef  = useRef(0);
  const wasSpeakingRef = useRef(false);
  const frameRef       = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    const cx    = width  / 2;
    const cy    = height / 2;
    const wallR = Math.min(cx, cy) * 0.92;

    particlesRef.current   = initParticles(cx, cy, wallR);
    configRef.current      = { ...(STATE_TARGETS[stateRef.current] ?? STATE_TARGETS["disconnected"]) };
    speakBlendRef.current  = 0;
    wasSpeakingRef.current = false;

    let lastTime = performance.now();
    isRunningRef.current = true;

    function drawFrame(now: number) {
      if (!isRunningRef.current) return;

      frameRef.current++;
      const rawDt = now - lastTime;
      lastTime = now;
      const dt = Math.min(rawDt, 50) / 16.67; // normalised to 60fps

      // ── Glow config lerp ──────────────────────────────────────────
      const target = STATE_TARGETS[stateRef.current] ?? STATE_TARGETS["disconnected"];
      const cfg    = configRef.current;
      cfg.glowRadius  = lerp(cfg.glowRadius,  target.glowRadius,  LERP_RATE);
      cfg.glowOpacity = lerp(cfg.glowOpacity, target.glowOpacity, LERP_RATE);
      cfg.burstAmp    = lerp(cfg.burstAmp,    target.burstAmp,    LERP_RATE);
      cfg.burstFreq   = lerp(cfg.burstFreq,   target.burstFreq,   LERP_RATE);
      cfg.breathAmp   = lerp(cfg.breathAmp,   target.breathAmp,   LERP_RATE);
      cfg.breathFreq  = lerp(cfg.breathFreq,  target.breathFreq,  LERP_RATE);

      // ── Speak blend ───────────────────────────────────────────────
      const isSpeaking  = stateRef.current === "speaking";
      const justStarted = isSpeaking && !wasSpeakingRef.current;
      if (justStarted) {
        // Sync each particle's orbital angle to its current drift position
        // so orbit begins from exactly where the particle already is.
        for (const p of particlesRef.current) {
          p.theta = Math.atan2(p.fy - cy, p.fx - cx);
        }
      }
      wasSpeakingRef.current = isSpeaking;
      speakBlendRef.current  = lerp(speakBlendRef.current, isSpeaking ? 1 : 0, LERP_RATE);
      const speakBlend = speakBlendRef.current;

      // ── Physics: move ─────────────────────────────────────────────
      for (const p of particlesRef.current) {
        p.fx += p.vx * dt;
        p.fy += p.vy * dt;
      }

      // ── Physics: boundary bounce ──────────────────────────────────
      for (const p of particlesRef.current) {
        const dx   = p.fx - cx;
        const dy   = p.fy - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const limit = wallR - (p.isDust ? 2 : COL_R);
        if (dist >= limit) {
          const nx  = dx / dist;
          const ny  = dy / dist;
          const dot = p.vx * nx + p.vy * ny;
          if (dot > 0) { p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; }
          // Push back inside boundary
          p.fx = cx + nx * (limit - 0.5);
          p.fy = cy + ny * (limit - 0.5);
          // Restore exact speed — no momentum gain from wall
          const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (spd > 0.001) { p.vx = (p.vx / spd) * p.spd; p.vy = (p.vy / spd) * p.spd; }
        }
      }

      // ── Physics: particle–particle elastic collision ───────────────
      const ps = particlesRef.current;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i], b = ps[j];
          if (a.isDust || b.isDust) continue; // dust passes through
          const dx = b.fx - a.fx;
          const dy = b.fy - a.fy;
          const d2 = dx * dx + dy * dy;
          const minD = COL_R * 2;
          if (d2 < minD * minD && d2 > 0.001) {
            const d  = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const relVn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (relVn > 0) { // only resolve if approaching
              a.vx -= relVn * nx; a.vy -= relVn * ny;
              b.vx += relVn * nx; b.vy += relVn * ny;
            }
            // Separate overlapping particles
            const ov = (minD - d) / 2 + 0.5;
            a.fx -= nx * ov; a.fy -= ny * ov;
            b.fx += nx * ov; b.fy += ny * ov;
            // Restore exact speeds — no energy creep
            const sA = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
            const sB = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
            if (sA > 0.001) { a.vx = (a.vx / sA) * a.spd; a.vy = (a.vy / sA) * a.spd; }
            if (sB > 0.001) { b.vx = (b.vx / sB) * b.spd; b.vy = (b.vy / sB) * b.spd; }
          }
        }
      }

      // ── Orbit blend: drift pos → orbital pos ──────────────────────
      if (speakBlend > 0.005) {
        for (const p of particlesRef.current) {
          p.theta -= ORBIT_SPEED * speakBlend * (p.isDust ? 0.45 : 1) * dt; // anti-clockwise
          const ox = cx + p.orbitR * Math.cos(p.theta);
          const oy = cy + p.orbitR * Math.sin(p.theta);
          p.x = p.fx * (1 - speakBlend) + ox * speakBlend;
          p.y = p.fy * (1 - speakBlend) + oy * speakBlend;
        }
      } else {
        for (const p of particlesRef.current) { p.x = p.fx; p.y = p.fy; }
      }

      // ── Render: glow ──────────────────────────────────────────────
      const breathPulse = Math.sin(now * cfg.breathFreq * 1000) * cfg.breathAmp;
      const burstPulse  = Math.sin(now * cfg.burstFreq  * 1000) * cfg.burstAmp;
      const animGlowR   = cfg.glowRadius * (1 + breathPulse + burstPulse);

      ctx!.clearRect(0, 0, width, height);

      const isDimState = stateRef.current === "disconnected" || stateRef.current === "failed";
      const gR = isDimState ? DIM[0] : Math.round(CYAN[0]   * (1 - speakBlend) + ORANGE[0] * speakBlend);
      const gG = isDimState ? DIM[1] : Math.round(CYAN[1]   * (1 - speakBlend) + ORANGE[1] * speakBlend);
      const gB = isDimState ? DIM[2] : Math.round(CYAN[2]   * (1 - speakBlend) + ORANGE[2] * speakBlend);

      ctx!.globalCompositeOperation = "lighter";
      const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, animGlowR);
      grad.addColorStop(0,   `rgba(${gR},${gG},${gB},${cfg.glowOpacity * 0.7})`);
      grad.addColorStop(0.5, `rgba(${gR},${gG},${gB},${cfg.glowOpacity * 0.25})`);
      grad.addColorStop(1,   `rgba(${gR},${gG},${gB},0)`);
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, animGlowR, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalCompositeOperation = "source-over";

      // ── Render: pixel particles ───────────────────────────────────
      const frame = frameRef.current;
      for (const p of particlesRef.current) {
        // Flicker: brief dim flash on a per-particle schedule
        let flickerOp = 1.0;
        if (p.flickerRate > 0) {
          const t = (frame + p.flickerPhase) % (p.flickerRate * 8);
          if (t < 2) flickerOp = 0.15;
        }

        const pr = isDimState ? DIM[0] : Math.round(p.color[0] * (1 - speakBlend) + ORANGE[0] * speakBlend);
        const pg = isDimState ? DIM[1] : Math.round(p.color[1] * (1 - speakBlend) + ORANGE[1] * speakBlend);
        const pb = isDimState ? DIM[2] : Math.round(p.color[2] * (1 - speakBlend) + ORANGE[2] * speakBlend);
        const finalOp = p.opacity * flickerOp;

        // Snap to pixel grid for crisp edges
        const rx = Math.round(p.x - p.px / 2);
        const ry = Math.round(p.y - p.px / 2);

        // Pixel square
        ctx!.fillStyle = `rgba(${pr},${pg},${pb},${finalOp})`;
        ctx!.fillRect(rx, ry, p.px, p.px);

        // 1×1 white highlight on larger pixels (lit LED feel)
        if (p.px >= 3) {
          ctx!.fillStyle = `rgba(255,255,255,${finalOp * 0.6})`;
          ctx!.fillRect(rx + 1, ry + 1, 1, 1);
        }

        // 1px drop shadow (depth cue)
        ctx!.fillStyle = `rgba(${pr},${pg},${pb},${finalOp * 0.15})`;
        ctx!.fillRect(rx + p.px, ry + p.px, p.px, 1);
        ctx!.fillRect(rx + p.px, ry + p.px, 1, p.px);
      }

      // ── Render: scanline overlay (CRT texture) ────────────────────
      ctx!.fillStyle = "rgba(0,0,0,0.06)";
      for (let sy = 0; sy < height; sy += 2) {
        ctx!.fillRect(0, sy, width, 1);
      }

      rafIdRef.current = requestAnimationFrame(drawFrame);
    }

    rafIdRef.current = requestAnimationFrame(drawFrame);

    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", imageRendering: "pixelated" }}
    />
  );
}
```

- [ ] **Step 2: Run the TypeScript build**

```bash
cd FridayV2/frontend
npm run build
```

Expected: build succeeds with 0 errors. If TypeScript complains:
- `color: [number, number, number]` — all color assignments must be a tuple, not `number[]`. Cast with `as [number,number,number]` if needed.
- `imageRendering: "pixelated"` is a valid React CSS property value — no cast needed.

- [ ] **Step 3: Commit**

```bash
cd FridayV2/frontend
git add components/FridayOrb.tsx
git commit -m "feat(orb): digital pixel particles — free bounce idle, anti-clockwise orbit on speak

- Drops 3D spherical projection; particles now live in flat 2D canvas space
- Idle: square pixel particles (2/3/4px) drift at constant speed, bounce off
  circular wall and each other (elastic, no momentum gain)
- Speaking: speakBlend lerps 0→1; each particle syncs theta to current angle
  then orbits anti-clockwise from that exact position
- Pixel rendering: fillRect grid-snapped, 1px highlight on 3+px tiles,
  per-particle flicker, scanline overlay for CRT texture
- Glow colour lerps cyan→orange with speakBlend

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Visual verification in the browser

**Files:** none — observation only

- [ ] **Step 1: Confirm the dev server is running**

The frontend should already be running from session start. If not:

```bash
cd FridayV2/frontend
npm run dev
```

Open `http://localhost:3000` in a browser and log in with password `friday2026`.

- [ ] **Step 2: Navigate to the Voice panel and verify idle behaviour**

Open the voice panel or any page that renders `FridayOrb` with a non-speaking state.

Check:
- Particles are **square pixels** (not circles)
- They move in **straight lines**, bouncing off the circular boundary and each other
- Motion is **calm and slow** — no shaking, no drifting to the edge over time
- Pixels do not all clump together or ring the boundary wall

- [ ] **Step 3: Trigger speaking state and verify orbit**

Activate Friday's voice session and let it respond (or temporarily hardcode `state="speaking"` in the component's parent for testing).

Check:
- Particles smoothly transition from wherever they are → anti-clockwise orbit
- Orbit direction is **counter-clockwise** (left-to-right across the top)
- Glow colour shifts from **cyan → orange**
- Transition is smooth (no snap or teleport)

- [ ] **Step 4: Return to idle and verify**

When speaking ends:
- Particles smoothly decelerate out of orbit
- Resume **free drift** from wherever they ended up (no snap back to initial positions)
- Glow returns to cyan

- [ ] **Step 5: Check all other states render without crash**

Cycle through: connecting → idle → listening → thinking → speaking → idle → disconnected.
No JavaScript errors in the browser console for any state.
