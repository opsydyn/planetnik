import { Metric } from "./Metric.js"

export class MetricsList {
  readonly metrics: Metric[] = []

  addMetric(): Metric {
    const metric = new Metric()
    this.metrics.push(metric)
    return metric
  }

  addSystemMetric(): Metric {
    return this.addMetric()
  }

  remove(id: string): void {
    const idx = this.metrics.findIndex((m) => m.id === id)
    if (idx >= 0) this.metrics.splice(idx, 1)
  }

  getMetricById(id: string): Metric | undefined {
    return this.metrics.find((m) => m.id === id)
  }
}
