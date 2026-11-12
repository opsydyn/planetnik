/**
 * Data preparation for the complexity report.
 *
 * Shared by both routes — the island version and the server-rendered
 * `definePage` version — so the only difference between them is how the view
 * is delivered, which is the whole point of having both.
 */

import { chartHelp } from "@planetnik/report-data/lib/chartHelp"
import type { GridRow } from "@planetnik/report-view-foldkit/tables/grid"
import { getCollection } from "astro:content"

import type { Flags } from "../apps/complexityPage/model.js"

export type Unit = Readonly<{
  shortName: string
  relativeFileName: string
  mcCabeIndex: number
  linesOfCode: number
}>

/** Keeps both routes reviewable without a configured PLANETNIK_DATA_DIR. */
const FIXTURE: ReadonlyArray<Unit> = [
  {
    shortName: "CodeAnalyzer.analyze",
    relativeFileName: "src/analysis/CodeAnalyzer.ts",
    mcCabeIndex: 31,
    linesOfCode: 420,
  },
  {
    shortName: "ReportDataGrid.render",
    relativeFileName: "src/tables/ReportDataGrid.tsx",
    mcCabeIndex: 27,
    linesOfCode: 506,
  },
  { shortName: "ForceGraph.tick", relativeFileName: "src/graphs/ForceGraph.tsx", mcCabeIndex: 18, linesOfCode: 466 },
  { shortName: "Treemap.layout", relativeFileName: "src/charts/Treemap.tsx", mcCabeIndex: 12, linesOfCode: 188 },
  {
    shortName: "GitHistoryUtils.parse",
    relativeFileName: "src/githistory/GitHistoryUtils.ts",
    mcCabeIndex: 9,
    linesOfCode: 240,
  },
  { shortName: "Palette.resolve", relativeFileName: "src/Palette.ts", mcCabeIndex: 4, linesOfCode: 60 },
  { shortName: "FormattingUtils.pad", relativeFileName: "src/FormattingUtils.ts", mcCabeIndex: 2, linesOfCode: 28 },
]

const BUCKETS = [
  { label: "1-5 (simple)", min: 1, max: 5, color: "#22c55e" },
  { label: "6-10 (moderate)", min: 6, max: 10, color: "#eab308" },
  { label: "11-25 (complex)", min: 11, max: 25, color: "#f97316" },
  { label: "26+ (very complex)", min: 26, max: Number.POSITIVE_INFINITY, color: "#ef4444" },
] as const

const GRID_COLUMNS = [
  { field: "unit", headerName: "Unit", minWidth: 260 },
  { field: "file", headerName: "File", type: "path", minWidth: 320 },
  { field: "mcCabeIndex", headerName: "McCabe", type: "number", minWidth: 120, sort: "desc" },
  { field: "linesOfCode", headerName: "LOC", type: "number", minWidth: 120 },
] as const

/** The fields the grid reads, and therefore the fields its payload carries. */
export const complexityGridFields = GRID_COLUMNS.map((column) => column.field)

/**
 * Where the rows the page does not inline are served from.
 *
 * It must match where `src/pages/data/complexity-rows.json.ts` prerenders,
 * which is fixed by that file's location rather than by this constant, so a
 * move of either has to move the other. The site is served under a base path,
 * and the URL is baked into the page, so the base has to be applied here — a
 * root-relative `/data/...` 404s in production while working locally, which is
 * the way round that ships broken.
 */
const COMPLEXITY_ROWS_URL = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/data/complexity-rows.json`

/**
 * Rows inlined in the page: one grid page, which is all the grid can show
 * before anyone touches it.
 */
const FIRST_PAGE_SIZE = 25

const sortedUnits = (units: ReadonlyArray<Unit>): ReadonlyArray<Unit> => {
  const source = units.length > 0 ? units : FIXTURE
  return [...source].sort((a, b) => b.mcCabeIndex - a.mcCabeIndex)
}

/**
 * Every grid row, in the order the grid's declared sort will put them.
 *
 * Ordering here rather than leaving it to the client matters: the first page is
 * inlined and the rest is fetched, and the two have to join up. `deriveGrid`
 * re-sorts with the same comparator over already-sorted input, and a stable
 * sort leaves that untouched, so the page the reader sees before the fetch is
 * the page they see after it.
 */
export const complexityGridRows = (units: ReadonlyArray<Unit>): ReadonlyArray<GridRow> =>
  sortedUnits(units).map((unit) => ({
    unit: unit.shortName,
    file: unit.relativeFileName,
    mcCabeIndex: unit.mcCabeIndex,
    linesOfCode: unit.linesOfCode,
  }))

/** The units, read the one way, so the pages and the rows endpoint agree. */
export const loadUnits = async (): Promise<ReadonlyArray<Unit>> => {
  const entries = await getCollection("units")
  return entries.map((entry) => entry.data as Unit)
}

/** The scatter is capped, matching the React page, so the point count stays readable. */
const SCATTER_LIMIT = 200

export const complexityFlags = (units: ReadonlyArray<Unit>, projectName: string): Flags => {
  const sorted = sortedUnits(units)
  const rows = complexityGridRows(units)

  const counts = BUCKETS.map((bucket) => ({
    ...bucket,
    count: sorted.filter((unit) => unit.mcCabeIndex >= bucket.min && unit.mcCabeIndex <= bucket.max).length,
  }))

  return {
    projectName,
    unitCount: sorted.length,
    risk: counts.filter((bucket) => bucket.count > 0).map((b) => ({ label: b.label, value: b.count })),
    distribution: counts.map((b) => ({
      label: b.label,
      value: b.count,
      detail: b.count.toString(),
      color: b.color,
    })),
    scatter: sorted.slice(0, SCATTER_LIMIT).map((unit) => ({
      x: unit.linesOfCode,
      y: unit.mcCabeIndex,
      label: unit.shortName,
    })),
    gridRows: rows.slice(0, FIRST_PAGE_SIZE),
    gridTotalRows: rows.length,
    gridRowsUrl: COMPLEXITY_ROWS_URL,
    gridColumns: [...GRID_COLUMNS],
    riskHelp: chartHelp.unitComplexity.risk,
    distributionHelp: chartHelp.unitComplexity.distribution,
    scatterHelp: chartHelp.unitComplexity.locVsComplexity,
  }
}
