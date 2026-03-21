export interface MetricEntry {
  id: string
  value: number
}

export function parseMetricsText(text: string | null | undefined): MetricEntry[] {
  if (!text) return []

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const colonIndex = line.indexOf(":")
      if (colonIndex < 0) return []

      const id = line.slice(0, colonIndex).trim()
      const value = Number.parseFloat(line.slice(colonIndex + 1).trim())
      if (!id || Number.isNaN(value)) return []

      return [{ id, value }]
    })
}

export function getMetric(entries: MetricEntry[], id: string): number | null {
  return entries.find((entry) => entry.id === id)?.value ?? null
}
