import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "";

export async function POST(request: NextRequest) {
  if (!BACKEND) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  const body = await request.json();
  try {
    const res = await fetch(`${BACKEND}/garmin/mfa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: body.code ?? "" }),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
