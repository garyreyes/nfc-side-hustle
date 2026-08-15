import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { getSessionIdFromCookie } from "./session";

export type VerifiedSession = {
  userId: string;
  email: string;
  role: "platform_admin" | "business_owner";
};

// The real enforcement boundary (per Next's own current auth guidance) —
// proxy.ts only does optimistic cookie checks; anything that actually
// needs to trust a session calls this, which re-checks the database.
// Cached per request via React's cache() so multiple callers in the same
// render pass share one lookup instead of hitting the DB repeatedly.
export const verifySession = cache(async (): Promise<VerifiedSession | null> => {
  const sessionId = await getSessionIdFromCookie();
  if (!sessionId) return null;

  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId));

  if (!row) return null;

  if (row.expiresAt < new Date()) {
    // Opportunistic cleanup so expired rows don't accumulate forever —
    // not load-bearing for correctness, since an expired row already
    // fails the check above either way.
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return { userId: row.userId, email: row.email, role: row.role };
});
