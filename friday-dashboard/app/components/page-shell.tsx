"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardHeader from "./dashboard-header";
import MobileBottomNav from "./mobile-bottom-nav";
import VoiceOrbMini from "./voice-orb-mini";

// ── Nav definitions ────────────────────────────────────────────────────────────

const MAIN_NAV = [
  {
    href: "/tasks",
    label: "Tasks",
    icon: "✓",
    sub: [
      { href: "/tasks",         label: "Kanban"  },
      { href: "/tasks/archive", label: "Archive" },
    ],
  },
  { href: "/routine", label: "Routine", icon: "☑" },
  { href: "/goals",   label: "Goals",   icon: "◎" },
  { href: "/notes",   label: "Notes",   icon: "◱" },
  {
    href: "/finance",
    label: "Finance",
    icon: "◈",
    sub: [
      { href: "/finance",                   label: "Overview"          },
      { href: "/finance/liabilities",       label: "Fixed Expenses"    },
      { href: "/finance/variable-expenses", label: "Variable Expenses" },
      { href: "/finance/savings",           label: "Savings"           },
    ],
  },
];

const BOTTOM_NAV = [
  { href: "/profile",    label: "Profile",  icon: "◉" },
  { href: "/onboarding", label: "Settings", icon: "⚙" },
];

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

// ── Nav item with optional flyout submenu ──────────────────────────────────────

function NavItem({
  item,
  pathname,
}: {
  item: (typeof MAIN_NAV)[number];
  pathname: string;
}) {
  // A parent link is active if we're on it or any of its sub-routes
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const hasSub = item.sub && item.sub.length > 0;

  return (
    <div className="relative group w-full">
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors w-full nav-glow ${
          isActive
            ? "bg-[#0d2240] border border-[#1a3a5c] nav-glow-active"
            : "text-[#4a7a9b]"
        }`}
      >
        <span className="text-sm shrink-0">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {hasSub && (
          <span className="text-[10px] text-[#364c61] group-hover:text-[#00d4ff] transition-colors">›</span>
        )}
      </Link>

      {/* Flyout submenu — appears to the right on hover */}
      {hasSub && (
        <div className="absolute left-full top-0 ml-2 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150 z-50 min-w-[160px]">
          <div className="bg-[#07101f] border border-[#1a3a5c] rounded-xl py-1.5 shadow-xl shadow-black/50">
            {item.sub!.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`flex items-center px-4 py-2 text-xs transition-colors nav-glow ${
                  pathname === s.href
                    ? "text-[#00d4ff] nav-glow-active bg-[#0d2240]"
                    : "text-[#4a7a9b]"
                }`}
              >
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

          {/* Push bottom nav down */}
          <div className="flex-1" />

          {/* Bottom nav — Profile, Settings, Sign out */}
          <div className="w-full flex flex-col gap-0.5">
            <div className="w-full h-px bg-[#1a3a5c] mb-3" />
            {BOTTOM_NAV.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors nav-glow ${
                  pathname === href
                    ? "bg-[#0d2240] border border-[#1a3a5c] nav-glow-active"
                    : "text-[#4a7a9b]"
                }`}
              >
                <span className="text-sm shrink-0">{icon}</span>
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-[#4a7a9b] hover:text-red-400 transition-colors w-full"
            >
              <span className="text-sm shrink-0">↪</span>
              Sign out
            </button>
          </div>
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
