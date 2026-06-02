import { NextResponse } from "next/server";
import { supabase, USER_ID } from "@/lib/supabase";

export interface CalendarEvent {
  title: string;
  start: string;
  startStr: string;
}

const NO_CACHE = { "Cache-Control": "no-store, no-cache" };

// ── Timezone helpers ──────────────────────────────────────────────────────────

const SGT = "Asia/Singapore";

/** Convert wall-clock local time in a named IANA timezone to a UTC Date. */
function localToUTC(y: number, mo: number, d: number, h: number, min: number, s: number, tzid: string): Date {
  const candidate = new Date(Date.UTC(y, mo, d, h, min, s));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tzid, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
  }).formatToParts(candidate).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return new Date(candidate.getTime() - (shown - candidate.getTime()));
}

/** "2026-05-26" → Date at midnight SGT (so isAllDay detection works). */
function sgtMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localToUTC(y, m - 1, d, 0, 0, 0, SGT);
}

function formatStartStr(start: Date): string {
  const now = new Date();
  const toSGTDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: SGT });
  const todaySGT    = toSGTDate(now);
  const tomorrowSGT = toSGTDate(new Date(now.getTime() + 86400000));
  const startSGT    = toSGTDate(start);

  const timeSGT24 = start.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: SGT,
  });
  const isAllDay = timeSGT24 === "00:00:00";
  const timeStr  = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: SGT });

  if (startSGT === todaySGT)    return isAllDay ? "Today"    : `Today, ${timeStr}`;
  if (startSGT === tomorrowSGT) return isAllDay ? "Tomorrow" : `Tomorrow, ${timeStr}`;

  const diffDays = Math.round((start.getTime() - now.getTime()) / 86400000);
  if (diffDays < 7) {
    const day = start.toLocaleDateString("en-US", { weekday: "short", timeZone: SGT });
    return isAllDay ? day : `${day}, ${timeStr}`;
  }

  const dateStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: SGT });
  return isAllDay ? dateStr : `${dateStr}, ${timeStr}`;
}

// ── Google Calendar REST API (real-time) ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gcalItemToEvent(item: any): CalendarEvent | null {
  if (!item.summary) return null;
  const isAllDay = !!item.start?.date;
  const raw: string = item.start?.dateTime ?? item.start?.date;
  if (!raw) return null;

  // All-day: convert "YYYY-MM-DD" to midnight SGT so isAllDay display is correct.
  // Timed: parse ISO 8601 directly (includes timezone offset).
  const start = isAllDay ? sgtMidnight(raw) : new Date(raw);

  return { title: item.summary, start: start.toISOString(), startStr: formatStartStr(start) };
}

async function fetchGoogleCalendarAPI(): Promise<CalendarEvent[] | null> {
  let clientId     = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null; // not configured → fall back to iCal

  // 1. Exchange refresh token for a fresh access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) return [];
  const { access_token } = await tokenRes.json();

  const authHeader = { Authorization: `Bearer ${access_token}` };

  // 2. Get the user's calendar list (all selected/subscribed calendars)
  let calendarIds: string[] = ["primary"];
  try {
    const listRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
      { headers: authHeader, cache: "no-store" }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      calendarIds = (listData.items ?? [])
        .filter((c: { selected?: boolean }) => c.selected !== false)
        .map((c: { id: string }) => c.id);
      if (calendarIds.length === 0) calendarIds = ["primary"];
    }
  } catch { /* fall through to primary only */ }

  // 3. Fetch upcoming events from every calendar (singleEvents=true expands recurring series)
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days

  const allEvents: CalendarEvent[] = [];
  await Promise.all(
    calendarIds.map(async (calId) => {
      try {
        const url =
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events` +
          `?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
          `&singleEvents=true&orderBy=startTime&maxResults=15&showDeleted=false`;
        const res = await fetch(url, { headers: authHeader, cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        for (const item of data.items ?? []) {
          const ev = gcalItemToEvent(item);
          if (ev) allEvents.push(ev);
        }
      } catch { /* skip failed calendar */ }
    })
  );

  return allEvents;
}

// ── iCal fallback (12-24h cached by Google — use only when API creds absent) ──

function unfold(ical: string): string {
  return ical.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseIcalDate(raw: string, tzid?: string | null): Date | null {
  const clean = raw.trim().replace(/^.*:/, "");
  if (clean.length === 8) {
    const y = +clean.slice(0, 4), m = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8);
    return new Date(Date.UTC(y, m, d));
  }
  if (clean.length >= 15) {
    const y = +clean.slice(0, 4), mo = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8);
    const h = +clean.slice(9, 11), min = +clean.slice(11, 13), s = +clean.slice(13, 15);
    if (clean.endsWith("Z")) return new Date(Date.UTC(y, mo, d, h, min, s));
    if (tzid) return localToUTC(y, mo, d, h, min, s, tzid);
    return new Date(Date.UTC(y, mo, d, h, min, s));
  }
  return null;
}

const DOW: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function nextRruleDate(dtstart: Date, rruleStr: string): Date | null {
  const now = new Date();
  if (dtstart.getTime() > now.getTime()) return dtstart;

  const p: Record<string, string> = {};
  for (const seg of rruleStr.split(";")) {
    const eq = seg.indexOf("=");
    if (eq > 0) p[seg.slice(0, eq).trim()] = seg.slice(eq + 1).trim();
  }

  const freq = p["FREQ"];
  if (!freq) return null;
  const interval = Math.max(1, parseInt(p["INTERVAL"] ?? "1") || 1);

  if (p["UNTIL"]) {
    const until = parseIcalDate(p["UNTIL"]);
    if (until && until.getTime() < now.getTime()) return null;
  }

  const th = dtstart.getUTCHours(), tm = dtstart.getUTCMinutes(), ts = dtstart.getUTCSeconds();

  if (freq === "DAILY" || freq === "WEEKLY") {
    const byDayNums = (p["BYDAY"] ?? "")
      .split(",")
      .map(s => DOW[s.replace(/^[+-]?\d+/, "").trim()])
      .filter((n): n is number => n !== undefined);

    const todayAtTime = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), th, tm, ts
    ));
    let candidate = todayAtTime.getTime() > now.getTime() ? todayAtTime : new Date(todayAtTime.getTime() + 86400000);
    const limit = new Date(now.getTime() + 400 * 86400000);

    while (candidate.getTime() < limit.getTime()) {
      const dow = candidate.getUTCDay();
      const dayOk = byDayNums.length === 0
        ? (freq === "DAILY" || dow === dtstart.getUTCDay())
        : byDayNums.includes(dow);

      if (dayOk) {
        if (freq === "WEEKLY" && byDayNums.length === 0) {
          const weeks = Math.round((candidate.getTime() - dtstart.getTime()) / (7 * 86400000));
          if (weeks % interval === 0) return candidate;
        } else if (freq === "DAILY") {
          const days = Math.round((candidate.getTime() - dtstart.getTime()) / 86400000);
          if (days % interval === 0) return candidate;
        } else {
          return candidate;
        }
      }
      candidate = new Date(candidate.getTime() + 86400000);
    }
    return null;
  }

  if (freq === "MONTHLY") {
    let y = dtstart.getUTCFullYear(), m = dtstart.getUTCMonth();
    const day = dtstart.getUTCDate();
    for (let i = 0; i < 120; i++) {
      m += interval;
      while (m >= 12) { y++; m -= 12; }
      const c = new Date(Date.UTC(y, m, day, th, tm, ts));
      if (c.getTime() > now.getTime()) return c;
    }
    return null;
  }

  if (freq === "YEARLY") {
    let y = dtstart.getUTCFullYear();
    for (let i = 0; i < 20; i++) {
      y += interval;
      const c = new Date(Date.UTC(y, dtstart.getUTCMonth(), dtstart.getUTCDate(), th, tm, ts));
      if (c.getTime() > now.getTime()) return c;
    }
    return null;
  }

  return null;
}

function parseIcalEvents(rawIcal: string): CalendarEvent[] {
  const ical = unfold(rawIcal);
  const now = Date.now();
  const todayUtcMs = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const events: CalendarEvent[] = [];

  for (const block of ical.split("BEGIN:VEVENT").slice(1)) {
    const summaryMatch = block.match(/^SUMMARY(?:;[^:]+)?:(.+)/m);
    const dtStartMatch = block.match(/^(DTSTART(?:;[^:]+)?):(.+)/m);
    if (!summaryMatch || !dtStartMatch) continue;

    const title = summaryMatch[1].trim().replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\/g, "");
    const tzidMatch = dtStartMatch[1].match(/TZID=([^;:]+)/);
    const tzid = tzidMatch?.[1] ?? null;

    let start = parseIcalDate(dtStartMatch[2], tzid);
    if (!start) continue;

    const isAllDay = dtStartMatch[2].trim().length === 8;

    const rruleMatch = block.match(/^RRULE:(.+)/m);
    if (rruleMatch) {
      const next = nextRruleDate(start, rruleMatch[1].trim());
      if (!next) continue;
      start = next;
    } else {
      if (isAllDay ? start.getTime() < todayUtcMs : start.getTime() < now) continue;
    }

    events.push({ title, start: start.toISOString(), startStr: formatStartStr(start) });
  }
  return events;
}

async function fetchIcal(rawUrl: string): Promise<CalendarEvent[]> {
  const url = rawUrl.replace(/^webcal:\/\//i, "https://");
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return parseIcalEvents(await res.text());
  } catch { return []; }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  // ── Path 1: Real-time Google Calendar API ────────────────────────────────────
  const gcalEvents = await fetchGoogleCalendarAPI();
  if (gcalEvents !== null) {
    // null = not configured; [] = no events or API error
    gcalEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return NextResponse.json(gcalEvents.slice(0, 10), { headers: NO_CACHE });
  }

  // ── Path 2: iCal fallback (12-24h delay — use until API creds are set) ───────
  const { data } = await supabase
    .from("profiles").select("data").eq("user_id", USER_ID).single();

  const prefs = data?.data?.preferences ?? {};
  let urls: string[] = prefs.calendar_urls ?? [];
  if (urls.length === 0 && prefs.calendar_url) urls = [prefs.calendar_url];
  urls = urls.filter(Boolean);

  if (urls.length === 0) return NextResponse.json([], { headers: NO_CACHE });

  const results = await Promise.all(urls.map(fetchIcal));
  const merged = results.flat();
  merged.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return NextResponse.json(merged.slice(0, 10), { headers: NO_CACHE });
}
