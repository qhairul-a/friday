import { NextResponse } from "next/server";
import { supabase, USER_ID } from "@/lib/supabase";

export async function GET() {
  const [{ data: raw }, { data: profileRow }] = await Promise.all([
    supabase
      .from("health_metrics")
      .select("date,steps,steps_goal,distance_km,calories_active,calories_total,active_minutes,floors_climbed,heart_rate_resting,heart_rate_avg,hrv_weekly_avg,body_battery_high,body_battery_low,stress_avg,spo2_avg,sleep_duration_hrs,sleep_score,sleep_deep_hrs,sleep_light_hrs,sleep_rem_hrs,vo2_max")
      .eq("user_id", USER_ID)
      .order("date", { ascending: false })
      .limit(1)
      .single(),
    supabase.from("profiles").select("data").eq("user_id", USER_ID).single(),
  ]);

  const enabled: string[] = profileRow?.data?.integrations?.garmin_metrics ?? [];
  const connected: boolean = profileRow?.data?.integrations?.garmin_enabled ?? false;

  // health_metrics columns already match the HealthMetrics shape exactly
  const metrics = raw ? {
    date: raw.date,
    steps: raw.steps ?? null,
    steps_goal: raw.steps_goal ?? null,
    distance_km: raw.distance_km ? Number(raw.distance_km) : null,
    calories_active: raw.calories_active ?? null,
    calories_total: raw.calories_total ?? null,
    active_minutes: raw.active_minutes ?? null,
    floors_climbed: raw.floors_climbed ?? null,
    heart_rate_resting: raw.heart_rate_resting ?? null,
    heart_rate_avg: raw.heart_rate_avg ?? null,
    hrv_weekly_avg: raw.hrv_weekly_avg ? Number(raw.hrv_weekly_avg) : null,
    body_battery_high: raw.body_battery_high ?? null,
    body_battery_low: raw.body_battery_low ?? null,
    stress_avg: raw.stress_avg ?? null,
    spo2_avg: raw.spo2_avg ? Number(raw.spo2_avg) : null,
    sleep_duration_hrs: raw.sleep_duration_hrs ? Number(raw.sleep_duration_hrs) : null,
    sleep_score: raw.sleep_score ?? null,
    sleep_deep_hrs: raw.sleep_deep_hrs ? Number(raw.sleep_deep_hrs) : null,
    sleep_light_hrs: raw.sleep_light_hrs ? Number(raw.sleep_light_hrs) : null,
    sleep_rem_hrs: raw.sleep_rem_hrs ? Number(raw.sleep_rem_hrs) : null,
    vo2_max: raw.vo2_max ? Number(raw.vo2_max) : null,
  } : null;

  return NextResponse.json({ metrics, enabled, connected });
}
