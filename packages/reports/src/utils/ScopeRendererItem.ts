import type { NumericMetric } from "@planetnik/analyzer"

export class ScopeRendererItem {
  linesOfCode!: NumericMetric
  filesCount!: NumericMetric
  filesFragment = ""
}
