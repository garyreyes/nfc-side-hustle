import { notFound } from "next/navigation";
import { getBranchScanBreakdown, getScanBreakdownByCardType, getScanTimeSeries } from "../api";
import type { ScanRangeDays } from "../constants";
import { ScanTimeSeriesChart } from "./ScanTimeSeriesChart";

const RANGE_OPTIONS: ScanRangeDays[] = [7, 30, 90];

export function parseDays(value: string | string[] | undefined): ScanRangeDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return RANGE_OPTIONS.includes(parsed as ScanRangeDays) ? (parsed as ScanRangeDays) : 30;
}

// Shared by both the platform-admin detail page
// (/admin/dashboard/[businessId]) and the business owner's own
// (/dashboard) — same chart, same range picker, same breakdown table,
// just reached through different auth/framing. Range-picker links stay
// relative (?days=N) so they resolve correctly against whichever path
// this is rendered under, without needing a basePath prop.
export async function BusinessAnalyticsView({
  businessId,
  days,
}: {
  businessId: string;
  days: ScanRangeDays;
}) {
  const [timeSeries, breakdown, branchBreakdown] = await Promise.all([
    getScanTimeSeries(businessId, days),
    getScanBreakdownByCardType(businessId),
    getBranchScanBreakdown(businessId),
  ]);

  if (timeSeries === null || breakdown === null || branchBreakdown === null) {
    notFound();
  }

  return (
    <>
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

      {branchBreakdown.length > 0 && (
        <>
          <h2>By branch</h2>
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>
                  Branch
                </th>
                <th scope="col" style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 8 }}>
                  Scans
                </th>
              </tr>
            </thead>
            <tbody>
              {branchBreakdown.map((row) => (
                <tr key={row.branchId ?? "no-branch"}>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                    {row.totalScans}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
