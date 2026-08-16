import { NextResponse, type NextRequest } from "next/server";
import { getSessionIdFromCookie } from "@/lib/auth/session";

// Optimistic only, per Next's own current authentication guidance: this
// checks whether a signed session cookie is present and not expired, so
// an unauthenticated visitor gets redirected to /login without an extra
// round trip. It deliberately does NOT query the database and does NOT
// know the session's role — Proxy runs on every request (including
// prefetches) and a DB lookup here would be a real performance cost, not
// just an unnecessary one. The actual authorization boundary (is this
// session real, is this user a platform_admin, or does this
// business_owner own the business they're looking at) is
// lib/auth/dal.ts's requirePlatformAdmin()/requireOwnedBusiness()/
// sessionCanAccessBusiness(), enforced on each protected page and inside
// business-management/api.ts's and analytics/api.ts's functions
// themselves — see ARCHITECTURE.md § V4. A request that fails this check
// would fail that one too; this only exists to make the common case (no
// cookie at all) redirect immediately instead of round-tripping through
// a page render first.
export async function proxy(request: NextRequest) {
  const sessionId = await getSessionIdFromCookie();

  if (!sessionId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard"],
};
