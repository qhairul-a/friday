import { NextResponse } from "next/server";
import { supabase, USER_ID } from "@/lib/supabase";

const BACKEND = process.env.BACKEND_URL ?? "";

const ALL_METRICS = [
  "body_battery","sleep_duration","sleep_score","sleep_stages",
  "heart_rate_resting","heart_rate_avg","stress_avg","hrv",
  "spo2","calories_active","active_minutes","floors_climbed","vo2_max",
];

export async function GET() {
  // User preferences (which metrics to display) from dashboard Supabase — read via Vercel, not Cloud Run
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("data")
    .eq("user_id", USER_ID)
    .single();

  const enabled: string[] = profileRow?.data?.integrations?.garmin_metrics?.length
    ? profileRow.data.integrations.garmin_metrics
    : ALL_METRICS;

  // Metrics + connection status come from FridayV2 backend (reads hbdvcoonhldgceglzsqv — reachable from Cloud Run)
  let connected = false;
  let metrics = null;

  if (BACKEND) {
    try {
      const [statusRes, metricsRes] = await Promise.all([
        fetch(`${BACKEND}/garmin/status`, { cache: "no-store" }),
        fetch(`${BACKEND}/fitness/latest`, { cache: "no-store" }),
      ]);
      const statusData = await statusRes.json();
      const metricsData = await metricsRes.json();
      connected = statusData.connected ?? false;
      metrics = metricsData.metrics ?? null;
    } catch {
      // backend unreachable
    }
  }

  return NextResponse.json({ metrics, enabled, connected });
}
