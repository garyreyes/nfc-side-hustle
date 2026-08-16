import {
  addBusinessOwnerAction,
  createBranchAction,
  createBusinessAction,
  createCardAction,
} from "@/features/business-management/actions";
import { listBusinesses } from "@/features/business-management/api";
import { requirePlatformAdmin } from "@/lib/auth/dal";

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePlatformAdmin();

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
        <label>
          Owner email (optional)
          <br />
          <input type="email" name="ownerEmail" />
        </label>
        <label>
          Owner password (optional)
          <br />
          <input type="password" name="ownerPassword" />
        </label>
        <button type="submit">Add business</button>
      </form>

      <h2>Existing businesses ({businesses.length})</h2>
      <ul>
        {businesses.map((business) => {
          // Branch names aren't unique within a business (see
          // PROJECT_FACTS.md) — label with the review URL too wherever a
          // branch is displayed, so two same-named branches (e.g. two
          // "Main Street" locations) stay distinguishable instead of an
          // admin picking the wrong one for a new card by mistake.
          const branchById = new Map(
            business.branches.map((b) => [b.branchId, `${b.name} — ${b.googleReviewUrl}`])
          );

          return (
            <li key={business.businessId} style={{ marginBottom: 12 }}>
              <strong>{business.name}</strong> — {business.googleReviewUrl}

              <h4 style={{ marginBottom: 4 }}>Cards</h4>
              <ul>
                {business.cards.map((card) => (
                  <li key={card.cardId}>
                    <a href={`/r/${card.slug}`}>/r/{card.slug}</a> ({card.type}) —{" "}
                    {card.branchId ? branchById.get(card.branchId) ?? "unknown branch" : "no branch"}
                  </li>
                ))}
                {business.cards.length === 0 && <li>(no cards)</li>}
              </ul>
              <form
                action={createCardAction.bind(null, business.businessId)}
                style={{ display: "grid", gap: 4, marginTop: 4, marginBottom: 12, maxWidth: 300 }}
              >
                <label>
                  Slug
                  <br />
                  <input type="text" name="slug" required pattern="[a-z0-9-]+" />
                </label>
                <label>
                  Branch (optional)
                  <br />
                  <select name="branchId" defaultValue="">
                    <option value="">No branch</option>
                    {business.branches.map((branch) => (
                      <option key={branch.branchId} value={branch.branchId}>
                        {branch.name} — {branch.googleReviewUrl}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Add card</button>
              </form>

              <h4 style={{ marginBottom: 4 }}>Branches</h4>
              <ul>
                {business.branches.map((branch) => (
                  <li key={branch.branchId}>
                    {branch.name} — {branch.googleReviewUrl}
                  </li>
                ))}
                {business.branches.length === 0 && <li>(no branches)</li>}
              </ul>
              <form
                action={createBranchAction.bind(null, business.businessId)}
                style={{ display: "grid", gap: 4, marginTop: 4, marginBottom: 12, maxWidth: 300 }}
              >
                <label>
                  Branch name
                  <br />
                  <input type="text" name="name" required />
                </label>
                <label>
                  Google review URL
                  <br />
                  <input type="url" name="googleReviewUrl" required />
                </label>
                <button type="submit">Add branch</button>
              </form>

              {business.ownerEmail ? (
                <p>Owner: {business.ownerEmail}</p>
              ) : (
                <form
                  action={addBusinessOwnerAction.bind(null, business.businessId)}
                  style={{ display: "grid", gap: 4, marginTop: 4, maxWidth: 300 }}
                >
                  <label>
                    Owner email
                    <br />
                    <input type="email" name="email" required />
                  </label>
                  <label>
                    Owner password
                    <br />
                    <input type="password" name="password" required />
                  </label>
                  <button type="submit">Add owner</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
