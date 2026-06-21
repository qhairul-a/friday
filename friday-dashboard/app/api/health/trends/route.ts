import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") || "14"), 90);

  if (!BACKEND) return NextResponse.json({ data: [] });

  try {
    const res = await fetch(`${BACKEND}/fitness/trends?days=${days}`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ data: [] });
  }
}
