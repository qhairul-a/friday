import { NextResponse } from "next/server";
import { supabase, USER_ID } from "@/lib/supabase";

export interface CalendarEvent {
  title: string;
  start: string;
  startStr: string;
}

/** Convert a "wall-clock" datetime in a named IANA timezone to a UTC Date. */
function localToUTC(y: number, mo: number, d: number, h: number, min: number, s: number, tzid: string): Date {
  // Step 1: treat the values as if they were UTC to get a candidate Date
  const candidate = new Date(Date.UTC(y, mo, d, h, min, s));
  // Step 2: ask Intl what the clock shows in tzid for that candidate
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tzid, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
  }).formatToParts(candidate).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  // Step 3: offset = shown - candidate; actual UTC = candidate - offset
  return new Date(candidate.getTime() - (shown - candidate.getTime()));
}

function parseIcalDate(raw: string, tzid?: string | null): Date | null {
  const clean = raw.trim().replace(/^.*:/, "");
  if (clean.length === 8) {
    // DATE-only (all-day): YYYYMMDD — keep as midnight UTC so isAllDay check works
    const y = +clean.slice(0, 4), m = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8);
    return new Date(Date.UTC(y, m, d));
  }
  if (clean.length >= 15) {
    const y = +clean.slice(0, 4), mo = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8);
    const h = +clean.slice(9, 11), min = +clean.slice(11, 13), s = +clean.slice(13, 15);
    if (clean.endsWith("Z")) return new Date(Date.UTC(y, mo, d, h, min, s));
    // TZID present — convert local time to UTC properly
    if (tzid) return localToUTC(y, mo, d, h, min, s, tzid);
    // No TZID, no Z — assume UTC (server is UTC, best safe default)
    return new Date(Date.UTC(y, mo, d, h, min, s));
  }
  return null;
}

const SGT = "Asia/Singapore";

function formatStartStr(start: Date): string {
  const now = new Date();

  // All date comparisons and formatting use Singapore time
  const toSGTDate = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: SGT }); // "YYYY-MM-DD" for reliable comparison

  const todaySGT    = toSGTDate(now);
  const tomorrowSGT = toSGTDate(new Date(now.getTime() + 86400000));
  const startSGT    = toSGTDate(start);

  // An all-day iCal event has no time component — it parses to midnight UTC,
  // which is 08:00 SGT. Check the SGT wall-clock time instead.
  const timeSGT24 = start.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: SGT,
  });
  const isAllDay = timeSGT24 === "00:00:00";

  const timeStr = start.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: SGT,
  });

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

function parseEvents(ical: string): CalendarEvent[] {
  const now = Date.now();
  const events: CalendarEvent[] = [];
  const blocks = ical.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const summaryMatch = block.match(/^SUMMARY(?:;[^:]+)?:(.+)/m);
    const dtStartMatch = block.match(/^(DTSTART(?:;[^:]+)?):(.+)/m);
    if (!summaryMatch || !dtStartMatch) continue;

    const title = summaryMatch[1].trim().replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\/g, "");
    const tzidMatch = dtStartMatch[1].match(/TZID=([^;:]+)/);
    const tzid = tzidMatch?.[1] ?? null;
    const start = parseIcalDate(dtStartMatch[2], tzid);
    if (!start || start.getTime() < now) continue;

    events.push({ title, start: start.toISOString(), startStr: formatStartStr(start) });
  }

  return events;
}

async function fetchCalendar(url: string): Promise<CalendarEvent[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return parseEvents(await res.text());
  } catch {
    return [];
  }
}

export async function GET() {
  const { data } = await supabase
    .from("profiles")
    .select("data")
    .eq("user_id", USER_ID)
    .single();

  const prefs = data?.data?.preferences ?? {};
  // Support both old single-URL and new multi-URL format
  let urls: string[] = prefs.calendar_urls ?? [];
  if (urls.length === 0 && prefs.calendar_url) urls = [prefs.calendar_url];
  urls = urls.filter(Boolean);

  if (urls.length === 0) return NextResponse.json([]);

  const results = await Promise.all(urls.map(fetchCalendar));
  const merged = results.flat();
  merged.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return NextResponse.json(merged.slice(0, 5));
}
