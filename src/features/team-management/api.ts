import "server-only";
import { asc, eq } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/passwords";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export class TeamManagementError extends Error {}

const PG_UNIQUE_VIOLATION = "23505";

function isPgError(err: unknown, code: string): boolean {
  const cause = err instanceof Error ? err.cause : undefined;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
}

export type PlatformAdmin = {
  userId: string;
  email: string;
  createdAt: Date;
};

export async function listPlatformAdmins(): Promise<PlatformAdmin[]> {
  await requirePlatformAdmin();

  return db
    .select({ userId: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.role, "platform_admin"))
    .orderBy(asc(users.createdAt));
}

// Deliberately no self-service signup, no "forgot password" flow, no
// extra approval step beyond requirePlatformAdmin() itself — same
// simplicity as the original admin account (see ARCHITECTURE.md § V4):
// an existing admin creating another admin is exactly as trusted as an
// existing admin creating a business owner already was. Recovery, if an
// admin is ever locked out, stays a direct DB script, not a UI feature.
export async function createPlatformAdmin(input: { email: string; password: string }): Promise<PlatformAdmin> {
  await requirePlatformAdmin();

  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new TeamManagementError("Email is required.");
  }
  if (!input.password) {
    throw new TeamManagementError("Password is required.");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const [admin] = await db
      .insert(users)
      .values({ email, passwordHash, role: "platform_admin" })
      .returning({ userId: users.id, email: users.email, createdAt: users.createdAt });
    return admin;
  } catch (err) {
    if (isPgError(err, PG_UNIQUE_VIOLATION)) {
      throw new TeamManagementError(`Email "${email}" is already in use.`);
    }
    throw err;
  }
}
