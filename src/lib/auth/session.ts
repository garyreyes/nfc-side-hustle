import "server-only";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";

const COOKIE_NAME = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Read lazily, not at module scope — an eager throw here would break the
// CI build the same way an eager DATABASE_URL check once did in
// lib/db/client.ts (next build imports route modules that transitively
// reach this file, and CI has no .env.local).
function getEncodedKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

type SessionCookiePayload = {
  sessionId: string;
};

async function encrypt(payload: SessionCookiePayload, expiresAt: Date): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getEncodedKey());
}

async function decrypt(token: string | undefined): Promise<SessionCookiePayload | null> {
  if (!token) return null;
  // getEncodedKey() is called outside the try block deliberately: a
  // missing/misconfigured SESSION_SECRET must throw loudly, the same way
  // encrypt() already does, not get silently swallowed by the catch
  // below and mistaken for an ordinary tampered/expired token. Otherwise
  // a dropped env var would look identical to "everyone's logged out"
  // with zero signal anywhere pointing at the actual cause.
  const key = getEncodedKey();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (typeof payload.sessionId !== "string") return null;
    return { sessionId: payload.sessionId };
  } catch {
    return null;
  }
}

// Creates the real session record in the database, then sets a cookie
// holding only a signed reference to it (the session ID) — the cookie
// itself carries no authority, it just names which DB row to check.
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const [session] = await db.insert(sessions).values({ userId, expiresAt }).returning();

  const token = await encrypt({ sessionId: session.id }, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

// Optimistic-only: verifies the cookie's signature and extracts the
// session ID, but does not check the database. Suitable for proxy.ts's
// redirect-for-UX checks (4c) — anything that needs to trust this must
// go through the DAL's verifySession() (4b), which re-checks the
// session record itself.
export async function getSessionIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = await decrypt(token);
  return payload?.sessionId ?? null;
}

// Deletes the database session record (so a stolen cookie stops working
// immediately, not just once it expires) and clears the cookie.
export async function deleteSession(): Promise<void> {
  const sessionId = await getSessionIdFromCookie();
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
