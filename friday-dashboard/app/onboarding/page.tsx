"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, USER_ID } from "@/lib/supabase";
import { FridayProfile, defaultProfile, Briefing } from "@/lib/types";

const SECTIONS = [
  "identity",
  "routine_wellness",
  "garmin_health",
  "calendar",
  "briefings",
] as const;
type Section = typeof SECTIONS[number];

const SECTION_LABELS: Record<Section, string> = {
  identity:         "Identity",
  routine_wellness: "Routine & Wellness",
  garmin_health:    "Health Metrics",
  calendar:         "Calendar",
  briefings:        "Briefings",
};

const SIDEBAR_GROUPS = [
  {
    header: "Account",
    subgroups: [
      { label: "Profile",      sections: ["identity", "routine_wellness", "garmin_health"] as const },
      { label: "Productivity", sections: ["calendar", "briefings"] as const },
    ],
  },
] as const;

// ── DOB helpers ───────────────────────────────────────────────────────────────

function calcFromDOB(dob: string): { age: number; daysUntilBirthday: number } | null {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob + "T00:00:00");
  if (isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;

  const nextBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (nextBirthday.getTime() <= today.getTime()) nextBirthday.setFullYear(today.getFullYear() + 1);
  const daysUntilBirthday = Math.round((nextBirthday.getTime() - today.getTime()) / 86400000);

  return { age, daysUntilBirthday };
}

const GARMIN_METRICS: { key: string; label: string }[] = [
  { key: "steps",              label: "Steps" },
  { key: "distance",           label: "Distance walked/run" },
  { key: "calories_active",    label: "Active calories" },
  { key: "active_minutes",     label: "Active minutes" },
  { key: "floors_climbed",     label: "Floors climbed" },
  { key: "heart_rate_resting", label: "Resting heart rate" },
  { key: "heart_rate_avg",     label: "Average heart rate" },
  { key: "hrv",                label: "Heart rate variability (HRV)" },
  { key: "body_battery",       label: "Body Battery" },
  { key: "stress_avg",         label: "Stress level" },
  { key: "spo2",               label: "Blood oxygen (SpO2)" },
  { key: "sleep_duration",     label: "Sleep duration" },
  { key: "sleep_score",        label: "Sleep score" },
  { key: "sleep_stages",       label: "Sleep stages (deep / light / REM)" },
  { key: "vo2_max",            label: "VO2 max" },
];

export default function OnboardingPage() {
  const [profile, setProfile] = useState<FridayProfile>(defaultProfile);
  const [activeSection, setActiveSection] = useState<Section>("identity");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Section | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("data")
      .eq("user_id", USER_ID)
      .single()
      .then(({ data }) => {
        if (data?.data) setProfile(data.data as FridayProfile);
      });
  }, []);

  async function saveSection(section: Section) {
    setSaving(true);
    await supabase.from("profiles").upsert(
      { user_id: USER_ID, data: profile, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSaving(false);
    setSaved(section);
    setTimeout(() => setSaved(null), 2000);
  }

  function update(section: keyof FridayProfile, field: string, value: unknown) {
    setProfile((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as object), [field]: value },
    }));
  }

  function updateList(section: keyof FridayProfile, field: string, raw: string) {
    update(section, field, raw.split(",").map((s) => s.trim()).filter(Boolean));
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar nav */}
      <aside className="w-52 shrink-0 bg-gray-900 p-4 flex flex-col gap-1 border-r border-gray-800">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm mb-4"
        >
          ← Dashboard
        </Link>
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.header}>
            <p className="text-sm font-bold text-white px-3 mt-1 mb-3">
              {group.header}
            </p>
            {group.subgroups.map((sub) => (
              <div key={sub.label} className="mt-3">
                <p className="text-xs font-semibold text-gray-300 px-3 mb-1">{sub.label}</p>
                {sub.sections.map((s) => (
                  <button
                    key={s}
                    onClick={() => setActiveSection(s)}
                    className={`text-left w-full px-3 py-1.5 rounded-lg text-[11px] transition-colors ${
                      activeSection === s ? "bg-indigo-600 text-white" : "text-gray-400 hover:bg-gray-800"
                    }`}
                  >
                    {SECTION_LABELS[s]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-1">Set up your profile</h1>
        <p className="text-gray-400 text-sm mb-8">Friday uses this to know who you are. Fill in what you can — she'll ask about the rest.</p>

        <div className="bg-gray-900 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold">{SECTION_LABELS[activeSection]}</h2>

          {activeSection === "identity" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Full name" value={profile.identity.name} onChange={(v) => update("identity", "name", v)} />
              <Field label="Preferred name" placeholder="e.g. Kai; Q; Boss" value={profile.identity.preferred_name} onChange={(v) => update("identity", "preferred_name", v)} hint="separate with ;" />
              <div>
                <label className="block text-sm text-gray-400 mb-1">Date of birth</label>
                <input
                  type="date"
                  value={profile.identity.date_of_birth ?? ""}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    const dob = e.target.value || null;
                    const calc = dob ? calcFromDOB(dob) : null;
                    setProfile((prev) => ({
                      ...prev,
                      identity: {
                        ...prev.identity,
                        date_of_birth: dob,
                        age: calc?.age ?? null,
                      },
                    }));
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                />
                {profile.identity.date_of_birth && (() => {
                  const c = calcFromDOB(profile.identity.date_of_birth);
                  if (!c) return null;
                  return (
                    <p className="text-xs text-gray-500 mt-1">
                      Age {c.age} · {c.daysUntilBirthday === 0 ? "🎂 Today!" : `🎂 in ${c.daysUntilBirthday} day${c.daysUntilBirthday !== 1 ? "s" : ""}`}
                    </p>
                  );
                })()}
              </div>
              <Field label="Location" value={profile.identity.location} onChange={(v) => update("identity", "location", v)} />
              <Field label="Timezone" placeholder="e.g. Asia/Kuala_Lumpur" value={profile.identity.timezone} onChange={(v) => update("identity", "timezone", v)} />

              <div className="col-span-2 border-t border-gray-800 pt-1" />
              <p className="col-span-2 text-sm font-medium text-gray-400 -mt-2">Preferences</p>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Communication style</label>
                <select
                  value={profile.preferences.communication_style}
                  onChange={(e) => update("preferences", "communication_style", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Response verbosity</label>
                <select
                  value={profile.preferences.verbosity}
                  onChange={(e) => update("preferences", "verbosity", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
              <ListField label="Hobbies" hint="comma-separated" value={profile.preferences.hobbies.join(", ")} onChange={(v) => updateList("preferences", "hobbies", v)} />
              <ListField label="Entertainment" hint="e.g. Netflix, FIFA, K-dramas" value={profile.preferences.entertainment.join(", ")} onChange={(v) => updateList("preferences", "entertainment", v)} />
            </div>
          )}

          {activeSection === "routine_wellness" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Wake time" placeholder="e.g. 6:30 AM" value={profile.daily_routine.wake_time} onChange={(v) => update("daily_routine", "wake_time", v)} />
              <Field label="Sleep time" placeholder="e.g. 11:00 PM" value={profile.daily_routine.sleep_time} onChange={(v) => update("daily_routine", "sleep_time", v)} />
              <Field label="Work hours" placeholder="e.g. 9 AM – 6 PM" value={profile.daily_routine.work_hours} onChange={(v) => update("daily_routine", "work_hours", v)} />
              <ListField label="Work days" hint="comma-separated" value={profile.daily_routine.work_days.join(", ")} onChange={(v) => updateList("daily_routine", "work_days", v)} />
              <ListField label="Regular habits" hint="e.g. morning run, prayer" className="col-span-2" value={profile.daily_routine.habits.join(", ")} onChange={(v) => updateList("daily_routine", "habits", v)} />

              <div className="col-span-2 border-t border-gray-800 pt-1" />
              <p className="col-span-2 text-sm font-medium text-gray-400 -mt-2">Health & Wellness</p>

              <ListField label="Dietary preferences" hint="e.g. halal, no pork" value={profile.health.dietary_preferences.join(", ")} onChange={(v) => updateList("health", "dietary_preferences", v)} />
              <ListField label="Dietary restrictions" hint="e.g. lactose intolerant" value={profile.health.dietary_restrictions.join(", ")} onChange={(v) => updateList("health", "dietary_restrictions", v)} />
              <ListField label="Fitness goals" hint="e.g. lose 5kg, run 3x/week" value={profile.health.fitness_goals.join(", ")} onChange={(v) => updateList("health", "fitness_goals", v)} />
              <TextArea label="Other health notes" className="col-span-1" value={profile.health.notes} onChange={(v) => update("health", "notes", v)} />
            </div>
          )}

          {activeSection === "calendar" && (
            <>
              <div className="space-y-2">
                {(profile.preferences.calendar_urls ?? []).map((url, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={url}
                      placeholder="Paste your secret iCal URL here"
                      onChange={(e) => {
                        const urls = [...(profile.preferences.calendar_urls ?? [])];
                        urls[i] = e.target.value;
                        update("preferences", "calendar_urls", urls);
                      }}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => {
                        const urls = (profile.preferences.calendar_urls ?? []).filter((_, j) => j !== i);
                        update("preferences", "calendar_urls", urls);
                      }}
                      className="text-gray-500 hover:text-red-400 transition-colors text-lg leading-none px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => update("preferences", "calendar_urls", [...(profile.preferences.calendar_urls ?? []), ""])}
                className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Add calendar
              </button>
              <p className="text-xs text-gray-500">
                Google Calendar → Settings → [your calendar] → <span className="text-gray-400">Secret address in iCal format</span>
              </p>
            </>
          )}

          {activeSection === "garmin_health" && (
            <>
              {/* Credentials */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Garmin Connect email</label>
                  <input
                    type="email"
                    value={profile.integrations?.garmin_email ?? ""}
                    placeholder="your@email.com"
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        integrations: { ...(prev.integrations ?? {}), garmin_email: e.target.value },
                      }))
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Garmin Connect password</label>
                  <input
                    type="password"
                    value={profile.integrations?.garmin_password ?? ""}
                    placeholder={profile.integrations?.garmin_password ? "••••••••" : "Enter password"}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        integrations: { ...(prev.integrations ?? {}), garmin_password: e.target.value },
                      }))
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <p className="col-span-2 text-xs text-gray-500">
                  Same credentials you use to log in at connect.garmin.com. Stored in your private Supabase — never shared.
                </p>
              </div>

              {/* Connection status + toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-white">Garmin Connect</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {profile.integrations?.garmin_enabled
                      ? "Connected — data syncs every 4 hours"
                      : "Not connected"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setProfile((prev) => ({
                      ...prev,
                      integrations: {
                        ...(prev.integrations ?? {}),
                        garmin_enabled: !(prev.integrations?.garmin_enabled ?? false),
                      },
                    }))
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    profile.integrations?.garmin_enabled ? "bg-indigo-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      profile.integrations?.garmin_enabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Metric toggles */}
              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">Metrics to surface</p>
                <p className="text-xs text-gray-500 mb-3">
                  All Garmin data is stored for trend analysis. These toggles control which metrics Friday mentions aloud and shows on your dashboard.
                </p>
                <div className="space-y-3">
                  {GARMIN_METRICS.map(({ key, label }) => {
                    const enabled = profile.integrations?.garmin_enabled ?? false;
                    const checked = (profile.integrations?.garmin_metrics ?? []).includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-3 cursor-pointer group ${!enabled ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!enabled}
                          onChange={() => {
                            const current = profile.integrations?.garmin_metrics ?? [];
                            const next = checked
                              ? current.filter((m) => m !== key)
                              : [...current, key];
                            setProfile((prev) => ({
                              ...prev,
                              integrations: { ...(prev.integrations ?? {}), garmin_metrics: next },
                            }));
                          }}
                          className="accent-indigo-500"
                        />
                        <span className="text-sm text-white group-hover:text-indigo-300 transition-colors">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeSection === "briefings" && <BriefingsSection />}

          {activeSection !== "briefings" && (
            <button
              onClick={() => saveSection(activeSection)}
              disabled={saving}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl px-6 py-3 font-medium transition-colors"
            >
              {saving ? "Saving…" : saved === activeSection ? "Saved!" : "Save section"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Briefings section ────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const WIDGET_OPTIONS = [
  { id: "tasks",    label: "Tasks",    desc: "Open tasks and due dates" },
  { id: "goals",    label: "Goals",    desc: "Active goals and upcoming deadlines" },
  { id: "routine",  label: "Routine",  desc: "Today's routine progress" },
  { id: "calendar", label: "Calendar", desc: "Upcoming calendar events" },
  { id: "finance",  label: "Finance",  desc: "Monthly spending summary" },
];

function daysLabel(days: number[]) {
  if (days.length === 7) return "Every day";
  if (days.length === 0) return "Never";
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];
  if (weekdays.every(d => days.includes(d)) && days.length === 5) return "Weekdays";
  if (weekend.every(d => days.includes(d)) && days.length === 2) return "Weekends";
  return days.map(d => DAY_LABELS[d]).join(", ");
}

function BriefingsSection() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [formName, setFormName] = useState("");
  const [formTime, setFormTime] = useState("07:00");
  const [formDays, setFormDays] = useState<number[]>(ALL_DAYS);
  const [formWidgets, setFormWidgets] = useState<string[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("briefings").select("*").eq("user_id", USER_ID).order("created_at")
      .then(({ data }) => { setBriefings((data as Briefing[]) ?? []); setLoading(false); });
  }, []);

  function startAdd() {
    setFormName(""); setFormTime("07:00"); setFormDays(ALL_DAYS);
    setFormWidgets([]); setFormEnabled(true); setEditingId("new");
  }

  function startEdit(b: Briefing) {
    setFormName(b.name);
    setFormTime(b.schedule_time.slice(0, 5));
    setFormDays(b.schedule_days);
    setFormWidgets(b.widgets);
    setFormEnabled(b.enabled);
    setEditingId(b.id);
  }

  async function save() {
    if (!formName.trim() || formWidgets.length === 0) return;
    setSaving(true);
    const payload = {
      user_id: USER_ID,
      name: formName.trim(),
      schedule_time: formTime,
      schedule_days: formDays,
      widgets: formWidgets,
      enabled: formEnabled,
    };
    if (editingId === "new") {
      const { data } = await supabase.from("briefings").insert(payload).select().single();
      if (data) setBriefings(prev => [...prev, data as Briefing]);
    } else {
      await supabase.from("briefings").update(payload).eq("id", editingId!);
      setBriefings(prev => prev.map(b => b.id === editingId ? { ...b, ...payload } : b));
    }
    setSaving(false);
    setEditingId(null);
  }

  async function deleteBriefing(id: string) {
    await supabase.from("briefings").delete().eq("id", id);
    setBriefings(prev => prev.filter(b => b.id !== id));
  }

  async function toggleEnabled(b: Briefing) {
    await supabase.from("briefings").update({ enabled: !b.enabled }).eq("id", b.id);
    setBriefings(prev => prev.map(x => x.id === b.id ? { ...x, enabled: !x.enabled } : x));
  }

  function toggleDay(d: number) {
    setFormDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b));
  }

  function toggleWidget(id: string) {
    setFormWidgets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>;

  if (editingId !== null) {
    return (
      <div className="space-y-5">
        <h3 className="text-base font-semibold text-white">{editingId === "new" ? "New Briefing" : "Edit Briefing"}</h3>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Briefing name</label>
          <input
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="e.g. Morning Briefing"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Scheduled time</label>
          <input
            type="time"
            value={formTime}
            onChange={e => setFormTime(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Repeat on</label>
          <div className="flex gap-1.5">
            {ALL_DAYS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  formDays.includes(d) ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {DAY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Include in briefing</label>
          <div className="space-y-3">
            {WIDGET_OPTIONS.map(w => (
              <label key={w.id} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formWidgets.includes(w.id)}
                  onChange={() => toggleWidget(w.id)}
                  className="mt-0.5 accent-indigo-500"
                />
                <div>
                  <div className="text-sm text-white group-hover:text-indigo-300 transition-colors">{w.label}</div>
                  <div className="text-xs text-gray-500">{w.desc}</div>
                </div>
              </label>
            ))}
          </div>
          {formWidgets.length === 0 && (
            <p className="text-xs text-amber-500 mt-2">Select at least one widget.</p>
          )}
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formEnabled}
            onChange={e => setFormEnabled(e.target.checked)}
            className="accent-indigo-500"
          />
          <span className="text-sm text-gray-300">Enabled</span>
        </label>

        <div className="flex gap-3 pt-1">
          <button
            onClick={save}
            disabled={saving || !formName.trim() || formWidgets.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
          >
            {saving ? "Saving…" : "Save briefing"}
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="text-gray-400 hover:text-white transition-colors text-sm px-3"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {briefings.length} briefing{briefings.length !== 1 ? "s" : ""} configured
        </p>
        <button
          onClick={startAdd}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          + Add briefing
        </button>
      </div>

      {briefings.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">
          No briefings yet. Add one to get started.
        </div>
      ) : (
        briefings.map(b => (
          <div key={b.id} className="bg-gray-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white text-sm">{b.name}</span>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                  {b.schedule_time.slice(0, 5)}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.enabled ? "bg-green-900/50 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                  {b.enabled ? "On" : "Off"}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => toggleEnabled(b)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  {b.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => startEdit(b)} className="text-xs text-gray-500 hover:text-indigo-400 transition-colors">
                  Edit
                </button>
                <button onClick={() => deleteBriefing(b.id)} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                  Delete
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">{daysLabel(b.schedule_days)}</p>
            <div className="flex flex-wrap gap-1.5">
              {b.widgets.map(w => (
                <span key={w} className="text-xs bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded-full capitalize">
                  {w}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Shared form components ───────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", placeholder, hint, className }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-400 mb-1">
        {label}
        {hint && <span className="text-gray-600 ml-1">({hint})</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}

function ListField({ label, value, onChange, hint, className }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-400 mb-1">{label} {hint && <span className="text-gray-600">({hint})</span>}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, className }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
      />
    </div>
  );
}
