import { getBusinessScanTotals } from "@/features/analytics/api";

// Without an explicit opt-out, Next.js statically prerenders this page at
// build time (it has no dynamic route segment or searchParams like
// /admin/businesses does) — which would both fail in CI (no DATABASE_URL
// at build time) and, worse, freeze scan counts at whatever they were on
// the last deploy instead of showing live data on every request.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const totals = await getBusinessScanTotals();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>Dashboard</h1>
      <p>
        <a href="/admin/businesses">Manage businesses</a>
      </p>

      <h2>Scans by business ({totals.length})</h2>
      {totals.length === 0 ? (
        <p>No businesses yet.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th
                scope="col"
                style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}
              >
                Business
              </th>
              <th
                scope="col"
                style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 8 }}
              >
                Total scans
              </th>
              <th scope="col" style={{ borderBottom: "1px solid #ccc", padding: 8 }}>
                <span
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0 0 0 0)",
                  }}
                >
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {totals.map((business) => (
              <tr key={business.businessId}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{business.name}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                  {business.totalScans}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                  <a href={`/admin/dashboard/${business.businessId}`}>View details</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
