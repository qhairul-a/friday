import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js edge middleware — runs on every request before the page/route handler.
 * MUST be named middleware.ts at the project root to be picked up by Next.js.
 * (Previously named proxy.ts which caused it to be silently ignored — all routes
 * were publicly accessible with no authentication.)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const expected = process.env.FRIDAY_SESSION_SECRET;
  const session = request.cookies.get("friday_session")?.value;
  const authenticated = !!expected && session === expected;

  // Redirect already-logged-in users away from /login
  if (pathname === "/login") {
    return authenticated
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  // Allow static assets and auth API endpoints without a cookie
  const isPublic =
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon");
  if (isPublic) return NextResponse.next();

  // Protect everything else — unauthenticated requests go to /login
  if (!authenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
