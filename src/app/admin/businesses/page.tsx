import {
  addBusinessOwnerAction,
  createBranchAction,
  createBusinessAction,
  createPlateAction,
  updateBusinessAction,
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

const REMINDER_PREVIEW_LENGTH = 90;

// The whole point of contactName/notes is to jog your memory while
// scanning search results — so the preview has to show up in the
// collapsed <summary>, not just after opening a card. Combines both into
// one line and truncates so a long note doesn't blow out the header.
function buildReminder(business: { contactName: string | null; notes: string | null }): string | null {
  const parts = [business.contactName, business.notes].filter((p): p is string => !!p);
  if (parts.length === 0) return null;
  const joined = parts.join(" — ");
  return joined.length > REMINDER_PREVIEW_LENGTH
    ? `${joined.slice(0, REMINDER_PREVIEW_LENGTH)}…`
    : joined;
}

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
              Google review URL (optional)
            </label>
            <input
              className={formStyles.input}
              id="googleReviewUrl"
              type="url"
              name="googleReviewUrl"
              placeholder="Leave blank for a quick sale — add it later once you have it"
            />
          </div>
          <p className={formStyles.helperText}>
            Creates the business only — no plate yet. Assign a real one from inventory on{" "}
            <code>/admin/plates</code>, or use this business&rsquo;s own &ldquo;Add plate&rdquo; form
            below for a one-off untracked plate. No review URL yet? Leave it blank and fill it in later
            from this business&rsquo;s Edit form — the plate will just say &ldquo;not set up yet&rdquo;
            until then.
          </p>
          <div className={formStyles.formRow}>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="contactName">
                Contact name (optional)
              </label>
              <input className={formStyles.input} id="contactName" type="text" name="contactName" />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="contactEmail">
                Contact email (optional)
              </label>
              <input className={formStyles.input} id="contactEmail" type="email" name="contactEmail" />
            </div>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.fieldLabel} htmlFor="notes">
              Notes (optional)
            </label>
            <textarea
              className={formStyles.input}
              id="notes"
              name="notes"
              rows={2}
              placeholder="Anything to jog your memory later — e.g. &quot;the owner who gave us coffee, bald.&quot;"
            />
          </div>
          <p className={formStyles.helperText}>
            Contact name, email, and notes are just for your own reference — never shown to the
            business, unrelated to the Owner login below.
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
          const reminder = buildReminder(business);

          return (
            <details key={business.businessId} className={styles.businessCard} open={autoExpand}>
              <summary className={styles.businessHeader}>
                <div>
                  <div className={styles.businessName}>{business.name}</div>
                  <div className={styles.businessUrl}>
                    {business.googleReviewUrl ?? "No review URL yet — edit to add one"}
                  </div>
                  {reminder && <div className={styles.businessReminder}>{reminder}</div>}
                </div>
                <span className={styles.businessMeta}>
                  {business.plates.length} plate{business.plates.length === 1 ? "" : "s"} ·{" "}
                  {business.branches.length} branch{business.branches.length === 1 ? "" : "es"}
                </span>
              </summary>

              <div className={styles.sections}>
                <div className={styles.section}>
                  <span className={styles.sectionTitle}>Details</span>
                  <form
                    action={updateBusinessAction.bind(null, business.businessId)}
                    className={formStyles.form}
                  >
                    <div className={formStyles.field}>
                      <label className={formStyles.fieldLabel} htmlFor={`name-${business.businessId}`}>
                        Business name
                      </label>
                      <input
                        className={formStyles.input}
                        id={`name-${business.businessId}`}
                        type="text"
                        name="name"
                        defaultValue={business.name}
                        required
                      />
                    </div>
                    <div className={formStyles.field}>
                      <label
                        className={formStyles.fieldLabel}
                        htmlFor={`googleReviewUrl-${business.businessId}`}
                      >
                        Google review URL
                      </label>
                      <input
                        className={formStyles.input}
                        id={`googleReviewUrl-${business.businessId}`}
                        type="url"
                        name="googleReviewUrl"
                        defaultValue={business.googleReviewUrl ?? ""}
                        placeholder="Not set up yet"
                      />
                    </div>
                    <div className={formStyles.formRow}>
                      <div className={formStyles.field}>
                        <label
                          className={formStyles.fieldLabel}
                          htmlFor={`contactName-${business.businessId}`}
                        >
                          Contact name
                        </label>
                        <input
                          className={formStyles.input}
                          id={`contactName-${business.businessId}`}
                          type="text"
                          name="contactName"
                          defaultValue={business.contactName ?? ""}
                        />
                      </div>
                      <div className={formStyles.field}>
                        <label
                          className={formStyles.fieldLabel}
                          htmlFor={`contactEmail-${business.businessId}`}
                        >
                          Contact email
                        </label>
                        <input
                          className={formStyles.input}
                          id={`contactEmail-${business.businessId}`}
                          type="email"
                          name="contactEmail"
                          defaultValue={business.contactEmail ?? ""}
                        />
                      </div>
                    </div>
                    <div className={formStyles.field}>
                      <label className={formStyles.fieldLabel} htmlFor={`notes-${business.businessId}`}>
                        Notes
                      </label>
                      <textarea
                        className={formStyles.input}
                        id={`notes-${business.businessId}`}
                        name="notes"
                        rows={2}
                        defaultValue={business.notes ?? ""}
                      />
                    </div>
                    <SubmitButton
                      className={`${formStyles.buttonSecondary} ${formStyles.buttonSmall}`}
                      pendingLabel="Saving…"
                    >
                      Save details
                    </SubmitButton>
                  </form>
                </div>

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
