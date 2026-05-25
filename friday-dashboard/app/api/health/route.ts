import { NextResponse } from "next/server";
import { supabase, USER_ID } from "@/lib/supabase";

export async function GET() {
  const [{ data: metrics }, { data: profileRow }] = await Promise.all([
    supabase
      .from("health_metrics")
      .select("*")
      .eq("user_id", USER_ID)
      .order("date", { ascending: false })
      .limit(1)
      .single(),
    supabase.from("profiles").select("data").eq("user_id", USER_ID).single(),
  ]);

  const enabled: string[] = profileRow?.data?.integrations?.garmin_metrics ?? [];
  const connected: boolean = profileRow?.data?.integrations?.garmin_enabled ?? false;

  return NextResponse.json({ metrics: metrics ?? null, enabled, connected });
}
