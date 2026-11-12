/**
 * Axis geometry, including the categorical axis that `@opsydyn/foldkit-viz`
 * does not cover: its `axis` helper formats numbers only.
 */

import { band, linear, linearTicks } from "@opsydyn/foldkit-viz/math/scale"

export type NumericTick = Readonly<{ value: number; position: number; label: string }>
export type CategoryBand = Readonly<{ key: string; start: number; size: number; centre: number }>

export type NumericAxis = Readonly<{
  ticks: ReadonlyArray<NumericTick>
  scale: (value: number) => number
  domain: readonly [number, number]
}>

/**
 * A zero-based numeric axis over `[0, max]`. A non-positive or non-finite max
 * collapses to `[0, 1]` so an all-zero series still renders an axis instead of
 * dividing by a zero span.
 */
export const numericAxis = (
  max: number,
  extent: number,
  tickCount = 4,
  format: (value: number) => string = String,
): NumericAxis => {
  const upper = Number.isFinite(max) && max > 0 ? max : 1
  const domain = [0, upper] as const
  const scale = linear({ domain, range: [0, extent] })
  return {
    domain,
    scale,
    ticks: linearTicks(domain, tickCount).map((value) => ({
      value,
      position: scale(value),
      label: format(value),
    })),
  }
}

/** Evenly spaced bands for categorical keys, preserving input order. */
export const categoryBands = (
  keys: ReadonlyArray<string>,
  extent: number,
  paddingInner = 0.25,
  paddingOuter = 0.1,
): ReadonlyArray<CategoryBand> => {
  if (keys.length === 0) return []
  const scale = band({ domain: keys, range: [0, extent], paddingInner, paddingOuter })
  return keys.map((key) => {
    const start = scale.position(key)
    return { key, start, size: scale.bandwidth, centre: start + scale.bandwidth / 2 }
  })
}
