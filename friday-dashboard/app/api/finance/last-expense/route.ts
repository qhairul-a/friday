import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "";

export async function GET() {
  if (!BACKEND) return NextResponse.json({ expense: null });
  try {
    const res = await fetch(`${BACKEND}/finance/last-expense`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ expense: null });
  }
}
