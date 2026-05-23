"use client";

import DashboardHeader from "./dashboard-header";
import VoiceOrbMini from "./voice-orb-mini";
import MobileBottomNav from "./mobile-bottom-nav";

export default function PageShell({
  children,
  activeTab,
  sidebarContent,
}: {
  children: React.ReactNode;
  activeTab?: string;
  sidebarContent?: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-[#050b14] text-white flex flex-col overflow-hidden">
      {/* Desktop header — hidden on mobile */}
      <DashboardHeader activeTab={activeTab} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — desktop only */}
        <aside className="hidden md:flex w-64 border-r border-[#1a3a5c] bg-[#06101e] shrink-0 flex-col items-center py-6 px-3 gap-4 overflow-y-auto">
          <VoiceOrbMini />
          {sidebarContent && (
            <div className="w-full">
              {sidebarContent}
            </div>
          )}
        </aside>

        {/* Page content — full width on mobile */}
        <main className="flex-1 overflow-auto bg-[#050b14]">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — hidden until swipe-up */}
      <MobileBottomNav />
    </div>
  );
}
