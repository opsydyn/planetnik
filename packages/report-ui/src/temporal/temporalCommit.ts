import { normalizeReportDate } from "../utils/reportDates.js"

export type TemporalCommitValue = string | Date | number | null | undefined

export function normalizeTemporalCommit(value: TemporalCommitValue): string {
  return normalizeReportDate(value)
}
