import { NextResponse } from "next/server";
import { supabase, USER_ID } from "@/lib/supabase";

export interface CalendarEvent {
  title: string;
  start: string;
  startStr: string;
}

function parseIcalDate(raw: string): Date | null {
  const clean = raw.trim().replace(/^.*:/, "");
  if (clean.length === 8) {
    const y = +clean.slice(0, 4), m = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8);
    return new Date(y, m, d);
  }
  if (clean.length >= 15) {
    const y = +clean.slice(0, 4), mo = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8);
    const h = +clean.slice(9, 11), min = +clean.slice(11, 13), s = +clean.slice(13, 15);
    if (clean.endsWith("Z")) return new Date(Date.UTC(y, mo, d, h, min, s));
    return new Date(y, mo, d, h, min, s);
  }
  return null;
}

function formatStartStr(start: Date): string {
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();
  const timeStr = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const isAllDay = start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0;

  if (start.toDateString() === todayStr) return isAllDay ? "Today" : `Today, ${timeStr}`;
  if (start.toDateString() === tomorrowStr) return isAllDay ? "Tomorrow" : `Tomorrow, ${timeStr}`;

  const diffDays = Math.floor((start.getTime() - now.getTime()) / 86400000);
  if (diffDays < 7) {
    const day = start.toLocaleDateString("en-US", { weekday: "short" });
    return isAllDay ? day : `${day}, ${timeStr}`;
  }

  const dateStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return isAllDay ? dateStr : `${dateStr}, ${timeStr}`;
}

function parseEvents(ical: string): CalendarEvent[] {
  const now = Date.now();
  const events: CalendarEvent[] = [];
  const blocks = ical.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const summaryMatch = block.match(/^SUMMARY(?:;[^:]+)?:(.+)/m);
    const dtStartMatch = block.match(/^DTSTART(?:;[^:]+)?:(.+)/m);
    if (!summaryMatch || !dtStartMatch) continue;

    const title = summaryMatch[1].trim().replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\/g, "");
    const start = parseIcalDate(dtStartMatch[1]);
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
