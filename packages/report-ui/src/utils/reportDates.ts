export type ReportDateValue = string | number | Date | null | undefined

function formatISODate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function normalizeReportDate(value: ReportDateValue): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : formatISODate(value)
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return ""
    }

    const parsedDate = new Date(value)
    return Number.isNaN(parsedDate.getTime()) ? String(value) : formatISODate(parsedDate)
  }

  const text = String(value).trim()
  if (text.length === 0) {
    return ""
  }

  const isoDateMatch = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoDateMatch?.[1]) {
    return isoDateMatch[1]
  }

  const parsedDate = new Date(text)
  return Number.isNaN(parsedDate.getTime()) ? text : formatISODate(parsedDate)
}

export function formatReportDate(value: ReportDateValue, fallback = "—"): string {
  const normalized = normalizeReportDate(value)
  return normalized || fallback
}
