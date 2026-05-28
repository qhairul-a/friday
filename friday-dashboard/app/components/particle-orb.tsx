"use client";

import { useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Particle {
  theta: number;        // azimuthal angle 0–2π
  phi: number;          // polar angle 0–π
  r: number;            // normalised radius 0–1
  vTheta: number;
  vPhi: number;
  vR: number;
  baseSize: number;     // 0.8–2.5 px
  baseOpacity: number;  // 0.18–0.75
  hue: number;          // 188–210 (blue-cyan band)
  x3d: number;          // cached 3D coords (recomputed each frame)
  y3d: number;
  z3d: number;
}

export type ParticleState =
  | "idle"
  | "connecting"
  | "initializing"
  | "listening"
  | "thinking"
  | "speaking";

interface ParticleOrbProps {
  size: number;             // canvas CSS width & height in px
  state: ParticleState;
  audioLevel?: number;      // 0–2 from Web Audio analyser
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function initParticles(count: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    // acos for uniform spherical distribution
    const phi = Math.acos(2 * Math.random() - 1);
    // cbrt for uniform volume distribution (not just surface)
    const r = Math.cbrt(Math.random());

    const sinPhi = Math.sin(phi);
    out.push({
      theta,
      phi,
      r,
      vTheta: (Math.random() - 0.5) * 0.0018,
      vPhi:   (Math.random() - 0.5) * 0.0018,
      vR:     (Math.random() - 0.5) * 0.0008,
      baseSize:    0.8 + Math.random() * 1.7,
      baseOpacity: 0.18 + Math.random() * 0.57,
      hue: 188 + Math.random() * 22,
      x3d: r * sinPhi * Math.cos(theta),
      y3d: r * Math.cos(phi),
      z3d: r * sinPhi * Math.sin(theta),
    });
  }
  return out;
}

// Per-state visual knobs (read every frame from refs — no React re-render cost)
interface StateParams {
  speedMult:   number;
  opacityMult: number;
  hue:         number;   // particle hue
  saturation:  number;
  shadowBlur:  number;
  shadowHue:   number;
  innerGlow:   number;   // 0–1 alpha for radial core glow
}

function getParams(state: ParticleState, audio: number): StateParams {
  switch (state) {
    case "idle":
      return { speedMult: 1.0, opacityMult: 0.28, hue: 200, saturation: 55, shadowBlur: 0,             shadowHue: 195, innerGlow: 0 };
    case "connecting":
      return { speedMult: 1.8, opacityMult: 0.55, hue: 200, saturation: 75, shadowBlur: 4,             shadowHue: 195, innerGlow: 0.15 };
    case "initializing":
      return { speedMult: 1.6, opacityMult: 0.55, hue: 195, saturation: 80, shadowBlur: 6,             shadowHue: 195, innerGlow: 0.20 };
    case "thinking":
      return { speedMult: 2.2, opacityMult: 0.75, hue: 195, saturation: 90, shadowBlur: 8,             shadowHue: 195, innerGlow: 0.30 };
    case "listening":
      return { speedMult: 1 + audio * 2, opacityMult: 0.85, hue: 145, saturation: 95, shadowBlur: 12,             shadowHue: 145, innerGlow: 0.20 + audio * 0.20 };
    case "speaking":
      return { speedMult: 1 + audio * 4, opacityMult: 1.00, hue: 195, saturation: 100, shadowBlur: 8 + audio * 20, shadowHue: 195, innerGlow: 0.15 + audio * 0.40 };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ParticleOrb({ size, state, audioLevel = 0 }: ParticleOrbProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const stateRef   = useRef(state);
  const audioRef   = useRef(audioLevel);

  // Sync mutable props into refs on every render (no useEffect needed)
  stateRef.current = state;
  audioRef.current = audioLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const count     = size >= 200 ? 500 : 200;
    const cx        = size / 2;
    const cy        = size / 2;
    const radius    = (size / 2) * 0.88; // sphere radius = 88% of half-canvas

    const particles = initParticles(count);

    function animate() {
      rafRef.current = requestAnimationFrame(animate);

      const s     = stateRef.current;
      const audio = audioRef.current;
      const p     = getParams(s, audio);

      ctx.clearRect(0, 0, size, size);

      // ── Inner radial core glow ──────────────────────────────────────────
      if (p.innerGlow > 0) {
        const glowR = radius * (0.55 + audio * 0.45);
        const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        grad.addColorStop(0,   `hsla(${p.shadowHue},100%,72%,${p.innerGlow})`);
        grad.addColorStop(0.4, `hsla(${p.shadowHue},100%,60%,${p.innerGlow * 0.3})`);
        grad.addColorStop(1,   "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      }

      // ── Update physics ────────────────────────────────────────────────
      for (let i = 0; i < particles.length; i++) {
        const pt = particles[i];

        pt.theta += pt.vTheta * p.speedMult;
        pt.phi   += pt.vPhi   * p.speedMult;
        pt.r     += pt.vR     * p.speedMult;

        // Speaking "breathing" — push surface particles outward on loud frames
        if (s === "speaking" && audio > 0.3 && pt.r > 0.72) {
          pt.vR += audio * 0.002;
        }

        // Soft boundary bounce
        if (pt.r > 0.98) { pt.r = 0.98; pt.vR *= -0.5; }
        if (pt.r < 0.04) { pt.r = 0.04; pt.vR *= -0.5; }

        // Brownian micro-jitter (always alive)
        pt.vTheta += (Math.random() - 0.5) * 0.00025;
        pt.vPhi   += (Math.random() - 0.5) * 0.00025;
        pt.vR     += (Math.random() - 0.5) * 0.00008;

        pt.vTheta = clamp(pt.vTheta, -0.004, 0.004);
        pt.vPhi   = clamp(pt.vPhi,   -0.004, 0.004);
        pt.vR     = clamp(pt.vR,     -0.003, 0.003);

        // Recompute 3D coords from new spherical position
        const sinPhi = Math.sin(pt.phi);
        pt.x3d = pt.r * sinPhi * Math.cos(pt.theta);
        pt.y3d = pt.r * Math.cos(pt.phi);
        pt.z3d = pt.r * sinPhi * Math.sin(pt.theta);
      }

      // ── Painter's sort: back → front (ascending z) ────────────────────
      particles.sort((a, b) => a.z3d - b.z3d);

      // ── Draw particles ────────────────────────────────────────────────
      ctx.shadowBlur = 0;

      for (let i = 0; i < particles.length; i++) {
        const pt    = particles[i];
        const depth = (pt.z3d + 1) / 2;  // 0=back, 1=front

        const screenX  = cx + pt.x3d * radius;
        const screenY  = cy + pt.y3d * radius;
        const opacity  = pt.baseOpacity * p.opacityMult * (0.20 + 0.80 * depth);
        const drawSize = pt.baseSize * (0.35 + 0.65 * depth);

        if (opacity < 0.01) continue;

        // Front particles glow when session is active
        if (p.shadowBlur > 0 && depth > 0.6) {
          ctx.shadowBlur  = p.shadowBlur * depth;
          ctx.shadowColor = `hsla(${p.shadowHue},100%,65%,0.85)`;
        } else {
          ctx.shadowBlur = 0;
        }

        const lightness = 48 + depth * 28;  // front = brighter
        ctx.beginPath();
        ctx.arc(screenX, screenY, drawSize, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},${p.saturation}%,${lightness}%,${opacity})`;
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    }

    animate();

    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once; state + audio read from refs every frame

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}
