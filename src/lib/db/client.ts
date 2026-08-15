import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | undefined;

// Lazy on purpose: Next.js imports route modules to statically collect
// their config/metadata at build time, even for dynamic (non-prerendered)
// routes, and build environments (e.g. CI) intentionally have no
// DATABASE_URL. A connection only needs to actually exist once a query
// runs at request time, not at import time.
function getDb(): Db {
  if (!cached) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    const sql = neon(process.env.DATABASE_URL);
    cached = drizzle(sql, { schema });
  }
  return cached;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
