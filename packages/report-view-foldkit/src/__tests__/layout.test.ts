import { describe, expect, test } from "bun:test"
import { chartLayout, DEFAULT_MARGINS, heightForRows } from "../scaffold/layout.js"

describe("chartLayout", () => {
  test("subtracts margins from the frame to produce the plot area", () => {
    const layout = chartLayout({ width: 460, height: 200 }, { top: 10, right: 20, bottom: 30, left: 40 })
    expect(layout.plot).toEqual({ left: 40, top: 10, width: 400, height: 160 })
  })

  test("clamps an over-constrained frame to an empty plot rather than negative geometry", () => {
    const layout = chartLayout({ width: 50, height: 20 }, { top: 10, right: 40, bottom: 30, left: 40 })
    expect(layout.plot.width).toBe(0)
    expect(layout.plot.height).toBe(0)
  })
})

describe("heightForRows", () => {
  test("fits the rows plus vertical margins", () => {
    expect(heightForRows(5, 26, DEFAULT_MARGINS)).toBe(DEFAULT_MARGINS.top + DEFAULT_MARGINS.bottom + 130)
  })

  test("treats a negative row count as empty", () => {
    expect(heightForRows(-3, 26, DEFAULT_MARGINS)).toBe(DEFAULT_MARGINS.top + DEFAULT_MARGINS.bottom)
  })
})
