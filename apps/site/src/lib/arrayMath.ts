// Reductions over numeric collections without spreading into Math.max/Math.min.
// `Math.max(...values)` passes every element as a function argument, which
// exceeds V8's argument limit (~130k) and throws "Maximum call stack size
// exceeded" on large inputs — and the Astro SSR/prerender runtime is V8, so a
// big repo (e.g. effect-smol) crashes the build. These helpers are single
// strict left-folds (foldl') over a lazy iterable: one pass, constant extra
// space, no intermediate array. A whole-dataset reduction like min/max
// normalisation is inherently strict (you must see every element before the
// result is known), so foldl' is the right idiom — a lazy foldr buys nothing.

export interface MinMax {
  readonly min: number
  readonly max: number
}

// Lazy map over any iterable — transforms elements on demand without
// materialising an intermediate array, so `minMax(map(edges.values(), pluck))`
// stays a single allocation-free pass.
export function* map<T, U>(values: Iterable<T>, fn: (value: T) => U): Generator<U> {
  for (const value of values) {
    yield fn(value)
  }
}

// Fused min+max in a single pass. Empty input yields {min: +Infinity,
// max: -Infinity}, mirroring Math.min()/Math.max() with no arguments so callers
// can fold in their own bounds afterwards (e.g. Math.max(stats.max, 1)).
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
