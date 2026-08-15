const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
// Crude memory bound: if the map somehow grows this large (e.g. many
// distinct real visitors within a window), drop everything rather than
// grow unbounded. Losing a few in-flight windows is cheap; an unbounded
// Map on a long-lived instance isn't.
const MAX_TRACKED_KEYS = 10_000;

const hits = new Map<string, { count: number; resetAt: number }>();

// Approximate on Vercel: each serverless instance has its own copy of this
// map, so the real limit is roughly MAX_REQUESTS_PER_WINDOW times however
// many instances handle a given IP's requests. Good enough for V1's actual
// traffic; revisit with an Upstash-backed limiter if abuse ever shows up.
export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    if (hits.size >= MAX_TRACKED_KEYS) {
      hits.clear();
    }
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

// X-Forwarded-For is "client, proxy1, proxy2, ..." — each hop appends,
// it doesn't replace. The first entry is whatever the client sent (a
// normal HTTP header, fully spoofable), while the last entry is what
// Vercel's own edge actually observed. X-Real-IP is Vercel-set and not
// attacker-controllable the same way, so prefer it when present.
//
// Takes a plain Headers object (not NextRequest) so it can be called
// from both a Route Handler (request.headers) and a Server Action,
// which has no request object of its own — only next/headers's
// headers(), which returns a Headers-compatible ReadonlyHeaders.
export function getClientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((part) => part.trim());
    return parts[parts.length - 1];
  }

  return "unknown";
}
