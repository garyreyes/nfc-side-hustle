export const SLUG_PATTERN = /^[a-z0-9-]+$/;
export const MAX_SLUG_LENGTH = 64;

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

// Excludes ambiguous characters (0/o, 1/l/i) so a human reading a
// generated serial off a physical unit can't misread or mistype it.
// Originally scripts/generate-batch.ts's own copy — centralized here
// once business-management/api.ts's recordInventoryArrival() (V7)
// needed the same generation, following the same precedent that moved
// isValidSlug() here after it was duplicated in scripts/generate-qr.ts.
const RANDOM_SLUG_CHARSET = "abcdefghjkmnpqrstuvwxyz23456789";
const RANDOM_SLUG_LENGTH = 6;

export function generateRandomSlug(): string {
  let slug = "";
  for (let i = 0; i < RANDOM_SLUG_LENGTH; i++) {
    slug += RANDOM_SLUG_CHARSET[Math.floor(Math.random() * RANDOM_SLUG_CHARSET.length)];
  }
  return slug;
}

// Uniqueness is only guaranteed within this generated set, not against
// slugs already in the database — an accepted, astronomically unlikely
// collision risk at this volume (32^6 combinations), same as before
// this was centralized. A collision surfaces as a clean unique-slug
// error from the database insert, not a silent failure.
export function generateUniqueSlugs(count: number): string[] {
  const slugs = new Set<string>();
  while (slugs.size < count) {
    slugs.add(generateRandomSlug());
  }
  return [...slugs];
}
