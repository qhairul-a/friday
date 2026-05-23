import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!process.env.FRIDAY_PASSWORD || password !== process.env.FRIDAY_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("friday_session", process.env.FRIDAY_SESSION_SECRET!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    // No maxAge → session cookie; browser deletes it when all windows close
    path: "/",
  });
  return res;
}
