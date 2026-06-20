import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "";

export async function POST() {
  if (!BACKEND) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  try {
    const res = await fetch(`${BACKEND}/garmin/request-code`, { method: "POST", cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
