import { NextResponse } from "next/server";
import { supabase, USER_ID } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") || "14"), 90);

  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  const startStr = start.toISOString().split("T")[0];

  const { data } = await supabase
    .from("health_metrics")
    .select(
      "date,steps,distance_km,heart_rate_avg,heart_rate_resting,stress_avg," +
      "sleep_duration_hrs,sleep_deep_hrs,sleep_light_hrs,sleep_rem_hrs," +
      "body_battery_high,body_battery_low"
    )
    .eq("user_id", USER_ID)
    .gte("date", startStr)
    .order("date", { ascending: true });

  return NextResponse.json({ data: data ?? [] });
}
