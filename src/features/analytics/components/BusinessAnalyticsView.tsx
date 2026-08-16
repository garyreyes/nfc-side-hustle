import { notFound } from "next/navigation";
import {
  getBranchScanBreakdown,
  getScanBreakdownByCapability,
  getScanBreakdownByInteractionType,
  getScanTimeSeries,
} from "../api";
import type { ScanRangeDays } from "../constants";
import styles from "./BusinessAnalyticsView.module.css";
import tableStyles from "@/shared/ui/table.module.css";
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
  const [timeSeries, breakdown, channelBreakdown, branchBreakdown] = await Promise.all([
    getScanTimeSeries(businessId, days),
    getScanBreakdownByCapability(businessId),
    getScanBreakdownByInteractionType(businessId),
    getBranchScanBreakdown(businessId),
  ]);

  if (timeSeries === null || breakdown === null || channelBreakdown === null || branchBreakdown === null) {
    notFound();
  }

  return (
    <>
      <nav aria-label="Date range" className={styles.rangeNav}>
        {RANGE_OPTIONS.map((option) => (
          <a
            key={option}
            href={`?days=${option}`}
            aria-current={option === days ? "true" : undefined}
            className={option === days ? `${styles.rangeLink} ${styles.rangeLinkActive}` : styles.rangeLink}
          >
            {option} days
          </a>
        ))}
      </nav>

      <div className={styles.chartCard}>
        <h2 className={styles.sectionTitle}>Scans over time</h2>
        <ScanTimeSeriesChart data={timeSeries} />
      </div>

      <div className={styles.tableCard}>
        <h2 className={styles.sectionTitle}>By capability</h2>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col" data-align="right">
                Scans
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((row) => (
              <tr key={row.capability}>
                <td>{row.capability}</td>
                <td data-align="right">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableCard}>
        <h2 className={styles.sectionTitle}>By channel</h2>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col" data-align="right">
                Scans
              </th>
            </tr>
          </thead>
          <tbody>
            {channelBreakdown.map((row) => (
              <tr key={row.interactionType}>
                <td>{row.interactionType}</td>
                <td data-align="right">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {branchBreakdown.length > 0 && (
        <div className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>By branch</h2>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th scope="col">Branch</th>
                <th scope="col" data-align="right">
                  Scans
                </th>
              </tr>
            </thead>
            <tbody>
              {branchBreakdown.map((row) => (
                <tr key={row.branchId ?? "no-branch"}>
                  <td>{row.name}</td>
                  <td data-align="right">{row.totalScans}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
