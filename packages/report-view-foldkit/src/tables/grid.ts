/**
 * Report grid derivation: search, column filters, sort and pagination as one
 * pure function of rows and state.
 *
 * This is the whole of what `@tanstack/react-table` provided for
 * `ReportDataGrid`, which pulled in four row-model factories and five table
 * features to express it. The comparison and search semantics are ported from
 * that component so the two grids agree on ordering and on what a query
 * matches.
 *
 * Deriving the page rather than storing it also removes three of the React
 * grid's effects: the ones that repaired `pageIndex` after a filter shrank the
 * result, after the page size changed, and after a search changed. Here a page
 * index past the end is clamped when the page is derived.
 */

import { Option, Schema } from "effect"

/**
 * The schemas live here rather than beside the island, so the types the
 * derivation is written against and the types FoldKit decodes into the Model
 * are the same types, with the same optionality.
 */
export const GridCellValue = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])
export type GridCellValue = typeof GridCellValue.Type

export const GridColumnType = Schema.Literals([
  "text",
  "number",
  "percent",
  "date",
  "path",
  "code",
  "link",
  "status",
  "multiline",
])
export type GridColumnType = typeof GridColumnType.Type

/** A row is a bag of named cells: the shape differs per report. */
export const GridRow = Schema.Record(Schema.String, GridCellValue)
export type GridRow = typeof GridRow.Type

export const GridColumnConfig = Schema.Struct({
  field: Schema.String,
  headerName: Schema.String,
  type: Schema.optional(GridColumnType),
  hrefField: Schema.optional(Schema.String),
  secondaryField: Schema.optional(Schema.String),
  tooltipField: Schema.optional(Schema.String),
  minWidth: Schema.optional(Schema.Number),
  sort: Schema.optional(Schema.Literals(["asc", "desc"])),
})
export type GridColumnConfig = typeof GridColumnConfig.Type

export const GridSort = Schema.Struct({ field: Schema.String, desc: Schema.Boolean })
export type GridSort = typeof GridSort.Type

export const GridColumnFilter = Schema.Struct({ field: Schema.String, value: Schema.String })
export type GridColumnFilter = typeof GridColumnFilter.Type

export type GridState = Readonly<{
  query: string
  columnFilters: ReadonlyArray<GridColumnFilter>
  sort: Option.Option<GridSort>
  pageIndex: number
  pageSize: number
}>

export type GridPage = Readonly<{
  rows: ReadonlyArray<GridRow>
  /** Rows surviving search and filters, across all pages. */
  filteredCount: number
  pageCount: number
  /** The page actually shown, which may be clamped from the requested one. */
  pageIndex: number
  /** 1-based display range, both 0 when nothing matched. */
  from: number
  to: number
}>

const normalizeSearchValue = (value: GridCellValue): string => (value == null ? "" : String(value).toLowerCase().trim())

/** The text a column contributes to search: its own cell plus any it annotates. */
const columnSearchText = (row: GridRow, column: GridColumnConfig): string =>
  [column.field, column.secondaryField, column.tooltipField]
    .filter((field): field is string => field !== undefined)
    .map((field) => row[field])
    .filter((value) => value != null && value !== "")
    .map((value) => String(value))
    .join(" ")
    .toLowerCase()

const rowSearchText = (row: GridRow, columns: ReadonlyArray<GridColumnConfig>): string =>
  columns.map((column) => columnSearchText(row, column)).join(" ")

/**
 * Orders two cells. Absent values sort last whichever side they fall on, so a
 * column with gaps does not bury its populated rows. Text compares
 * case-insensitively and numerically, so `file9` precedes `file10`.
 */
export const compareValues = (left: GridCellValue, right: GridCellValue): number => {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  if (typeof left === "number" && typeof right === "number") return left - right
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" })
}

/** The sort the columns declare, if any does. */
export const initialSort = (columns: ReadonlyArray<GridColumnConfig>): Option.Option<GridSort> => {
  const declared = columns.find((column) => column.sort !== undefined)
  if (declared === undefined || declared.sort === undefined) return Option.none()
  return Option.some({ field: declared.field, desc: declared.sort === "desc" })
}

export const deriveGrid = (
  rows: ReadonlyArray<GridRow>,
  columns: ReadonlyArray<GridColumnConfig>,
  state: GridState,
): GridPage => {
  const query = state.query.toLowerCase().trim()
  const searched = query === "" ? rows : rows.filter((row) => rowSearchText(row, columns).includes(query))

  const activeFilters = state.columnFilters
    .map((filter) => ({ filter, column: columns.find((column) => column.field === filter.field) }))
    .filter(
      (pair): pair is { filter: GridColumnFilter; column: GridColumnConfig } =>
        pair.column !== undefined && normalizeSearchValue(pair.filter.value) !== "",
    )

  const filtered =
    activeFilters.length === 0
      ? searched
      : searched.filter((row) =>
          activeFilters.every(({ filter, column }) =>
            columnSearchText(row, column).includes(normalizeSearchValue(filter.value)),
          ),
        )

  const sorted = Option.match(state.sort, {
    onNone: () => filtered,
    onSome: ({ field, desc }) =>
      [...filtered].sort((left, right) => {
        const order = compareValues(left[field] ?? null, right[field] ?? null)
        return desc ? -order : order
      }),
  })

  // A non-positive page size means "no pagination" rather than a division by
  // zero, so the grid still renders if a caller passes 0.
  const pageSize = state.pageSize > 0 ? state.pageSize : Math.max(sorted.length, 1)
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageIndex = Math.min(Math.max(0, state.pageIndex), pageCount - 1)
  const start = pageIndex * pageSize

  return {
    rows: sorted.slice(start, start + pageSize),
    filteredCount: sorted.length,
    pageCount,
    pageIndex,
    from: sorted.length === 0 ? 0 : start + 1,
    to: sorted.length === 0 ? 0 : Math.min(start + pageSize, sorted.length),
  }
}

/**
 * The rows a page does not inline, carried as one array per field rather than
 * one object per row.
 *
 * The field names are stated once instead of 7,729 times, which is where the
 * saving comes from: on the pilot's complexity dataset this is 620,691 bytes
 * against 960,717 for the array-of-objects form, and 52,453 against 76,572
 * gzipped. The gzip figure is the one that matters, because that is what a
 * browser downloads.
 */
export const GridRowsPayload = Schema.Struct({
  fields: Schema.Array(Schema.String),
  columns: Schema.Array(Schema.Array(GridCellValue)),
})
export type GridRowsPayload = typeof GridRowsPayload.Type

/** Columnar form of `rows`, carrying `fields` and nothing else. */
export const encodeGridRows = (rows: ReadonlyArray<GridRow>, fields: ReadonlyArray<string>): GridRowsPayload => ({
  fields,
  columns: fields.map((field) => rows.map((row) => row[field] ?? null)),
})

/**
 * Rows from their columnar form.
 *
 * Total by construction: a ragged payload yields `null` for the cells it does
 * not cover rather than failing, and the grid already treats a null cell as
 * absent — it sorts last and renders as an em dash. A payload that arrives
 * truncated therefore degrades to visible gaps instead of a dead grid.
 */
export const decodeGridRows = (payload: GridRowsPayload): ReadonlyArray<GridRow> => {
  const rowCount = payload.columns.reduce((running, column) => Math.max(running, column.length), 0)
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: Record<string, GridCellValue> = {}
    payload.fields.forEach((field, fieldIndex) => {
      row[field] = payload.columns[fieldIndex]?.[rowIndex] ?? null
    })
    return row
  })
}

/**
 * Page metrics for a dataset whose rows have not all arrived.
 *
 * The counts describe the dataset that exists, so the footer tells the truth
 * about the 7,729 rows and 310 pages while only the first page is in hand. The
 * range describes the rows actually held, so it does not claim 25 when it has
 * two. Searching, sorting and paging stay closed until the rest arrive, since
 * a grid cannot honestly order a dataset it does not have.
 */
export const partialPage = (rows: ReadonlyArray<GridRow>, totalRows: number, pageSize: number): GridPage => {
  // A caller is expected to inline exactly one page, but nothing enforces it,
  // and rendering every inlined row would quietly undo the saving this split
  // exists for. One page is one page, whatever arrived.
  const shown = pageSize > 0 ? rows.slice(0, pageSize) : rows
  return {
    rows: shown,
    filteredCount: totalRows,
    pageCount: pageSize > 0 ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1,
    pageIndex: 0,
    from: shown.length === 0 ? 0 : 1,
    to: shown.length,
  }
}

/** The text a cell shows. Ported from `renderCellValue`'s non-markup branches. */
export const formatCell = (column: GridColumnConfig, row: GridRow): string => {
  const value = row[column.field]
  if (value == null) return "—"
  if (column.type === "number") return typeof value === "number" ? value.toLocaleString() : String(value)
  if (column.type === "percent") return typeof value === "number" ? `${value.toLocaleString()}%` : String(value)
  return String(value)
}

/** The CSS class a cell carries, so the ported stylesheet applies unchanged. */
export const cellClass = (column: GridColumnConfig): string => {
  switch (column.type) {
    case "number":
    case "percent":
      return "report-grid__num"
    case "date":
      return "report-grid__date"
    case "path":
      return "report-grid__path-cell"
    case "multiline":
      return "report-grid__multiline"
    case "status":
      return "report-grid__status-cell"
    default:
      return ""
  }
}

/** Tone for a status cell, ported verbatim from `getStatusTone`. */
export const statusTone = (value: GridCellValue): string => {
  const normalized = String(value ?? "").toLowerCase()
  if (normalized.includes("critical") || normalized.includes("known exploited") || normalized.includes("overdue")) {
    return "critical"
  }
  if (normalized.includes("high") || normalized.includes("open") || normalized.includes("stale")) return "warning"
  if (normalized.includes("medium") || normalized.includes("watch") || normalized.includes("active")) return "info"
  if (
    normalized.includes("low") ||
    normalized.includes("clear") ||
    normalized.includes("fixed") ||
    normalized.includes("healthy")
  ) {
    return "healthy"
  }
  return "neutral"
}
