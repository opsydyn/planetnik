import { startTransition, useDeferredValue, useEffect, useId, useState } from "react"
import { AgGridReact } from "ag-grid-react"
import {
  AllCommunityModule,
  type ICellRendererParams,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type FilterChangedEvent,
  type GridReadyEvent,
  type ValueFormatterParams,
} from "ag-grid-community"
import "./ReportDataGrid.css"

ModuleRegistry.registerModules([AllCommunityModule])

type GridCellValue = string | number | boolean | null | undefined

type GridRow = {
  id?: string
  [key: string]: GridCellValue
}

export type GridColumnConfig = {
  field: string
  headerName: string
  type?: "text" | "number" | "percent" | "date" | "path" | "code" | "link" | "multiline"
  hrefField?: string
  secondaryField?: string
  minWidth?: number
  flex?: number
  sort?: "asc" | "desc"
  tooltipField?: string
}

type ReportDataGridProps = {
  title?: string
  description?: string
  searchPlaceholder?: string
  searchHint?: string
  emptyMessage?: string
  rows: GridRow[]
  columns: GridColumnConfig[]
  paginationPageSize?: number
  searchEnabled?: boolean
}

function formatNumber(value: GridCellValue): string {
  return typeof value === "number" ? value.toLocaleString() : value == null ? "—" : String(value)
}

function createColumnDef(column: GridColumnConfig): ColDef<GridRow> {
  const type = column.type ?? "text"
  const colDef: ColDef<GridRow> = {
    field: column.field,
    headerName: column.headerName,
    minWidth: column.minWidth ?? 140,
    flex: column.flex,
    sortable: true,
    resizable: true,
    sort: column.sort,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    filter: type === "number" || type === "percent" ? "agNumberColumnFilter" : "agTextColumnFilter",
    cellDataType: type === "number" || type === "percent" ? "number" : "text",
    tooltipValueGetter: (params) => {
      const sourceField = column.tooltipField ?? column.field
      const value = params.data?.[sourceField]
      return value == null ? "" : String(value)
    },
    getQuickFilterText: (params) => {
      const values = [params.value]

      if (column.secondaryField) {
        values.push(params.data?.[column.secondaryField])
      }

      if (column.tooltipField) {
        values.push(params.data?.[column.tooltipField])
      }

      return values
        .filter((value) => value != null && value !== "")
        .map((value) => String(value))
        .join(" ")
    },
  }

  if (type === "number") {
    colDef.valueFormatter = (params: ValueFormatterParams<GridRow>) => formatNumber(params.value)
    colDef.cellClass = "report-grid__num"
  }

  if (type === "percent") {
    colDef.valueFormatter = (params: ValueFormatterParams<GridRow>) => {
      if (typeof params.value === "number") {
        return `${params.value.toLocaleString()}%`
      }

      return params.value == null ? "—" : String(params.value)
    }
    colDef.cellClass = "report-grid__num"
  }

  if (type === "date") {
    colDef.cellClass = "report-grid__date"
  }

  if (type === "path") {
    colDef.cellClass = "report-grid__path-cell"
    colDef.cellRenderer = (params: ICellRendererParams<GridRow>) => {
      const value = params.value == null ? "—" : String(params.value)
      return (
        <span className="report-grid__path" title={value}>
          {value}
        </span>
      )
    }
  }

  if (type === "code") {
    colDef.cellRenderer = (params: ICellRendererParams<GridRow>) => {
      const value = params.value == null ? "—" : String(params.value)
      return <code className="report-grid__code">{value}</code>
    }
  }

  if (type === "link") {
    colDef.cellRenderer = (params: ICellRendererParams<GridRow>) => {
      const value = params.value == null ? "—" : String(params.value)
      const href = column.hrefField ? params.data?.[column.hrefField] : null
      const secondary = column.secondaryField ? params.data?.[column.secondaryField] : null

      return (
        <div className="report-grid__link-wrap">
          {typeof href === "string" && href ? (
            <a className="report-grid__link" href={href}>
              {value}
            </a>
          ) : (
            <span className="report-grid__link-fallback">{value}</span>
          )}
          {secondary ? <div className="report-grid__secondary">{String(secondary)}</div> : null}
        </div>
      )
    }
    colDef.autoHeight = true
  }

  if (type === "multiline") {
    colDef.autoHeight = true
    colDef.wrapText = true
    colDef.cellClass = "report-grid__multiline"
    colDef.cellRenderer = (params: ICellRendererParams<GridRow>) => {
      const value = params.value == null ? "—" : String(params.value)
      return (
        <div className="report-grid__multiline-value" title={value}>
          {value}
        </div>
      )
    }
  }

  return colDef
}

export default function ReportDataGrid({
  title,
  description,
  searchPlaceholder = "Search rows",
  searchHint,
  emptyMessage = "No rows available.",
  rows,
  columns,
  paginationPageSize = 25,
  searchEnabled = true,
}: ReportDataGridProps) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const [displayedRowCount, setDisplayedRowCount] = useState(rows.length)
  const searchInputId = useId()
  const columnDefs = columns.map(createColumnDef)

  useEffect(() => {
    setDisplayedRowCount(rows.length)
  }, [rows])

  function syncDisplayedCount(event: GridReadyEvent<GridRow> | FilterChangedEvent<GridRow>) {
    setDisplayedRowCount(event.api.getDisplayedRowCount())
  }

  return (
    <section className="report-grid-panel">
      {(title || description || searchEnabled) && (
        <div className="report-grid-panel__toolbar">
          <div className="report-grid-panel__copy">
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          <div className="report-grid-panel__controls">
            {searchEnabled ? (
              <label className="report-grid-panel__search" htmlFor={searchInputId}>
                <span>Search rows</span>
                <input
                  id={searchInputId}
                  type="search"
                  value={query}
                  placeholder={searchPlaceholder}
                  onChange={(event) =>
                    startTransition(() => {
                      setQuery(event.target.value)
                    })
                  }
                />
              </label>
            ) : null}
            <div className="report-grid-panel__count">{displayedRowCount.toLocaleString()} rows</div>
          </div>
        </div>
      )}

      {searchHint ? <p className="report-grid-panel__hint">{searchHint}</p> : null}

      {rows.length === 0 ? (
        <div className="report-grid-panel__empty">{emptyMessage}</div>
      ) : (
        <div className="report-grid-panel__surface">
          <AgGridReact<GridRow>
            className="report-grid"
            theme={themeQuartz}
            rowData={rows}
            columnDefs={columnDefs}
            quickFilterText={searchEnabled ? deferredQuery : undefined}
            animateRows={false}
            domLayout="autoHeight"
            headerHeight={42}
            rowHeight={42}
            pagination
            paginationPageSize={paginationPageSize}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            suppressCellFocus={false}
            suppressMovableColumns
            defaultColDef={{
              sortable: true,
              filter: true,
              floatingFilter: false,
              suppressHeaderMenuButton: true,
            }}
            getRowId={(params) =>
              params.data.id ??
              JSON.stringify(
                columns.map((column) => ({
                  field: column.field,
                  value: params.data[column.field],
                })),
              )
            }
            onGridReady={syncDisplayedCount}
            onFilterChanged={syncDisplayedCount}
          />
        </div>
      )}
    </section>
  )
}
