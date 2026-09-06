export interface MetricEntry {
  id: string
  value: number
}

export function parseMetricsJson(raw: unknown): MetricEntry[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return []

  const metrics = (raw as { metrics?: unknown }).metrics
  if (!Array.isArray(metrics)) return []

  return metrics.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return []
    }

    const record = entry as { id?: unknown; value?: unknown }
    const id = typeof record.id === "string" ? record.id.trim() : ""
    const value = record.value
    if (!id || typeof value !== "number" || Number.isNaN(value)) return []

    return [{ id, value }]
  })
}

export function getMetric(entries: MetricEntry[], id: string): number | null {
  return entries.find((entry) => entry.id === id)?.value ?? null
}
