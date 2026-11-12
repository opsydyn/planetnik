import { describe, expect, test } from "bun:test"
import { categoryBands, numericAxis } from "../scaffold/axes.js"

describe("numericAxis", () => {
  test("maps the domain across the extent and labels its ticks", () => {
    const axis = numericAxis(1000, 400)
    expect(axis.domain).toEqual([0, 1000])
    expect(axis.scale(0)).toBe(0)
    expect(axis.scale(1000)).toBe(400)
    expect(axis.ticks.length).toBeGreaterThan(0)
    expect(axis.ticks.every((t) => t.position >= 0 && t.position <= 400)).toBe(true)
  })

  test("collapses an all-zero series to a unit domain instead of dividing by a zero span", () => {
    const axis = numericAxis(0, 400)
    expect(axis.domain).toEqual([0, 1])
    expect(Number.isFinite(axis.scale(0))).toBe(true)
  })

  test("rejects a non-finite max the same way", () => {
    expect(numericAxis(Number.NaN, 400).domain).toEqual([0, 1])
  })

  test("applies the supplied label format", () => {
    const axis = numericAxis(100, 200, 2, (v) => `${v}%`)
    expect(axis.ticks.every((t) => t.label.endsWith("%"))).toBe(true)
  })
})

describe("categoryBands", () => {
  test("preserves input order and keeps bands inside the extent", () => {
    const bands = categoryBands(["a", "b", "c"], 300)
    expect(bands.map((b) => b.key)).toEqual(["a", "b", "c"])
    expect(bands.every((b) => b.start >= 0 && b.start + b.size <= 300)).toBe(true)
  })

  test("centres are the midpoint of each band", () => {
    for (const b of categoryBands(["a", "b"], 300)) {
      expect(b.centre).toBeCloseTo(b.start + b.size / 2)
    }
  })

  test("returns nothing for no categories", () => {
    expect(categoryBands([], 300)).toEqual([])
  })
})
