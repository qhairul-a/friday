import { NextResponse } from "next/server";
import { supabase, USER_ID } from "@/lib/supabase";

export async function GET() {
  const [{ data: raw }, { data: profileRow }] = await Promise.all([
    supabase
      .from("fitness_daily")
      .select("date,steps,distance_km,calories,resting_hr,sleep_duration_min,sleep_score,sleep_deep_min,sleep_light_min,sleep_rem_min,hrv_score,body_battery_low,body_battery_high,stress_avg,vo2max")
      .order("date", { ascending: false })
      .limit(1)
      .single(),
    supabase.from("profiles").select("data").eq("user_id", USER_ID).single(),
  ]);

  const enabled: string[] = profileRow?.data?.integrations?.garmin_metrics ?? [];
  const connected: boolean = profileRow?.data?.integrations?.garmin_enabled ?? false;

  // Map fitness_daily columns → HealthMetrics shape expected by the widget
  const metrics = raw ? {
    date: raw.date,
    steps: raw.steps ?? null,
    steps_goal: null,
    distance_km: raw.distance_km ?? null,
    calories_active: raw.calories ?? null,
    calories_total: null,
    active_minutes: null,
    floors_climbed: null,
    heart_rate_resting: raw.resting_hr ?? null,
    heart_rate_avg: null,
    hrv_weekly_avg: raw.hrv_score ?? null,
    body_battery_high: raw.body_battery_high ?? null,
    body_battery_low: raw.body_battery_low ?? null,
    stress_avg: raw.stress_avg ?? null,
    spo2_avg: null,
    sleep_duration_hrs: raw.sleep_duration_min ? raw.sleep_duration_min / 60 : null,
    sleep_score: raw.sleep_score ?? null,
    sleep_deep_hrs: raw.sleep_deep_min ? raw.sleep_deep_min / 60 : null,
    sleep_light_hrs: raw.sleep_light_min ? raw.sleep_light_min / 60 : null,
    sleep_rem_hrs: raw.sleep_rem_min ? raw.sleep_rem_min / 60 : null,
    vo2_max: raw.vo2max ?? null,
  } : null;

  return NextResponse.json({ metrics, enabled, connected });
}
