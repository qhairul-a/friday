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
const DIM:    [number, number, number] = [110, 140, 175];

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
        opacity: 0.82 + Math.random() * 0.18,
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
      opacity: 0.42 + Math.random() * 0.30,
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
      const dt = Math.min(rawDt, 50) / 16.67;

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
          p.fx = cx + nx * (limit - 0.5);
          p.fy = cy + ny * (limit - 0.5);
          const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (spd > 0.001) { p.vx = (p.vx / spd) * p.spd; p.vy = (p.vy / spd) * p.spd; }
        }
      }

      // ── Physics: particle–particle elastic collision ───────────────
      const ps = particlesRef.current;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i], b = ps[j];
          if (a.isDust || b.isDust) continue;
          const dx = b.fx - a.fx;
          const dy = b.fy - a.fy;
          const d2 = dx * dx + dy * dy;
          const minD = COL_R * 2;
          if (d2 < minD * minD && d2 > 0.001) {
            const d  = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const relVn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (relVn > 0) {
              a.vx -= relVn * nx; a.vy -= relVn * ny;
              b.vx += relVn * nx; b.vy += relVn * ny;
            }
            const ov = (minD - d) / 2 + 0.5;
            a.fx -= nx * ov; a.fy -= ny * ov;
            b.fx += nx * ov; b.fy += ny * ov;
            const sA = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
            const sB = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
            if (sA > 0.001) { a.vx = (a.vx / sA) * a.spd; a.vy = (a.vy / sA) * a.spd; }
            if (sB > 0.001) { b.vx = (b.vx / sB) * b.spd; b.vy = (b.vy / sB) * b.spd; }
          }
        }
      }

      // ── Orbit blend ───────────────────────────────────────────────
      if (speakBlend > 0.005) {
        for (const p of particlesRef.current) {
          p.theta -= ORBIT_SPEED * speakBlend * (p.isDust ? 0.45 : 1) * dt;
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
      const gR = isDimState ? DIM[0] : Math.round(CYAN[0] * (1 - speakBlend) + ORANGE[0] * speakBlend);
      const gG = isDimState ? DIM[1] : Math.round(CYAN[1] * (1 - speakBlend) + ORANGE[1] * speakBlend);
      const gB = isDimState ? DIM[2] : Math.round(CYAN[2] * (1 - speakBlend) + ORANGE[2] * speakBlend);

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
        let flickerOp = 1.0;
        if (p.flickerRate > 0) {
          const t = (frame + p.flickerPhase) % (p.flickerRate * 8);
          if (t < 2) flickerOp = 0.15;
        }

        const pr = isDimState ? DIM[0] : Math.round(p.color[0] * (1 - speakBlend) + ORANGE[0] * speakBlend);
        const pg = isDimState ? DIM[1] : Math.round(p.color[1] * (1 - speakBlend) + ORANGE[1] * speakBlend);
        const pb = isDimState ? DIM[2] : Math.round(p.color[2] * (1 - speakBlend) + ORANGE[2] * speakBlend);
        const finalOp = p.opacity * flickerOp;

        const rx = Math.round(p.x - p.px / 2);
        const ry = Math.round(p.y - p.px / 2);

        ctx!.fillStyle = `rgba(${pr},${pg},${pb},${finalOp})`;
        ctx!.fillRect(rx, ry, p.px, p.px);

        if (p.px >= 3) {
          ctx!.fillStyle = `rgba(255,255,255,${finalOp * 0.6})`;
          ctx!.fillRect(rx + 1, ry + 1, 1, 1);
        }

        ctx!.fillStyle = `rgba(${pr},${pg},${pb},${finalOp * 0.15})`;
        ctx!.fillRect(rx + p.px, ry + p.px, p.px, 1);
        ctx!.fillRect(rx + p.px, ry + p.px, 1, p.px);
      }

      // ── Render: scanline overlay ──────────────────────────────────
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
