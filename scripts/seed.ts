import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { businesses, plates } from "../src/lib/db/schema";

const SLUG = "saffron";

async function seed() {
  const [existingPlate] = await db
    .select()
    .from(plates)
    .where(eq(plates.slug, SLUG));

  if (existingPlate) {
    console.log(`Plate with slug "${SLUG}" already exists, skipping seed.`);
    return;
  }

  const [business] = await db
    .insert(businesses)
    .values({
      name: "Saffron Middle Eastern Restaurant",
      googleReviewUrl: "https://maps.app.goo.gl/8AzRvE5ofU3EEvt3A",
    })
    .returning();

  const [plate] = await db
    .insert(plates)
    .values({
      businessId: business.id,
      slug: SLUG,
      capability: "qr",
    })
    .returning();

  console.log("Seeded business:", business);
  console.log("Seeded plate:", plate);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
