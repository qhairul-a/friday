"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, USER_ID } from "@/lib/supabase";
import { CaptureLogEntry } from "@/lib/types";

export default function CapturePanel() {
  const [entries, setEntries] = useState<CaptureLogEntry[]>([]);

  useEffect(() => {
    supabase.from("capture_log").select("*").eq("user_id", USER_ID)
      .order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => setEntries((data as CaptureLogEntry[]) ?? []));
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3a5c] shrink-0">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b]">Capture Feed</h2>
        <Link href="/notes" className="text-[10px] text-[#00d4ff] hover:text-white transition-colors">View all →</Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {entries.length === 0 ? (
          <p className="text-[11px] text-[#364c61] text-center mt-12 px-4 leading-relaxed">
            No captures yet.<br />Send a message to Friday on Telegram.
          </p>
        ) : entries.map(e => (
          <div key={e.id} className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-3">
            <p className="text-[12px] text-white leading-snug">{e.raw_text}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[9px] text-[#00d4ff] bg-[#060e1c] px-1.5 py-0.5 rounded">{e.routed_to}</span>
              <span className="text-[9px] text-[#364c61]">
                {new Date(e.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
