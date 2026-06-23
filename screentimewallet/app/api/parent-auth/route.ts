import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { pin } = await req.json()
  const correctPin = process.env.PARENT_PIN

  if (!correctPin || pin !== correctPin) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('parent_session', 'authenticated', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    // session cookie — no maxAge means it expires when browser closes
  })
  return res
}
