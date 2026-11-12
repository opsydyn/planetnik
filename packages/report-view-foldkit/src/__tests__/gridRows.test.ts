/**
 * Tests for the split row payload: the columnar encoding that carries the rows
 * the page does not inline, and the page metrics shown while they are still in
 * flight.
 */

import { describe, expect, test } from "bun:test"

import { type GridColumnConfig, type GridRow, decodeGridRows, encodeGridRows, partialPage } from "../tables/grid.js"

const columns: ReadonlyArray<GridColumnConfig> = [
  { field: "unit", headerName: "Unit" },
  { field: "file", headerName: "File", type: "path" },
  { field: "mcCabeIndex", headerName: "McCabe", type: "number", sort: "desc" },
]

const rows: ReadonlyArray<GridRow> = [
  { unit: "parse", file: "src/parse.ts", mcCabeIndex: 31 },
  { unit: "render", file: "src/render.ts", mcCabeIndex: 12 },
  { unit: "walk", file: "src/walk.ts", mcCabeIndex: 7 },
]

describe("encodeGridRows", () => {
  test("emits one array per field, in the field order given", () => {
    const payload = encodeGridRows(rows, ["unit", "file", "mcCabeIndex"])
    expect(payload.fields).toEqual(["unit", "file", "mcCabeIndex"])
    expect(payload.columns).toEqual([
      ["parse", "render", "walk"],
      ["src/parse.ts", "src/render.ts", "src/walk.ts"],
      [31, 12, 7],
    ])
  })

  test("carries only the fields asked for", () => {
    const payload = encodeGridRows(rows, ["unit"])
    expect(payload.fields).toEqual(["unit"])
    expect(payload.columns).toHaveLength(1)
  })

  test("represents an absent cell as null rather than dropping it", () => {
    const payload = encodeGridRows([{ unit: "parse" }, { unit: "render", file: "b.ts" }], ["unit", "file"])
    expect(payload.columns[1]).toEqual([null, "b.ts"])
  })

  test("encodes an empty row set as empty columns, not as no columns", () => {
    const payload = encodeGridRows([], ["unit", "file"])
    expect(payload.fields).toEqual(["unit", "file"])
    expect(payload.columns).toEqual([[], []])
  })

  test("is smaller than the array-of-objects form it replaces", () => {
    const many = Array.from({ length: 500 }, (_, index) => ({
      unit: `unit${index}`,
      file: `src/file${index}.ts`,
      mcCabeIndex: index,
    }))
    const columnar = JSON.stringify(encodeGridRows(many, ["unit", "file", "mcCabeIndex"]))
    expect(columnar.length).toBeLessThan(JSON.stringify(many).length)
  })
})

describe("decodeGridRows", () => {
  test("round-trips", () => {
    expect(decodeGridRows(encodeGridRows(rows, ["unit", "file", "mcCabeIndex"]))).toEqual(rows)
  })

  test("round-trips an empty row set", () => {
    expect(decodeGridRows(encodeGridRows([], ["unit"]))).toEqual([])
  })

  test("preserves a null cell as null, so the grid renders and sorts it as absent", () => {
    const decoded = decodeGridRows({ fields: ["unit", "file"], columns: [["parse"], [null]] })
    expect(decoded).toEqual([{ unit: "parse", file: null }])
  })

  test("takes its row count from the longest column and pads a short one with null", () => {
    const decoded = decodeGridRows({ fields: ["unit", "file"], columns: [["a", "b"], ["x"]] })
    expect(decoded).toEqual([
      { unit: "a", file: "x" },
      { unit: "b", file: null },
    ])
  })

  test("yields no rows when there are no columns", () => {
    expect(decodeGridRows({ fields: [], columns: [] })).toEqual([])
  })
})

describe("partialPage", () => {
  const inline = rows.slice(0, 2)

  test("reports the total that exists, not the count held locally", () => {
    expect(partialPage(inline, 7729, 25).filteredCount).toBe(7729)
  })

  test("reports the page count the full dataset will have", () => {
    expect(partialPage(inline, 7729, 25).pageCount).toBe(310)
  })

  test("shows the rows it holds, on the first page", () => {
    const page = partialPage(inline, 7729, 25)
    expect(page.rows).toEqual(inline)
    expect(page.pageIndex).toBe(0)
  })

  test("ranges over the rows it holds, not over the page size", () => {
    const page = partialPage(inline, 7729, 25)
    expect(page.from).toBe(1)
    expect(page.to).toBe(2)
  })

  test("shows one page even when more rows than that were inlined", () => {
    const many = Array.from({ length: 60 }, (_, index) => ({ unit: `u${index}` }))
    const page = partialPage(many, 7729, 25)
    expect(page.rows).toHaveLength(25)
    expect(page.to).toBe(25)
  })

  test("reports a zero range when it holds nothing", () => {
    const page = partialPage([], 7729, 25)
    expect(page.from).toBe(0)
    expect(page.to).toBe(0)
  })

  test("never reports fewer than one page", () => {
    expect(partialPage([], 0, 25).pageCount).toBe(1)
  })

  test("treats a non-positive page size as one page, as deriveGrid does", () => {
    expect(partialPage(inline, 7729, 0).pageCount).toBe(1)
  })
})

describe("the columns a report declares", () => {
  test("name the fields the payload must carry", () => {
    const payload = encodeGridRows(
      rows,
      columns.map((column) => column.field),
    )
    expect(decodeGridRows(payload)).toEqual(rows)
  })
})
