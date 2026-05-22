"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/finance", label: "Overview", icon: "◈" },
  { href: "/finance/liabilities", label: "Fixed Expenses", icon: "⊟" },
  { href: "/finance/variable-expenses", label: "Variable Expenses", icon: "⊞" },
  { href: "/finance/savings", label: "Savings", icon: "◎" },
];

export default function FinanceNav() {
  const pathname = usePathname();

  return (
    <div className="w-full">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#2a3f52] px-1 mb-2">Finance</p>
      <div className="flex flex-col gap-0.5">
        {LINKS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] transition-colors ${
              pathname === href
                ? "bg-[#0a1628] text-[#00d4ff] border border-[#1a3a5c]"
                : "text-[#4a7a9b] hover:text-white hover:bg-[#0a1628]/60"
            }`}
          >
            <span className="text-[10px] shrink-0">{icon}</span>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
