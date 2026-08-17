import { recordInventoryArrivalAction } from "@/features/business-management/actions";
import { getInventorySummary } from "@/features/business-management/api";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { AppShell } from "@/shared/ui/AppShell";
import { Card } from "@/shared/ui/Card";
import formStyles from "@/shared/ui/form.module.css";
import { StatCard } from "@/shared/ui/StatCard";
import { SubmitButton } from "@/shared/ui/SubmitButton";
import tableStyles from "@/shared/ui/table.module.css";
import styles from "./page.module.css";

function formatPeso(cents: number | null): string {
  if (cents === null) return "—";
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePlatformAdmin();
  const { error } = await searchParams;

  const summary = await getInventorySummary();
  const totals = summary.reduce(
    (acc, row) => ({
      ordered: acc.ordered + row.ordered,
      remaining: acc.remaining + row.remaining,
      soldToday: acc.soldToday + row.soldToday,
      soldAllTime: acc.soldAllTime + row.soldAllTime,
      totalCostCents: acc.totalCostCents + (row.totalCostCents ?? 0),
      revenueTodayCents: acc.revenueTodayCents + (row.revenueTodayCents ?? 0),
      revenueAllTimeCents: acc.revenueAllTimeCents + (row.revenueAllTimeCents ?? 0),
      profitAllTimeCents: acc.profitAllTimeCents + (row.profitAllTimeCents ?? 0),
      // A grand-total profit is only meaningful if at least one
      // capability actually has priced sales — otherwise "₱0 profit"
      // would misleadingly read as "broke even" instead of "no data".
      hasAnyProfitData: acc.hasAnyProfitData || row.profitAllTimeCents !== null,
    }),
    {
      ordered: 0,
      remaining: 0,
      soldToday: 0,
      soldAllTime: 0,
      totalCostCents: 0,
      revenueTodayCents: 0,
      revenueAllTimeCents: 0,
      profitAllTimeCents: 0,
      hasAnyProfitData: false,
    }
  );

  return (
    <AppShell
      navItems={[
        { label: "Businesses", href: "/admin/businesses", active: false },
        { label: "Dashboard", href: "/admin/dashboard", active: false },
        { label: "Plates", href: "/admin/plates", active: false },
        { label: "Inventory", href: "/admin/inventory", active: true },
        { label: "Team", href: "/admin/team", active: false },
      ]}
      email={session.email}
      roleLabel="Platform admin"
      title="Inventory"
      subtitle="Hardware procurement and stock — not visible to businesses or their owners."
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
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatCard label="Ordered (all time)" value={totals.ordered} />
        <StatCard label="Remaining" value={totals.remaining} />
        <StatCard label="Sold today" value={totals.soldToday} />
        <StatCard label="Sold (all time)" value={totals.soldAllTime} />
        <StatCard label="Revenue today" value={formatPeso(totals.revenueTodayCents)} />
        <StatCard label="Revenue (all time)" value={formatPeso(totals.revenueAllTimeCents)} />
        <StatCard
          label="Profit (all time)"
          value={totals.hasAnyProfitData ? formatPeso(totals.profitAllTimeCents) : "—"}
        />
        <StatCard label="Total cost (all inventory)" value={formatPeso(totals.totalCostCents)} />
      </div>

      <Card title="Record inventory arrival">
        <form action={recordInventoryArrivalAction} className={formStyles.form}>
          <div className={styles.formRow3}>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="batchName">
                Batch name
              </label>
              <input className={formStyles.input} id="batchName" type="text" name="batchName" required />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="capability">
                Capability
              </label>
              <select className={formStyles.select} id="capability" name="capability" required defaultValue="qr">
                <option value="qr">QR only</option>
                <option value="nfc">NFC only</option>
                <option value="combo">Combo</option>
              </select>
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="quantity">
                Quantity
              </label>
              <input
                className={formStyles.input}
                id="quantity"
                type="number"
                name="quantity"
                min="1"
                step="1"
                required
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.fieldLabel} htmlFor="unitCost">
                Unit cost (₱)
              </label>
              <input
                className={formStyles.input}
                id="unitCost"
                type="number"
                name="unitCost"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>
          <p className={formStyles.helperText}>
            Creates a new batch and that many real unassigned plates, ready to write and assign as
            they sell — same as arrivals go through <code>/admin/plates</code> afterward.
          </p>
          <SubmitButton className={formStyles.button} pendingLabel="Recording…">
            Record arrival
          </SubmitButton>
        </form>
      </Card>

      <div style={{ height: "var(--space-6)" }} />

      <div className={styles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col" data-align="right">
                Ordered
              </th>
              <th scope="col" data-align="right">
                Remaining
              </th>
              <th scope="col" data-align="right">
                Sold today
              </th>
              <th scope="col" data-align="right">
                Sold this week
              </th>
              <th scope="col" data-align="right">
                Sold this month
              </th>
              <th scope="col" data-align="right">
                Sold all time
              </th>
              <th scope="col" data-align="right">
                Total cost
              </th>
              <th scope="col" data-align="right">
                Avg. cost
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => (
              <tr key={row.capability}>
                <td className={styles.capabilityLabel}>{row.capability}</td>
                <td data-align="right">{row.ordered}</td>
                <td data-align="right">{row.remaining}</td>
                <td data-align="right">{row.soldToday}</td>
                <td data-align="right">{row.soldThisWeek}</td>
                <td data-align="right">{row.soldThisMonth}</td>
                <td data-align="right">{row.soldAllTime}</td>
                <td data-align="right">{formatPeso(row.totalCostCents)}</td>
                <td data-align="right">{formatPeso(row.averageCostCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.costNote}>
        Cost columns only count plates whose cost was recorded through &ldquo;Record inventory
        arrival&rdquo; — plates added ad-hoc via <code>/admin/businesses</code> have no cost on file.
      </p>

      <div style={{ height: "var(--space-6)" }} />

      <h2 className={styles.sectionHeading}>Sales &amp; revenue</h2>
      <div className={styles.tableWrap}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col" data-align="right">
                Sold today
              </th>
              <th scope="col" data-align="right">
                Revenue today
              </th>
              <th scope="col" data-align="right">
                Sold this week
              </th>
              <th scope="col" data-align="right">
                Revenue this week
              </th>
              <th scope="col" data-align="right">
                Sold this month
              </th>
              <th scope="col" data-align="right">
                Revenue this month
              </th>
              <th scope="col" data-align="right">
                Revenue all time
              </th>
              <th scope="col" data-align="right">
                Cost of goods sold
              </th>
              <th scope="col" data-align="right">
                Profit all time
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => (
              <tr key={row.capability}>
                <td className={styles.capabilityLabel}>{row.capability}</td>
                <td data-align="right">{row.soldToday}</td>
                <td data-align="right">{formatPeso(row.revenueTodayCents)}</td>
                <td data-align="right">{row.soldThisWeek}</td>
                <td data-align="right">{formatPeso(row.revenueThisWeekCents)}</td>
                <td data-align="right">{row.soldThisMonth}</td>
                <td data-align="right">{formatPeso(row.revenueThisMonthCents)}</td>
                <td data-align="right">{formatPeso(row.revenueAllTimeCents)}</td>
                <td data-align="right">{formatPeso(row.costOfGoodsSoldCents)}</td>
                <td data-align="right">{formatPeso(row.profitAllTimeCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.costNote}>
        Revenue only counts plates assigned with a sale price entered on <code>/admin/plates</code>
        — an assignment left blank stays untracked, same as cost. Cost of goods sold only counts
        already-sold plates (unlike &ldquo;Total cost&rdquo; above, which includes unsold stock).
      </p>
    </AppShell>
  );
}
