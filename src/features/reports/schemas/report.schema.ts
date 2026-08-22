import { z } from "zod";

import { REPORT_GRANULARITIES } from "../constants/report.constants";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

/**
 * Validates the resolved report filters. Used by the CSV export action (the
 * page itself coerces raw search params with fallbacks via
 * `parseReportFilters`, so a malformed URL renders defaults rather than 500s).
 * `from <= to` is enforced so a reversed range can't be submitted.
 */
export const reportFiltersSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    granularity: z.enum(REPORT_GRANULARITIES),
    shopId: z.string().uuid().nullable().default(null),
  })
  .refine((v) => v.from <= v.to, {
    message: "The start date must be on or before the end date",
    path: ["from"],
  });

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;
