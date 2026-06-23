import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const isParentRoute = req.nextUrl.pathname.startsWith('/parent')
  const isAuthApi = req.nextUrl.pathname === '/api/parent-auth'

  if (isParentRoute && !isAuthApi) {
    const session = req.cookies.get('parent_session')
    if (!session) {
      return NextResponse.redirect(new URL('/parent/login', req.url))
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/parent/:path*'],
}
