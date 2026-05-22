"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/tasks", label: "Kanban", icon: "⊞" },
  { href: "/tasks/archive", label: "Archive", icon: "◫" },
];

export default function TasksNav() {
  const pathname = usePathname();
  return (
    <nav className="px-2 py-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#364c61] px-3 mb-3">Tasks</p>
      <div className="flex flex-col gap-1">
        {LINKS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                active
                  ? "bg-[#0d2240] text-[#00d4ff] border border-[#1a3a5c]"
                  : "text-[#4a7a9b] hover:text-white hover:bg-[#0a1628]"
              }`}
            >
              <span className="text-sm">{icon}</span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
