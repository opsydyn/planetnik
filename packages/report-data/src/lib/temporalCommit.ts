export type TemporalCommitValue = string | Date | number | null | undefined

function formatTemporalCommitDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function normalizeTemporalCommit(value: TemporalCommitValue): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : formatTemporalCommitDate(value)
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return ""
    }

    const parsedDate = new Date(value)
    return Number.isNaN(parsedDate.getTime()) ? String(value) : formatTemporalCommitDate(parsedDate)
  }

  const text = String(value).trim()
  if (text.length === 0) {
    return ""
  }

  const parsedDate = new Date(text)
  return Number.isNaN(parsedDate.getTime()) ? text : formatTemporalCommitDate(parsedDate)
}
