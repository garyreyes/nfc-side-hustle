import bcrypt from "bcryptjs";
import { db } from "../src/lib/db/client";
import { users } from "../src/lib/db/schema";

const EMAIL = "gary_reyes@dlsu.edu.ph".toLowerCase();
const PASSWORD = "admin123";
const SALT_ROUNDS = 10;

function isUniqueViolation(err: unknown): boolean {
  const cause = err instanceof Error ? err.cause : undefined;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

// Relies on the DB's own unique constraint rather than a select-then-
// insert check, matching the established isPgError pattern from
// features/business-management/api.ts — not a select-then-insert TOCTOU
// this codebase already deliberately moved away from once before.
async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  try {
    const [user] = await db
      .insert(users)
      .values({ email: EMAIL, passwordHash, role: "platform_admin" })
      .returning();
    console.log(`Created platform_admin: ${user.email}`);
  } catch (err) {
    if (isUniqueViolation(err)) {
      console.log(`Admin user already exists: ${EMAIL}`);
      return;
    }
    throw err;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
