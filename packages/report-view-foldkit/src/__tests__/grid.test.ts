import { describe, expect, test } from "bun:test"
import { Option } from "effect"

import {
  type GridColumnConfig,
  type GridRow,
  type GridState,
  compareValues,
  deriveGrid,
  formatCell,
  initialSort,
} from "../tables/grid.js"

const columns: ReadonlyArray<GridColumnConfig> = [
  { field: "unit", headerName: "Unit" },
  { field: "file", headerName: "File", type: "path" },
  { field: "mcCabeIndex", headerName: "McCabe", type: "number", sort: "desc" },
  { field: "linesOfCode", headerName: "LOC", type: "number" },
]

const row = (unit: string, file: string, mcCabe: number, loc: number): GridRow => ({
  unit,
  file,
  mcCabeIndex: mcCabe,
  linesOfCode: loc,
})

const rows: ReadonlyArray<GridRow> = [
  row("parse", "src/parse.ts", 31, 420),
  row("render", "src/render.ts", 12, 210),
  row("walk", "src/walk.ts", 7, 90),
  row("emit", "src/emit/emit.ts", 25, 310),
]

const state = (overrides: Partial<GridState> = {}): GridState => ({
  query: "",
  columnFilters: [],
  sort: Option.none(),
  pageIndex: 0,
  pageSize: 25,
  ...overrides,
})

describe("deriveGrid", () => {
  test("returns every row when nothing is searched, filtered or sorted", () => {
    const page = deriveGrid(rows, columns, state())
    expect(page.rows).toHaveLength(4)
    expect(page.filteredCount).toBe(4)
    expect(page.pageCount).toBe(1)
    expect(page.from).toBe(1)
    expect(page.to).toBe(4)
  })

  test("reports a zero range rather than 1-to-0 for an empty result", () => {
    const page = deriveGrid(rows, columns, state({ query: "nothing matches this" }))
    expect(page.rows).toHaveLength(0)
    expect(page.filteredCount).toBe(0)
    expect(page.from).toBe(0)
    expect(page.to).toBe(0)
    // One page, so the footer reads "Page 1 of 1" rather than "of 0".
    expect(page.pageCount).toBe(1)
  })

  test("searches every column, case-insensitively", () => {
    expect(deriveGrid(rows, columns, state({ query: "WALK" })).rows).toHaveLength(1)
    // Matches on the file path column, not the unit name.
    expect(deriveGrid(rows, columns, state({ query: "emit/" })).rows).toHaveLength(1)
  })

  test("searches the secondary and tooltip columns a column declares", () => {
    const withSecondary: ReadonlyArray<GridColumnConfig> = [
      { field: "unit", headerName: "Unit", secondaryField: "owner", tooltipField: "note" },
    ]
    const annotated: ReadonlyArray<GridRow> = [
      { unit: "parse", owner: "platform-team", note: "hot path" },
      { unit: "render", owner: "web-team", note: "cold" },
    ]
    expect(deriveGrid(annotated, withSecondary, state({ query: "platform" })).rows).toHaveLength(1)
    expect(deriveGrid(annotated, withSecondary, state({ query: "hot path" })).rows).toHaveLength(1)
  })

  test("composes a column filter with the global query", () => {
    const page = deriveGrid(rows, columns, state({ query: "src/", columnFilters: [{ field: "unit", value: "e" }] }))
    // "src/" matches all four; unit containing "e" keeps parse, render and emit.
    expect(page.rows.map((r) => r.unit)).toEqual(["parse", "render", "emit"])
  })

  test("sorts descending and ascending by a numeric column", () => {
    const desc = deriveGrid(rows, columns, state({ sort: Option.some({ field: "mcCabeIndex", desc: true }) }))
    expect(desc.rows.map((r) => r.mcCabeIndex)).toEqual([31, 25, 12, 7])

    const asc = deriveGrid(rows, columns, state({ sort: Option.some({ field: "mcCabeIndex", desc: false }) }))
    expect(asc.rows.map((r) => r.mcCabeIndex)).toEqual([7, 12, 25, 31])
  })

  test("paginates, and clamps a page index past the end instead of showing nothing", () => {
    const second = deriveGrid(rows, columns, state({ pageSize: 2, pageIndex: 1 }))
    expect(second.rows.map((r) => r.unit)).toEqual(["walk", "emit"])
    expect(second.pageCount).toBe(2)
    expect(second.from).toBe(3)
    expect(second.to).toBe(4)

    // The React grid needed an effect to repair this after a filter shrank the
    // result; here it is a property of the derivation.
    const clamped = deriveGrid(rows, columns, state({ pageSize: 2, pageIndex: 7 }))
    expect(clamped.pageIndex).toBe(1)
    expect(clamped.rows.map((r) => r.unit)).toEqual(["walk", "emit"])
  })

  test("a page size of zero or less falls back to one page of everything", () => {
    const page = deriveGrid(rows, columns, state({ pageSize: 0 }))
    expect(page.rows).toHaveLength(4)
    expect(page.pageCount).toBe(1)
  })
})

describe("compareValues", () => {
  test("orders numbers numerically", () => {
    expect(compareValues(2, 10)).toBeLessThan(0)
  })

  test("orders numeric strings by magnitude, not lexically", () => {
    expect(compareValues("file9", "file10")).toBeLessThan(0)
  })

  test("sorts absent values last, whichever side they are on", () => {
    expect(compareValues(null, 1)).toBeGreaterThan(0)
    expect(compareValues(1, null)).toBeLessThan(0)
    expect(compareValues(null, null)).toBe(0)
  })

  test("compares text case-insensitively", () => {
    expect(compareValues("alpha", "Beta")).toBeLessThan(0)
  })
})

describe("initialSort", () => {
  test("takes the first column declaring a sort direction", () => {
    expect(initialSort(columns)).toEqual(Option.some({ field: "mcCabeIndex", desc: true }))
  })

  test("is absent when no column declares one", () => {
    expect(initialSort([{ field: "unit", headerName: "Unit" }])).toEqual(Option.none())
  })
})

describe("formatCell", () => {
  test("renders an em dash for an absent value", () => {
    expect(formatCell({ field: "unit", headerName: "Unit" }, {})).toBe("—")
  })

  test("groups thousands in a number column", () => {
    expect(formatCell({ field: "n", headerName: "N", type: "number" }, { n: 12345 })).toBe((12345).toLocaleString())
  })

  test("suffixes a percent column", () => {
    expect(formatCell({ field: "p", headerName: "P", type: "percent" }, { p: 42 })).toBe("42%")
  })

  test("leaves a non-numeric value in a number column alone", () => {
    expect(formatCell({ field: "n", headerName: "N", type: "number" }, { n: "n/a" })).toBe("n/a")
  })
})
