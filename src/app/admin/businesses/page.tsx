import {
  addBusinessOwnerAction,
  createBranchAction,
  createBusinessAction,
  createPlateAction,
} from "@/features/business-management/actions";
import { getBusinessScanTotals } from "@/features/analytics/api";
import { listBusinesses } from "@/features/business-management/api";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { AppShell } from "@/shared/ui/AppShell";
import { Card } from "@/shared/ui/Card";
import formStyles from "@/shared/ui/form.module.css";
import { StatCard } from "@/shared/ui/StatCard";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import styles from "./page.module.css";

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const session = await requirePlatformAdmin();

  const { error, q: qParam } = await searchParams;
  const q = (qParam ?? "").trim();
  const [businesses, scanTotals] = await Promise.all([listBusinesses(), getBusinessScanTotals()]);
  const totalScans = scanTotals.reduce((sum, b) => sum + b.totalScans, 0);

  // Server-rendered, no client JS — matches the rest of this project's
  // filtering (e.g. admin/plates' ?status= tabs). Search is a submitted
  // GET form, not a live-filter input.
  const visibleBusinesses = q
    ? businesses.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()))
    : businesses;
  // Folding a business card open by default only when a search actually
  // narrowed the list — an unfiltered page of many businesses stays
  // collapsed for scannability, but searching implies "show me this
  // one's details" so the match shouldn't require an extra click.
  const autoExpand = q.length > 0;

  return (
    <AppShell
      navItems={[
        { label: "Businesses", href: "/admin/businesses", active: true },
        { label: "Dashboard", href: "/admin/dashboard", active: false },
        { label: "Plates", href: "/admin/plates", active: false },
        { label: "Inventory", href: "/admin/inventory", active: false },
        { label: "Team", href: "/admin/team", active: false },
      ]}
      email={session.email}
      roleLabel="Platform admin"
      title="Businesses"
      subtitle={`${businesses.length} business${businesses.length === 1 ? "" : "es"} on the platform.`}
    >
      {error && (
        <p className={formStyles.errorBanner} style={{ marginBottom: "var(--space-5)" }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatCard label="Businesses" value={businesses.length} />
        <StatCard label="Total scans" value={totalScans} />
      </div>

      <Card title="Add a business">
        <form action={createBusinessAction} className={formStyles.form}>
          <div className={formStyles.field}>
            <label className={formStyles.fieldLabel} htmlFor="name">
              Business name
            </label>
            <input className={formStyles.input} id="name" type="text" name="name" required />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.fieldLabel} htmlFor="googleReviewUrl">
              Google review URL
            </label>
            <input
              className={formStyles.input}
              id="googleReviewUrl"
              type="url"
              name="googleReviewUrl"
              required
            />
          </div>
          <p className={formStyles.helperText}>
            Creates the business only — no plate yet. Assign a real one from inventory on{" "}
            <code>/admin/plates</code>, or use this business&rsquo;s own &ldquo;Add plate&rdquo; form
            below for a one-off untracked plate.
          </p>
          <div className={formStyles.formRow}>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="ownerEmail">
                Owner email (optional)
              </label>
              <input className={formStyles.input} id="ownerEmail" type="email" name="ownerEmail" />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="ownerPassword">
                Owner password (optional)
              </label>
              <input
                className={formStyles.input}
                id="ownerPassword"
                type="password"
                name="ownerPassword"
              />
            </div>
          </div>
          <SubmitButton className={formStyles.button} pendingLabel="Adding…">
            Add business
          </SubmitButton>
        </form>
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <form method="get" className={styles.searchForm}>
        <input
          className={formStyles.input}
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search businesses by name…"
          aria-label="Search businesses by name"
        />
        <SubmitButton className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`} pendingLabel="Searching…">
          Search
        </SubmitButton>
        {q && (
          <a href="/admin/businesses" className={styles.clearSearch}>
            Clear
          </a>
        )}
      </form>

      {q && (
        <p className={styles.searchSummary}>
          {visibleBusinesses.length} of {businesses.length} business{businesses.length === 1 ? "" : "es"} match
          &ldquo;{q}&rdquo;.
        </p>
      )}

      <div className={styles.businessList}>
        {visibleBusinesses.length === 0 && (
          <p className={styles.emptyNote}>No businesses match &ldquo;{q}&rdquo;.</p>
        )}
        {visibleBusinesses.map((business) => {
          const branchById = new Map(
            business.branches.map((b) => [b.branchId, `${b.name} — ${b.googleReviewUrl}`])
          );

          return (
            <details key={business.businessId} className={styles.businessCard} open={autoExpand}>
              <summary className={styles.businessHeader}>
                <div>
                  <div className={styles.businessName}>{business.name}</div>
                  <div className={styles.businessUrl}>{business.googleReviewUrl}</div>
                </div>
                <span className={styles.businessMeta}>
                  {business.plates.length} plate{business.plates.length === 1 ? "" : "s"} ·{" "}
                  {business.branches.length} branch{business.branches.length === 1 ? "" : "es"}
                </span>
              </summary>

              <div className={styles.sections}>
                <div className={styles.section}>
                  <span className={styles.sectionTitle}>Plates</span>
                  <div className={styles.itemList}>
                    {business.plates.map((plate) => (
                      <div key={plate.plateId} className={styles.item}>
                        <a href={`/r/${plate.slug}`} className={styles.itemPrimary}>
                          /r/{plate.slug}
                        </a>
                        <span className={styles.itemMeta}>
                          {plate.capability} ·{" "}
                          {plate.branchId ? branchById.get(plate.branchId) ?? "unknown branch" : "no branch"}
                        </span>
                      </div>
                    ))}
                    {business.plates.length === 0 && <p className={styles.emptyNote}>No plates yet.</p>}
                  </div>
                  <form
                    action={createPlateAction.bind(null, business.businessId)}
                    className={styles.inlineForm}
                  >
                    <input
                      className={formStyles.input}
                      type="text"
                      name="slug"
                      placeholder="Plate slug"
                      required
                      pattern="[a-z0-9-]+"
                    />
                    <select className={formStyles.select} name="branchId" defaultValue="">
                      <option value="">No branch</option>
                      {business.branches.map((branch) => (
                        <option key={branch.branchId} value={branch.branchId}>
                          {branch.name} — {branch.googleReviewUrl}
                        </option>
                      ))}
                    </select>
                    <SubmitButton
                      className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`}
                      pendingLabel="Adding…"
                    >
                      Add plate
                    </SubmitButton>
                  </form>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionTitle}>Branches</span>
                  <div className={styles.itemList}>
                    {business.branches.map((branch) => (
                      <div key={branch.branchId} className={styles.item}>
                        <span className={styles.itemPrimary}>{branch.name}</span>
                        <span className={styles.itemMeta}>{branch.googleReviewUrl}</span>
                      </div>
                    ))}
                    {business.branches.length === 0 && (
                      <p className={styles.emptyNote}>No branches yet.</p>
                    )}
                  </div>
                  <form
                    action={createBranchAction.bind(null, business.businessId)}
                    className={styles.inlineForm}
                  >
                    <input
                      className={formStyles.input}
                      type="text"
                      name="name"
                      placeholder="Branch name"
                      required
                    />
                    <input
                      className={formStyles.input}
                      type="url"
                      name="googleReviewUrl"
                      placeholder="Google review URL"
                      required
                    />
                    <SubmitButton
                      className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`}
                      pendingLabel="Adding…"
                    >
                      Add branch
                    </SubmitButton>
                  </form>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionTitle}>Owner</span>
                  {business.ownerEmail ? (
                    <div className={styles.ownerBox}>
                      <span className={styles.ownerEmail}>{business.ownerEmail}</span>
                      <span className={styles.ownerNote}>Has dashboard access</span>
                    </div>
                  ) : (
                    <>
                      <p className={styles.emptyNote}>No owner account yet.</p>
                      <form
                        action={addBusinessOwnerAction.bind(null, business.businessId)}
                        className={styles.inlineForm}
                      >
                        <input
                          className={formStyles.input}
                          type="email"
                          name="email"
                          placeholder="Owner email"
                          required
                        />
                        <input
                          className={formStyles.input}
                          type="password"
                          name="password"
                          placeholder="Owner password"
                          required
                        />
                        <SubmitButton
                          className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`}
                          pendingLabel="Adding…"
                        >
                          Add owner
                        </SubmitButton>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </AppShell>
  );
}
