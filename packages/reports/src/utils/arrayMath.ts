// Reductions over numeric collections without spreading into Math.max/Math.min.
// `Math.max(...values)` passes every element as a function argument, which
// exceeds V8's argument limit (~130k) and throws "Maximum call stack size
// exceeded" on large inputs. These helpers are single strict left-folds
// (foldl') over a lazy iterable: one pass, constant extra space, no
// intermediate array. A whole-dataset reduction like min/max is inherently
// strict, so foldl' is the right idiom.

export interface MinMax {
  readonly min: number
  readonly max: number
}

export function minMax(values: Iterable<number>): MinMax {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  return { min, max }
}

export function maxOf(values: Iterable<number>, seed: number = Number.NEGATIVE_INFINITY): number {
  let result = seed
  for (const value of values) {
    if (value > result) result = value
  }
  return result
}

export function minOf(values: Iterable<number>, seed: number = Number.POSITIVE_INFINITY): number {
  let result = seed
  for (const value of values) {
    if (value < result) result = value
  }
  return result
}
