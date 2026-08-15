import { createBusinessAction } from "@/features/business-management/actions";
import { listBusinesses } from "@/features/business-management/api";

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const businesses = await listBusinesses();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>Businesses</h1>

      {error && (
        <p style={{ color: "#b00020", border: "1px solid #b00020", padding: 8 }}>{error}</p>
      )}

      <form action={createBusinessAction} style={{ display: "grid", gap: 8, marginBottom: 32 }}>
        <label>
          Business name
          <br />
          <input type="text" name="name" required />
        </label>
        <label>
          Google review URL
          <br />
          <input type="url" name="googleReviewUrl" required />
        </label>
        <label>
          Slug
          <br />
          <input type="text" name="slug" required pattern="[a-z0-9-]+" />
        </label>
        <button type="submit">Add business</button>
      </form>

      <h2>Existing businesses ({businesses.length})</h2>
      <ul>
        {businesses.map((business) => (
          <li key={business.businessId} style={{ marginBottom: 12 }}>
            <strong>{business.name}</strong> — {business.googleReviewUrl}
            <ul>
              {business.cards.map((card) => (
                <li key={card.cardId}>
                  <a href={`/r/${card.slug}`}>/r/{card.slug}</a> ({card.type})
                </li>
              ))}
              {business.cards.length === 0 && <li>(no cards)</li>}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
