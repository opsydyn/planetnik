export type GridCellValue = string | number | boolean | null | undefined

export type GridRow = {
  id?: string
  [key: string]: GridCellValue
}

export type GridColumnConfig = {
  field: string
  headerName: string
  type?: "text" | "number" | "percent" | "date" | "path" | "code" | "link" | "status" | "multiline"
  hrefField?: string
  secondaryField?: string
  minWidth?: number
  flex?: number
  sort?: "asc" | "desc"
  tooltipField?: string
}

export type ReportDataGridProps = {
  title?: string
  description?: string
  searchPlaceholder?: string
  searchHint?: string
  emptyMessage?: string
  rows: ReadonlyArray<GridRow>
  columns: ReadonlyArray<GridColumnConfig>
  paginationPageSize?: number
  searchEnabled?: boolean
}
