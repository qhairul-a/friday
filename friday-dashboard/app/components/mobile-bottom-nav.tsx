"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",        icon: "⬡", label: "Home"    },
  { href: "/finance", icon: "◈", label: "Finance" },
  { href: "/tasks",   icon: "✓", label: "Tasks"   },
  { href: "/routine", icon: "☑", label: "Routine" },
  { href: "/goals",   icon: "◎", label: "Goals"   },
  { href: "/health",  icon: "♡", label: "Health"  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#07101f] border-t border-[#1a3a5c]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex justify-around items-center h-14 px-1">
        {TABS.map(({ href, icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
                active ? "text-[#00d4ff]" : "text-[#4a7a9b]"
              }`}
            >
              <span className={`text-base leading-none transition-transform ${active ? "scale-110" : ""}`}>
                {icon}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
