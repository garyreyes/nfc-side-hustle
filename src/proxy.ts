import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function unauthorized(): NextResponse {
  // Constructed fresh per call, not hoisted to module scope: Next's own
  // Proxy docs warn against relying on shared modules/globals, and a
  // Response's body is backed by a single-use stream — reusing one
  // instance across concurrent requests risks a locked/empty body on
  // whichever request loses the race.
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual requires equal-length buffers; a length mismatch is
  // itself not a secret worth protecting via constant time, and padding
  // to compare would still leak length. Short-circuiting here is fine.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function proxy(request: NextRequest) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  // Fail closed: if credentials aren't configured, block everything
  // rather than letting requests through unauthenticated.
  if (!expectedUser || !expectedPass) {
    return unauthorized();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !/^basic\s/i.test(authHeader)) {
    return unauthorized();
  }

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return unauthorized();
  }

  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);

  // Evaluate both comparisons unconditionally (no `||` short-circuit) so
  // the total work done is identical whether the username or the
  // password is wrong — a short-circuit here would leak which one via
  // response timing, defeating the point of using timingSafeEqual.
  const userMatches = safeEqual(user, expectedUser);
  const passMatches = safeEqual(pass, expectedPass);
  if (!userMatches || !passMatches) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
