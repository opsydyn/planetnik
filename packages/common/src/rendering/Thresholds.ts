import { BasicColorInfo } from "../utils/BasicColorInfo.js"

export class Threshold {
  constructor(
    readonly title: string,
    readonly threshold: number,
    readonly color: BasicColorInfo,
  ) {}
}

function rgb(r: number, g: number, b: number): BasicColorInfo {
  return new BasicColorInfo(r, g, b)
}

export const RISK_GREEN = rgb(0.2, 0.8, 0.2)
export const RISK_LIGHT_GREEN = rgb(0.6, 0.8, 0.2)
export const RISK_YELLOW = rgb(0.9, 0.9, 0.0)
export const RISK_ORANGE = rgb(0.9, 0.5, 0.0)
export const RISK_RED = rgb(0.8, 0.2, 0.2)

export const UNIT_LINES: Threshold[] = [
  new Threshold("0-10", 10, RISK_GREEN),
  new Threshold("11-20", 20, RISK_LIGHT_GREEN),
  new Threshold("21-50", 50, RISK_YELLOW),
  new Threshold("51-100", 100, RISK_ORANGE),
  new Threshold("101+", Infinity, RISK_RED),
]

export const UNIT_MCCABE: Threshold[] = [
  new Threshold("1-5", 5, RISK_GREEN),
  new Threshold("6-10", 10, RISK_LIGHT_GREEN),
  new Threshold("11-25", 25, RISK_YELLOW),
  new Threshold("26-50", 50, RISK_ORANGE),
  new Threshold("51+", Infinity, RISK_RED),
]

export const UNIT_PARAMS: Threshold[] = [
  new Threshold("0-2", 2, RISK_GREEN),
  new Threshold("3-5", 5, RISK_LIGHT_GREEN),
  new Threshold("6-10", 10, RISK_YELLOW),
  new Threshold("11-15", 15, RISK_ORANGE),
  new Threshold("16+", Infinity, RISK_RED),
]

export function getColors(thresholds: readonly Threshold[]): string[] {
  return thresholds.map((t) => t.color.toHex())
}

export function getColor(thresholds: readonly Threshold[], value: number): BasicColorInfo {
  for (const t of thresholds) {
    if (value <= t.threshold) return t.color
  }
  return thresholds[thresholds.length - 1]?.color ?? new BasicColorInfo()
}
