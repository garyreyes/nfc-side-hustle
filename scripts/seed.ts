import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { businesses, cards } from "../src/lib/db/schema";

const SLUG = "saffron";

async function seed() {
  const [existingCard] = await db
    .select()
    .from(cards)
    .where(eq(cards.slug, SLUG));

  if (existingCard) {
    console.log(`Card with slug "${SLUG}" already exists, skipping seed.`);
    return;
  }

  const [business] = await db
    .insert(businesses)
    .values({
      name: "Saffron Middle Eastern Restaurant",
      googleReviewUrl: "https://maps.app.goo.gl/8AzRvE5ofU3EEvt3A",
    })
    .returning();

  const [card] = await db
    .insert(cards)
    .values({
      businessId: business.id,
      slug: SLUG,
      type: "qr",
    })
    .returning();

  console.log("Seeded business:", business);
  console.log("Seeded card:", card);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
