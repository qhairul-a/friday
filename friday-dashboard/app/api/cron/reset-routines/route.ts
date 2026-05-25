import { NextRequest, NextResponse } from "next/server";
import { supabase, USER_ID } from "@/lib/supabase";

/**
 * GET /api/cron/reset-routines
 *
 * Called by Vercel cron at 16:00 UTC (= midnight Asia/Singapore, UTC+8).
 * Resets is_done → false for every routine item belonging to the user.
 * Protected by the CRON_SECRET Vercel auto-injects into cron calls.
 */
export async function GET(request: NextRequest) {
  // Verify the request comes from Vercel's cron scheduler
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("routine_items")
    .update({ is_done: false })
    .eq("user_id", USER_ID);

  if (error) {
    console.error("[cron] Routine reset failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[cron] Routine reset complete at ${new Date().toISOString()}`);
  return NextResponse.json({
    ok: true,
    resetAt: new Date().toISOString(),
  });
}
