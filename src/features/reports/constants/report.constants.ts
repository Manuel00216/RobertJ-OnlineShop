import type { ReportGranularity } from "../types/report.types";

/**
 * Display-only mirror of the reporting timezone the RPCs bucket on. The
 * authoritative value lives in the migration (`'Asia/Manila'`); this is used
 * purely to label the UI so users know which day boundary the numbers use.
 */
export const REPORT_TIMEZONE_LABEL = "Asia/Manila";

export const REPORT_GRANULARITIES = ["day", "week", "month"] as const;

export const GRANULARITY_LABELS: Record<ReportGranularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

/** Rolling-window presets (days) plus the calendar "this month" option. */
export const DATE_PRESETS = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "90d", label: "90D", days: 90 },
  { id: "month", label: "This month", days: null },
] as const;

export type DatePresetId = (typeof DATE_PRESETS)[number]["id"];

export const DEFAULT_REPORT_DAYS = 30;
export const DEFAULT_GRANULARITY: ReportGranularity = "day";
export const TOP_PRODUCTS_LIMIT = 5;
