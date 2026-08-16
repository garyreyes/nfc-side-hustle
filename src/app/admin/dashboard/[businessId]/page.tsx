import Link from "next/link";
import { notFound } from "next/navigation";
import { getScanBreakdownByCardType, getScanTimeSeries } from "@/features/analytics/api";
import { ScanTimeSeriesChart } from "@/features/analytics/components/ScanTimeSeriesChart";
import type { ScanRangeDays } from "@/features/analytics/constants";
import { requirePlatformAdmin } from "@/lib/auth/dal";

// Not strictly required (a dynamic route segment with no
// generateStaticParams is already rendered on-demand), but kept explicit
// after 3b's build silently static-prerendered a sibling page with no
// dynamic signal — see PROJECT_FACTS.md.
export const dynamic = "force-dynamic";

const RANGE_OPTIONS: ScanRangeDays[] = [7, 30, 90];

function parseDays(value: string | string[] | undefined): ScanRangeDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return RANGE_OPTIONS.includes(parsed as ScanRangeDays) ? (parsed as ScanRangeDays) : 30;
}

export default async function BusinessDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  await requirePlatformAdmin();

  const { businessId } = await params;
  const days = parseDays((await searchParams).days);

  const [timeSeries, breakdown] = await Promise.all([
    getScanTimeSeries(businessId, days),
    getScanBreakdownByCardType(businessId),
  ]);

  if (timeSeries === null || breakdown === null) {
    notFound();
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <p>
        {/* Link, not a plain <a>, only because of an ESLint rule quirk:
            the regex no-html-link-for-pages generates for the sibling
            dynamic route /admin/dashboard/[businessId] also matches the
            empty-segment case /admin/dashboard/, false-positiving on a
            literal href here. Every other internal admin link in this
            codebase intentionally stays a plain <a>. */}
        <Link href="/admin/dashboard">Back to dashboard</Link>
      </p>
      <h1>Scan activity</h1>

      <nav aria-label="Date range" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {RANGE_OPTIONS.map((option) => (
          <a
            key={option}
            href={`?days=${option}`}
            aria-current={option === days ? "true" : undefined}
            style={{ fontWeight: option === days ? "bold" : "normal" }}
          >
            {option} days
          </a>
        ))}
      </nav>

      <h2>Scans over time</h2>
      <ScanTimeSeriesChart data={timeSeries} />

      <h2>By card type</h2>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>
              Type
            </th>
            <th scope="col" style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 8 }}>
              Scans
            </th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((row) => (
            <tr key={row.type}>
              <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.type}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                {row.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
