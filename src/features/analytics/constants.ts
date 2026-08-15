// TODO(3c): set this to the actual V3 launch date/time, right before
// 3c's PR merges, once all manual verification traffic for 3a/3b/3c is
// done (see ARCHITECTURE.md § V3). Until then this placeholder is
// intentionally far in the future, so every dashboard query returns
// zero counts instead of surfacing V1/V2/V3 test scan_events as if
// they were real.
export const DASHBOARD_DATA_START_AT = new Date("2100-01-01T00:00:00Z");

export const MANILA_TIMEZONE = "Asia/Manila";

export type ScanRangeDays = 7 | 30 | 90;
