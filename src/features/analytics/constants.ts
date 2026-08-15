// The real V3 launch cutoff (see ARCHITECTURE.md § V3): every dashboard
// query excludes scans before this instant, so the V1/V2/V3 test
// scan_events accumulated during development never surface as if they
// were real. No manual testing hit the live production redirect route
// during 3a/3b/3c (only localhost + read-only scripts), so this is a
// clean cutoff with nothing wrongly excluded.
export const DASHBOARD_DATA_START_AT = new Date("2026-08-15T20:11:15Z");

export const MANILA_TIMEZONE = "Asia/Manila";

export type ScanRangeDays = 7 | 30 | 90;
