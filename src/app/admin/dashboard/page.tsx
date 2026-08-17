import { getBusinessScanTotals } from "@/features/analytics/api";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { AppShell } from "@/shared/ui/AppShell";
import { StatCard } from "@/shared/ui/StatCard";
import tableStyles from "@/shared/ui/table.module.css";

// Without an explicit opt-out, Next.js statically prerenders this page at
// build time (it has no dynamic route segment or searchParams like
// /admin/businesses does) — which would both fail in CI (no DATABASE_URL
// at build time) and, worse, freeze scan counts at whatever they were on
// the last deploy instead of showing live data on every request.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await requirePlatformAdmin();

  const totals = await getBusinessScanTotals();
  const totalScans = totals.reduce((sum, b) => sum + b.totalScans, 0);

  return (
    <AppShell
      navItems={[
        { label: "Businesses", href: "/admin/businesses", active: false },
        { label: "Dashboard", href: "/admin/dashboard", active: true },
        { label: "Plates", href: "/admin/plates", active: false },
        { label: "Inventory", href: "/admin/inventory", active: false },
        { label: "Team", href: "/admin/team", active: false },
      ]}
      email={session.email}
      roleLabel="Platform admin"
      title="Dashboard"
      subtitle="Scan activity across every business on the platform."
    >
      <div
        style={{
          display: "grid",
          gap: "var(--space-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatCard label="Businesses" value={totals.length} />
        <StatCard label="Total scans" value={totalScans} />
      </div>

      {totals.length === 0 ? (
        <p className={tableStyles.emptyState}>No businesses yet.</p>
      ) : (
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">Business</th>
              <th scope="col" data-align="right">
                Total scans
              </th>
              <th scope="col">
                <span className={tableStyles.visuallyHidden}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {totals.map((business) => (
              <tr key={business.businessId}>
                <td>{business.name}</td>
                <td data-align="right">{business.totalScans}</td>
                <td data-align="right">
                  <a href={`/admin/dashboard/${business.businessId}`}>View details</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
