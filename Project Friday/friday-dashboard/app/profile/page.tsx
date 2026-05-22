"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, USER_ID } from "@/lib/supabase";
import { FridayProfile, defaultProfile } from "@/lib/types";
import PageShell from "../components/page-shell";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a1628] border border-[#1a3a5c] rounded-xl p-5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#4a7a9b] mb-3">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm gap-4 py-1 border-b border-[#0d1e30] last:border-0">
      <span className="text-[#4a7a9b] shrink-0">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<FridayProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select("data").eq("user_id", USER_ID).single()
      .then(({ data }) => { if (data?.data) setProfile(data.data as FridayProfile); setLoading(false); });
  }, []);

  const preferredNames = profile.identity.preferred_name
    ? profile.identity.preferred_name.split(";").map(n => n.trim()).filter(Boolean)
    : [];
  const primaryName = preferredNames[0] || profile.identity.name || "—";

  return (
    <PageShell activeTab="/profile">
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">{loading ? "Profile" : `${primaryName}'s Profile`}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {preferredNames.length > 1 && preferredNames.map((n, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#0d2240] text-[#00d4ff] border border-[#1a3a5c]">{n}</span>
              ))}
              <p className="text-[#4a7a9b] text-sm">{profile.identity.location} · {profile.identity.timezone}</p>
            </div>
          </div>
          <Link
            href="/onboarding"
            className="bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 border border-[#00d4ff]/30 text-[#00d4ff] px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Edit
          </Link>
        </div>

        {loading ? (
          <p className="text-[#4a7a9b] text-sm">Loading profile…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Daily Routine">
              <Row label="Wake" value={profile.daily_routine.wake_time} />
              <Row label="Sleep" value={profile.daily_routine.sleep_time} />
              <Row label="Work hours" value={profile.daily_routine.work_hours} />
              <Row label="Work days" value={profile.daily_routine.work_days.join(", ")} />
              <Row label="Habits" value={profile.daily_routine.habits.join(", ")} />
            </Card>

            <Card title="Health">
              <Row label="Diet" value={[...profile.health.dietary_preferences, ...profile.health.dietary_restrictions].join(", ")} />
              <Row label="Fitness goals" value={profile.health.fitness_goals.join(", ")} />
              {profile.health.notes && <Row label="Notes" value={profile.health.notes} />}
            </Card>

            <Card title="Work & Projects">
              <Row label="Role" value={profile.work_and_projects.role} />
              <Row label="Work style" value={profile.work_and_projects.work_style} />
              <Row label="Skills" value={profile.work_and_projects.skills.join(", ")} />
              {profile.work_and_projects.active_projects.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] text-[#4a7a9b] font-bold uppercase tracking-widest">Active Projects</p>
                  {profile.work_and_projects.active_projects.map((p, i) => (
                    <div key={i} className="bg-[#060e1c] rounded-lg px-3 py-2">
                      <p className="text-sm font-medium text-white">{p.name}</p>
                      <p className="text-[11px] text-[#4a7a9b]">{p.status}{p.deadline ? ` · Due ${p.deadline}` : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Goals">
              {profile.goals.short_term.length > 0 && (
                <>
                  <p className="text-[10px] text-[#4a7a9b] font-bold uppercase tracking-widest mb-2">Short-term</p>
                  {profile.goals.short_term.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 border-b border-[#0d1e30] last:border-0">
                      <div className="w-1 h-1 rounded-full bg-[#00d4ff] mt-1.5 shrink-0" />
                      <span className="text-sm text-white">{g}</span>
                    </div>
                  ))}
                </>
              )}
              {profile.goals.long_term.length > 0 && (
                <>
                  <p className="text-[10px] text-[#4a7a9b] font-bold uppercase tracking-widest mt-3 mb-2">Long-term</p>
                  {profile.goals.long_term.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 border-b border-[#0d1e30] last:border-0">
                      <div className="w-1 h-1 rounded-full bg-[#4a7a9b] mt-1.5 shrink-0" />
                      <span className="text-sm text-white">{g}</span>
                    </div>
                  ))}
                </>
              )}
            </Card>

            <Card title="Preferences">
              <Row label="Style" value={profile.preferences.communication_style} />
              <Row label="Verbosity" value={profile.preferences.verbosity} />
              <Row label="Hobbies" value={profile.preferences.hobbies.join(", ")} />
              <Row label="Entertainment" value={profile.preferences.entertainment.join(", ")} />
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}
