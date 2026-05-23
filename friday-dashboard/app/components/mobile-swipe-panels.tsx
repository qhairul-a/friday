"use client";

import { useState, useRef } from "react";

interface MobileSwipePanelsProps {
  panels: React.ReactNode[];
  initialPanel?: number;
}

export default function MobileSwipePanels({ panels, initialPanel = 1 }: MobileSwipePanelsProps) {
  const [current, setCurrent] = useState(initialPanel);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;

    // Only treat as horizontal swipe if horizontal movement dominates
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (Math.abs(dx) < 40) return;

    if (dx > 0 && current < panels.length - 1) {
      setCurrent((c) => c + 1); // swipe left → next panel
    } else if (dx < 0 && current > 0) {
      setCurrent((c) => c - 1); // swipe right → prev panel
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }

  return (
    <div className="flex-1 overflow-hidden relative">
      {/* Sliding track */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(-${current * (100 / panels.length)}%)`,
          width: `${panels.length * 100}%`,
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {panels.map((panel, i) => (
          <div
            key={i}
            className="h-full overflow-y-auto"
            style={{ width: `${100 / panels.length}%` }}
          >
            {panel}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2 pointer-events-none">
        {panels.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === current ? 16 : 6,
              height: 6,
              background: i === current ? "#00d4ff" : "#1a3a5c",
            }}
          />
        ))}
      </div>

      {/* Pill handle — swipe-up hint */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
        <div className="w-10 h-1 rounded-full bg-[#1a3a5c]" />
      </div>
    </div>
  );
}
