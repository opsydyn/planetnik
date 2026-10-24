// Reductions over numeric collections without spreading into Math.max/Math.min.
// `Math.max(...values)` passes every element as a function argument, which
// exceeds V8's argument limit (~130k) and throws "Maximum call stack size
// exceeded" on large inputs. These helpers are single strict left-folds
// (foldl') over a lazy iterable: one pass, constant extra space, no
// intermediate array. A whole-dataset reduction like min/max is inherently
// strict, so foldl' is the right idiom.

export function maxOf(values: Iterable<number>, seed: number = Number.NEGATIVE_INFINITY): number {
  let result = seed
  for (const value of values) {
    if (value > result) result = value
  }
  return result
}
