"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",        icon: "⬡", label: "Home"    },
  { href: "/tasks",   icon: "✓", label: "Tasks"   },
  { href: "/routine", icon: "☑", label: "Routine" },
  { href: "/goals",   icon: "◎", label: "Goals"   },
  { href: "/notes",   icon: "◱", label: "Notes"   },
  { href: "/finance", icon: "◈", label: "Finance" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Touch tracking for pill handle
  const pillTouchStartY = useRef<number | null>(null);

  function handlePillTouchStart(e: React.TouchEvent) {
    pillTouchStartY.current = e.touches[0].clientY;
  }

  function handlePillTouchEnd(e: React.TouchEvent) {
    if (pillTouchStartY.current === null) return;
    const dy = pillTouchStartY.current - e.changedTouches[0].clientY;
    if (dy > 30) setOpen(true);   // swipe up → open
    if (dy < -20) setOpen(false); // swipe down → close
    pillTouchStartY.current = null;
  }

  // Touch tracking for nav drawer itself (to allow swipe-down to close)
  const navTouchStartY = useRef<number | null>(null);

  function handleNavTouchStart(e: React.TouchEvent) {
    navTouchStartY.current = e.touches[0].clientY;
  }

  function handleNavTouchEnd(e: React.TouchEvent) {
    if (navTouchStartY.current === null) return;
    const dy = navTouchStartY.current - e.changedTouches[0].clientY;
    if (dy < -30) setOpen(false); // swipe down → close
    navTouchStartY.current = null;
  }

  return (
    <>
      {/* Dim overlay when nav is open */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Nav drawer */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#07101f] border-t border-[#1a3a5c] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        onTouchStart={handleNavTouchStart}
        onTouchEnd={handleNavTouchEnd}
      >
        {/* Pill inside drawer */}
        <div className="flex justify-center pt-2 pb-0">
          <div className="w-10 h-1 rounded-full bg-[#2a4a6c]" />
        </div>

        <nav className="flex justify-around items-center h-16 px-2 pb-safe">
          {TABS.map(({ href, icon, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors ${
                  isActive ? "text-[#00d4ff]" : "text-[#4a7a9b] hover:text-white"
                }`}
              >
                <span className={`text-lg transition-transform ${isActive ? "scale-110" : ""}`}>
                  {icon}
                </span>
                <span className="text-[8px] uppercase tracking-wider font-semibold">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Always-visible pill handle (sits above the drawer) */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 flex justify-center py-1.5 z-40 transition-opacity duration-300 ${
          open ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onTouchStart={handlePillTouchStart}
        onTouchEnd={handlePillTouchEnd}
      >
        <div className="w-10 h-1 rounded-full bg-[#1a3a5c]" />
      </div>
    </>
  );
}
