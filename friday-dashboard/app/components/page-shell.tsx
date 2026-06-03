"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import DashboardHeader from "./dashboard-header";
import MobileBottomNav from "./mobile-bottom-nav";
import VoiceOrbMini from "./voice-orb-mini";

// ── Nav definitions ─────────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: "/", label: "Main Frame", icon: "⬡" },
  {
    href: "/finance",
    label: "Finance",
    icon: "◈",
    sub: [
      { href: "/finance",                   label: "Snapshot"          },
      { href: "/finance/savings",           label: "Savings"           },
      { href: "/finance/liabilities",       label: "Fixed Expenses"    },
      { href: "/finance/variable-expenses", label: "Variable Expenses" },
    ],
  },
  { href: "/things-to-do", label: "Things to Do", icon: "◻" },
  { href: "/routine", label: "Routine", icon: "☑" },
  { href: "/goals",   label: "Goals",   icon: "◎" },
  { href: "/notes",   label: "Notes",   icon: "◱" },
];

// ── Nav item — accordion submenu expands on hover OR click ───────────────────

function NavItem({
  item,
  pathname,
}: {
  item: (typeof MAIN_NAV)[number];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const hasSub = item.sub && item.sub.length > 0;

  const rowClass = `flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors w-full nav-glow ${
    isActive
      ? "bg-[#0d2240] border border-[#1a3a5c] nav-glow-active"
      : "text-[#4a7a9b]"
  }`;

  return (
    <div
      className="w-full"
      onMouseEnter={() => hasSub && setOpen(true)}
      onMouseLeave={() => hasSub && setOpen(false)}
    >
      {/* Parent row — button (toggle) for items with sub, Link for leaf items */}
      {hasSub ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className={rowClass}
        >
          <span className="text-sm shrink-0">{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          <span
            className="text-[10px] text-[#364c61] transition-all duration-200 inline-block"
            style={{ transform: open ? "rotate(90deg)" : "none", color: open ? "#00d4ff" : undefined }}
          >
            ›
          </span>
        </button>
      ) : (
        <Link href={item.href} className={rowClass}>
          <span className="text-sm shrink-0">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
        </Link>
      )}

      {/* Accordion — expands below, pushing siblings down */}
      {hasSub && (
        <div
          className="overflow-hidden transition-all duration-200 ease-in-out"
          style={{ maxHeight: open ? "12rem" : "0" }}
        >
          <div className="flex flex-col gap-0.5 pl-4 pt-1 pb-1">
            {item.sub!.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition-colors nav-glow ${
                  pathname === s.href
                    ? "text-[#00d4ff] nav-glow-active"
                    : "text-[#4a7a9b]"
                }`}
              >
                <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-60" />
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page shell ─────────────────────────────────────────────────────────────────

export default function PageShell({
  children,
  activeTab,       // kept as optional no-op for backward compat
  sidebarContent,  // kept as optional no-op for backward compat
}: {
  children: React.ReactNode;
  activeTab?: string;
  sidebarContent?: React.ReactNode;
}) {
  void activeTab;
  void sidebarContent;

  const pathname = usePathname();

  return (
    <div className="h-screen bg-[#050b14] text-white flex flex-col overflow-hidden">
      {/* Desktop header — hidden on mobile */}
      <DashboardHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — desktop only */}
        {/* Left sidebar — overflow-y-auto lets accordion expand with scroll */}
        <aside className="hidden md:flex w-64 border-r border-[#1a3a5c] bg-[#06101e] shrink-0 flex-col items-center py-6 px-3 gap-6 overflow-y-auto">

          {/* Voice orb */}
          <VoiceOrbMini />

          {/* Divider */}
          <div className="w-full h-px bg-[#1a3a5c]" />

          {/* Main navigation */}
          <nav className="w-full flex flex-col gap-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#364c61] px-3 mb-2">
              Navigation
            </p>
            {MAIN_NAV.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[#050b14]">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
}
