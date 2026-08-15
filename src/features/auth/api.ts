import "server-only";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/passwords";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

// A real bcrypt hash of an arbitrary, unrelated string — used only to
// keep verifyCredentials()'s comparison timing identical whether or not
// the email exists. Not a secret; it doesn't hash any real password.
const DUMMY_HASH = "$2b$10$prykqgTTZhtxtwceInNzpOJQkoMxo.hdO1cVfGyFfni9psH/76TZ.";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: "platform_admin" | "business_owner";
};

// Always runs a bcrypt compare, even when no user matches the email —
// comparing against DUMMY_HASH keeps the response time indistinguishable
// from a real "wrong password" case, so failed logins can't be used to
// enumerate valid emails via timing. Same class of leak 2a's review
// already caught once in this codebase, for Basic Auth's `||`
// short-circuit.
export async function verifyCredentials(
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));

  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    return null;
  }

  return { id: user.id, email: user.email, role: user.role };
}
