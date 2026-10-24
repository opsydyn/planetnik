import { lazy, Suspense } from "react"
import "./ReportDataGrid.css"
import type { ReportDataGridProps } from "./ReportDataGrid.types"

const LazyReportDataGridInner = lazy(() => import("./ReportDataGridInner"))

export default function ReportDataGrid({
  title,
  description,
  searchPlaceholder = "Search rows",
  searchHint,
  emptyMessage = "No rows available.",
  rows,
  searchEnabled = true,
  ...rest
}: ReportDataGridProps) {
  if (rows.length === 0) {
    return (
      <section className="report-grid-panel">
        {(title || description || searchEnabled) && (
          <div className="report-grid-panel__toolbar">
            <div className="report-grid-panel__copy">
              {title ? <h3>{title}</h3> : null}
              {description ? <p>{description}</p> : null}
            </div>
          </div>
        )}

        {searchHint ? <p className="report-grid-panel__hint">{searchHint}</p> : null}
        <div className="report-grid-panel__empty">{emptyMessage}</div>
      </section>
    )
  }

  return (
    <Suspense
      fallback={
        <ReportDataGridFallback
          title={title}
          description={description}
          searchPlaceholder={searchPlaceholder}
          searchHint={searchHint}
          rowsCount={rows.length}
          searchEnabled={searchEnabled}
        />
      }
    >
      <LazyReportDataGridInner
        title={title}
        description={description}
        searchPlaceholder={searchPlaceholder}
        searchHint={searchHint}
        emptyMessage={emptyMessage}
        rows={rows}
        searchEnabled={searchEnabled}
        {...rest}
      />
    </Suspense>
  )
}

function ReportDataGridFallback({
  title,
  description,
  searchPlaceholder,
  searchHint,
  rowsCount,
  searchEnabled,
}: {
  title?: string
  description?: string
  searchPlaceholder?: string
  searchHint?: string
  rowsCount: number
  searchEnabled: boolean
}) {
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
              <label className="report-grid-panel__search">
                <span>Search rows</span>
                <input type="search" placeholder={searchPlaceholder} disabled />
              </label>
            ) : null}
            <div className="report-grid-panel__count">{rowsCount.toLocaleString()} rows</div>
          </div>
        </div>
      )}

      {searchHint ? <p className="report-grid-panel__hint">{searchHint}</p> : null}

      <div className="report-grid-panel__surface report-grid-panel__surface--loading" aria-hidden="true">
        <div className="report-grid-panel__skeleton-header" />
        <div className="report-grid-panel__skeleton-body">
          {Array.from({ length: Math.min(8, Math.max(4, rowsCount)) }, (_, index) => `row-${index}`).map((key) => (
            <div key={key} className="report-grid-panel__skeleton-row" />
          ))}
        </div>
      </div>
    </section>
  )
}
