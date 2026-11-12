/**
 * Report data grid island.
 *
 * Replaces the React `ReportDataGrid` + `ReportDataGridInner` pair, which was
 * the one component in `apps/site` with no FoldKit equivalent: search, column
 * filters, sortable headers, pagination and page sizing over a report dataset.
 *
 * All derivation lives in `./grid.js` and is tested there. This module is the
 * view and the state transitions, and it emits the same `report-grid-*` class
 * names as the React version so the stylesheet ports unchanged.
 */

import { Effect, Option, Schema } from "effect"
import { HttpClient } from "effect/http"
import { Command, Http } from "foldkit"
import type { Document, Html, HtmlBuilder } from "foldkit/html"
import { defineMessageUnion } from "foldkit/message"
import { defineView } from "foldkit/submodel"

import {
  cellClass,
  decodeGridRows,
  deriveGrid,
  formatCell,
  GridColumnConfig,
  GridColumnFilter,
  GridRow,
  GridRowsPayload,
  GridSort,
  initialSort,
  partialPage,
  statusTone,
} from "./grid.js"

export type Props = Readonly<{
  /** The rows to show at once. One page of them when `rowsUrl` is given. */
  rows: ReadonlyArray<GridRow>
  columns: ReadonlyArray<GridColumnConfig>
  /**
   * Where the rest of the rows live, when `rows` is only the first page.
   *
   * The complexity report's 7,729 rows were 93% of the compressed page while
   * they travelled inline, to display 25 of them. Pointing at them instead
   * takes the page off the critical path; the grid fetches them once, right
   * after it boots, and opens its controls when they land.
   */
  rowsUrl?: string
  /** Rows in the complete dataset. Defaults to the rows given. */
  totalRows?: number
  title?: string
  description?: string
  searchPlaceholder?: string
  searchHint?: string
  emptyMessage?: string
  paginationPageSize?: number
  searchEnabled?: boolean
  noMeta?: boolean | ""
}>

export const Message = defineMessageUnion({
  TypedQuery: { value: Schema.String },
  ToggledFilters: {},
  FilteredColumn: { field: Schema.String, value: Schema.String },
  SortedByColumn: { field: Schema.String },
  ChangedPageSize: { size: Schema.String },
  WentToPage: { index: Schema.Number },
  LoadedRows: { rows: Schema.Array(GridRow) },
  FailedToLoadRows: { message: Schema.String },
  RetriedRowLoad: {},
})
export type Message = typeof Message.Type

/**
 * Fetches the rows the page did not inline.
 *
 * A decode failure and a transport failure are the same fact to the grid —
 * the rest of the dataset did not arrive — so both land on one message, and
 * the grid says so rather than silently showing 25 of 7,729 rows as if that
 * were all of them.
 */
const ROWS_LOAD_FAILED = "Could not load the remaining rows."

const LoadRows = Command.define("LoadRows", {
  args: { url: Schema.String },
  messages: [Message.LoadedRows, Message.FailedToLoadRows],
  execute: ({ url }: { readonly url: string }) =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const response = yield* client.get(url)
      const payload = yield* Schema.decodeUnknownEffect(GridRowsPayload)(yield* response.json)
      return Message.LoadedRows({ rows: decodeGridRows(payload) })
    }).pipe(
      // Errors and defects both become a fact the Model can act on, so a
      // failed load shows rather than leaving the grid waiting forever.
      // Interruption is deliberately not caught: it is the runtime taking the
      // Command back, and answering it with a Message fights the lifecycle.
      Effect.catch(() => Effect.succeed(Message.FailedToLoadRows({ message: ROWS_LOAD_FAILED }))),
      Effect.catchDefect(() => Effect.succeed(Message.FailedToLoadRows({ message: ROWS_LOAD_FAILED }))),
      Effect.provide(Http.layer),
    ),
})

/** A runtime Schema, not a plain value: FoldKit reads `Model.ast` at hydration. */
export const Model = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  searchPlaceholder: Schema.String,
  searchHint: Schema.String,
  emptyMessage: Schema.String,
  searchEnabled: Schema.Boolean,
  rows: Schema.Array(GridRow),
  columns: Schema.Array(GridColumnConfig),
  /** Rows in the complete dataset, which `rows` may not yet hold all of. */
  totalRows: Schema.Number,
  /** The rows still to fetch. `None` once the grid holds the whole dataset. */
  pendingRows: Schema.Option(Schema.String),
  loadError: Schema.Option(Schema.String),
  query: Schema.String,
  columnFilters: Schema.Array(GridColumnFilter),
  sort: Schema.Option(GridSort),
  showFilters: Schema.Boolean,
  pageIndex: Schema.Number,
  pageSize: Schema.Number,
})
export type Model = typeof Model.Type

const DEFAULT_PAGE_SIZE = 25

export const init = (props: Props) => {
  const pendingRows = Option.fromUndefinedOr(props.rowsUrl)
  return {
    model: {
      title: props.title ?? "",
      description: props.description ?? "",
      searchPlaceholder: props.searchPlaceholder ?? "Search rows",
      searchHint: props.searchHint ?? "",
      emptyMessage: props.emptyMessage ?? "No rows available.",
      searchEnabled: props.searchEnabled ?? true,
      rows: props.rows,
      columns: props.columns,
      totalRows: props.totalRows ?? props.rows.length,
      pendingRows,
      loadError: Option.none(),
      query: "",
      columnFilters: [],
      sort: initialSort(props.columns),
      showFilters: false,
      pageIndex: 0,
      pageSize: props.paginationPageSize ?? DEFAULT_PAGE_SIZE,
    },
    // Commands do not run during a server render, so this fetch belongs to the
    // browser whichever route renders the grid.
    commands: Option.match(pendingRows, {
      onNone: () => [],
      onSome: (url) => [LoadRows({ url })],
    }),
  }
}

const withFilter = (
  filters: ReadonlyArray<{ readonly field: string; readonly value: string }>,
  field: string,
  value: string,
): ReadonlyArray<{ readonly field: string; readonly value: string }> => {
  const without = filters.filter((filter) => filter.field !== field)
  return value.trim() === "" ? without : [...without, { field, value }]
}

/**
 * Toggling a column cycles ascending, descending, unsorted — the same three
 * states the React header button cycled through.
 */
const nextSort = (
  current: Option.Option<{ readonly field: string; readonly desc: boolean }>,
  field: string,
): Option.Option<{ readonly field: string; readonly desc: boolean }> =>
  Option.match(current, {
    onNone: () => Option.some({ field, desc: false }),
    onSome: (sort) => {
      if (sort.field !== field) return Option.some({ field, desc: false })
      return sort.desc ? Option.none() : Option.some({ field, desc: true })
    },
  })

/**
 * One shape for every transition, so a caller composing the grid as a submodel
 * can forward its Commands without the union of per-case shapes hiding them.
 */
type UpdateReturn = Readonly<{
  model: Model
  commands?: ReadonlyArray<Command.Command<Message>>
}>

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    // Searching, filtering and resizing all return to the first page: staying
    // on page 9 of a result that now has two pages shows an empty table.
    TypedQuery: ({ value }) => ({ model: { ...model, query: value, pageIndex: 0 } }),
    ToggledFilters: () => ({ model: { ...model, showFilters: !model.showFilters } }),
    FilteredColumn: ({ field, value }) => ({
      model: { ...model, columnFilters: withFilter(model.columnFilters, field, value), pageIndex: 0 },
    }),
    SortedByColumn: ({ field }) => ({ model: { ...model, sort: nextSort(model.sort, field) } }),
    ChangedPageSize: ({ size }) => {
      const parsed = Number.parseInt(size, 10)
      return {
        model: {
          ...model,
          pageSize: Number.isFinite(parsed) && parsed > 0 ? parsed : model.pageSize,
          pageIndex: 0,
        },
      }
    },
    WentToPage: ({ index }) => ({ model: { ...model, pageIndex: Math.max(0, index) } }),
    // The rows that arrive are the dataset: if the count the page advertised
    // and the count delivered disagree, what is in hand is the truth.
    LoadedRows: ({ rows }) => ({
      model: { ...model, rows, totalRows: rows.length, pendingRows: Option.none(), loadError: Option.none() },
    }),
    // `pendingRows` is kept, because it is the URL a retry needs.
    FailedToLoadRows: ({ message }) => ({ model: { ...model, loadError: Option.some(message) } }),
    RetriedRowLoad: () =>
      Option.match(model.pendingRows, {
        onNone: () => ({ model }),
        onSome: (url) => ({ model: { ...model, loadError: Option.none() }, commands: [LoadRows({ url })] }),
      }),
  })

const columnStyle = (column: GridColumnConfig): string => {
  const width = column.minWidth ?? 140
  return `min-width:${width}px;width:${width}px`
}

const sortIndicator = (model: Model, field: string): string =>
  Option.match(model.sort, {
    onNone: () => "↕",
    onSome: (sort) => (sort.field !== field ? "↕" : sort.desc ? "↓" : "↑"),
  })

const ariaSort = (model: Model, field: string): string =>
  Option.match(model.sort, {
    onNone: () => "none",
    onSome: (sort) => (sort.field !== field ? "none" : sort.desc ? "descending" : "ascending"),
  })

const cell = (h: HtmlBuilder<Message>, column: GridColumnConfig, row: GridRow): Html => {
  const text = formatCell(column, row)
  const attrs = [h.Class(cellClass(column)), h.Attribute("style", columnStyle(column))]

  if (column.type === "link") {
    const href = column.hrefField === undefined ? null : row[column.hrefField]
    const body =
      typeof href === "string" && href !== ""
        ? h.a([h.Class("report-grid__link"), h.Href(href)], [text])
        : h.span([h.Class("report-grid__link-fallback")], [text])
    const secondary = column.secondaryField === undefined ? null : row[column.secondaryField]
    return h.td(attrs, [
      h.div(
        [h.Class("report-grid__link-wrap")],
        secondary == null || secondary === ""
          ? [body]
          : [body, h.div([h.Class("report-grid__secondary")], [String(secondary)])],
      ),
    ])
  }

  if (column.type === "code") return h.td(attrs, [h.code([h.Class("report-grid__code")], [text])])

  if (column.type === "status") {
    return h.td(attrs, [
      h.span([h.Class(`report-grid__status report-grid__status--${statusTone(row[column.field] ?? null)}`)], [text]),
    ])
  }

  // The title carries the full value, because these columns are the ones the
  // stylesheet truncates.
  if (column.type === "path") {
    return h.td(attrs, [h.span([h.Class("report-grid__path"), h.Title(text)], [text])])
  }
  if (column.type === "multiline") {
    return h.td(attrs, [h.div([h.Class("report-grid__multiline-value"), h.Title(text)], [text])])
  }

  return h.td(attrs, [text])
}

const toolbar = (h: HtmlBuilder<Message>, model: Model, filteredCount: number, busy: boolean): ReadonlyArray<Html> => {
  if (model.title === "" && model.description === "" && !model.searchEnabled) return []

  const copy: ReadonlyArray<Html> = [
    ...(model.title === "" ? [] : [h.h3([], [model.title])]),
    ...(model.description === "" ? [] : [h.p([], [model.description])]),
  ]

  const search = model.searchEnabled
    ? [
        h.label(
          [h.Class("report-grid-panel__search"), h.For("report-grid-search")],
          [
            h.span([], ["Search rows"]),
            h.input([
              h.Id("report-grid-search"),
              h.Type("search"),
              h.Value(model.query),
              h.Placeholder(model.searchPlaceholder),
              ...(busy ? [h.Disabled(true)] : []),
              h.OnInput((value) => Message.TypedQuery({ value })),
            ]),
          ],
        ),
      ]
    : []

  return [
    h.div(
      [h.Class("report-grid-panel__toolbar")],
      [
        h.div([h.Class("report-grid-panel__copy")], [...copy]),
        h.div(
          [h.Class("report-grid-panel__controls")],
          [
            ...search,
            h.button(
              [
                h.Type("button"),
                h.Class("report-grid-panel__toggle"),
                h.AriaPressed(model.showFilters ? "true" : "false"),
                ...(busy ? [h.Disabled(true)] : []),
                h.OnClick(Message.ToggledFilters()),
              ],
              [model.showFilters ? "Hide filters" : "Column filters"],
            ),
            h.div([h.Class("report-grid-panel__count")], [`${filteredCount.toLocaleString()} rows`]),
          ],
        ),
      ],
    ),
  ]
}

const filterRow = (h: HtmlBuilder<Message>, model: Model, busy: boolean): ReadonlyArray<Html> => {
  if (!model.showFilters) return []
  return [
    h.tr(
      [h.Class("report-grid-table__filters")],
      model.columns.map((column) =>
        h.th(
          [h.Attribute("style", columnStyle(column))],
          [
            h.input([
              h.Type("search"),
              h.AriaLabel(`Filter ${column.headerName.toLowerCase()}`),
              h.Placeholder(`Filter ${column.headerName.toLowerCase()}`),
              h.Value(model.columnFilters.find((filter) => filter.field === column.field)?.value ?? ""),
              ...(busy ? [h.Disabled(true)] : []),
              h.OnInput((value) => Message.FilteredColumn({ field: column.field, value })),
            ]),
          ],
        ),
      ),
    ),
  ]
}

/**
 * A pagination button.
 *
 * `Disabled` is included only when the button is actually disabled: passing
 * `Disabled(false)` emits `disabled=""`, and an empty string is still a
 * disabled button to the browser, which left every control dead on the first
 * page.
 */
const pageButton = (h: HtmlBuilder<Message>, label: string, target: number, disabled: boolean): Html =>
  h.button(
    [h.Type("button"), ...(disabled ? [h.Disabled(true)] : []), h.OnClick(Message.WentToPage({ index: target }))],
    [label],
  )

const pageSizeOptions = (model: Model): ReadonlyArray<number> =>
  [...new Set([10, 25, 50, 100, model.pageSize])].sort((a, b) => a - b)

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  // Until the whole dataset is in hand the counts come from what the page
  // advertised, so the footer tells the truth about a dataset it is still
  // downloading, and the controls stay shut rather than ordering a fraction of
  // it as though it were the whole.
  const busy = Option.isSome(model.pendingRows)
  const page = busy
    ? partialPage(model.rows, model.totalRows, model.pageSize)
    : deriveGrid(model.rows, model.columns, {
        query: model.query,
        columnFilters: model.columnFilters,
        sort: model.sort,
        pageIndex: model.pageIndex,
        pageSize: model.pageSize,
      })

  const hint = model.searchHint === "" ? [] : [h.p([h.Class("report-grid-panel__hint")], [model.searchHint])]

  const status: ReadonlyArray<Html> = busy
    ? Option.match(model.loadError, {
        onNone: () => [
          h.p(
            [h.Class("report-grid-panel__loading"), h.Attribute("aria-live", "polite")],
            [`Loading all ${model.totalRows.toLocaleString()} rows…`],
          ),
        ],
        onSome: (message) => [
          h.div(
            [h.Class("report-grid-panel__load-error"), h.Attribute("aria-live", "polite")],
            [
              h.span(
                [],
                [
                  `${message} Showing the first ${model.rows.length.toLocaleString()} of ${model.totalRows.toLocaleString()}.`,
                ],
              ),
              h.button([h.Type("button"), h.OnClick(Message.RetriedRowLoad())], ["Retry"]),
            ],
          ),
        ],
      })
    : []

  const body =
    model.rows.length === 0
      ? [h.div([h.Class("report-grid-panel__empty")], [model.emptyMessage])]
      : [
          h.div(
            [h.Class("report-grid-panel__surface")],
            [
              h.div(
                [h.Class("report-grid-panel__table-wrap")],
                [
                  h.table(
                    [h.Class("report-grid-table")],
                    [
                      h.thead(
                        [],
                        [
                          h.tr(
                            [],
                            model.columns.map((column) =>
                              h.th(
                                [h.Attribute("style", columnStyle(column)), h.AriaSort(ariaSort(model, column.field))],
                                [
                                  h.button(
                                    [
                                      h.Type("button"),
                                      h.Class("report-grid-table__sort"),
                                      ...(busy ? [h.Disabled(true)] : []),
                                      h.OnClick(Message.SortedByColumn({ field: column.field })),
                                    ],
                                    [
                                      h.span([], [column.headerName]),
                                      h.span(
                                        [
                                          h.Class("report-grid-table__sort-indicator"),
                                          h.Attribute("aria-hidden", "true"),
                                        ],
                                        [sortIndicator(model, column.field)],
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                          ...filterRow(h, model, busy),
                        ],
                      ),
                      h.tbody(
                        [],
                        page.rows.length === 0
                          ? [
                              h.tr(
                                [],
                                [
                                  h.td(
                                    [h.Class("report-grid-table__empty"), h.Colspan(model.columns.length)],
                                    [model.emptyMessage],
                                  ),
                                ],
                              ),
                            ]
                          : page.rows.map((row) =>
                              h.tr(
                                [],
                                model.columns.map((column) => cell(h, column, row)),
                              ),
                            ),
                      ),
                    ],
                  ),
                ],
              ),
              h.div(
                [h.Class("report-grid-footer")],
                [
                  h.div(
                    [h.Class("report-grid-footer__meta")],
                    [
                      `${page.from.toLocaleString()} to ${page.to.toLocaleString()} of ${page.filteredCount.toLocaleString()}. Page ${(page.pageIndex + 1).toLocaleString()} of ${page.pageCount.toLocaleString()}`,
                    ],
                  ),
                  h.div(
                    [h.Class("report-grid-footer__controls")],
                    [
                      h.label(
                        [h.Class("report-grid-footer__page-size")],
                        [
                          h.span([], ["Rows"]),
                          h.select(
                            [
                              h.AriaLabel("Rows per page"),
                              ...(busy ? [h.Disabled(true)] : []),
                              h.OnChange((size) => Message.ChangedPageSize({ size })),
                            ],
                            pageSizeOptions(model).map((option) =>
                              h.option(
                                [h.Value(String(option)), ...(option === model.pageSize ? [h.Selected(true)] : [])],
                                [String(option)],
                              ),
                            ),
                          ),
                        ],
                      ),
                      pageButton(h, "First", 0, busy || page.pageIndex === 0),
                      pageButton(h, "Prev", page.pageIndex - 1, busy || page.pageIndex === 0),
                      pageButton(h, "Next", page.pageIndex + 1, busy || page.pageIndex >= page.pageCount - 1),
                      pageButton(h, "Last", page.pageCount - 1, busy || page.pageIndex >= page.pageCount - 1),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ]

  return {
    title: model.title === "" ? "Report data" : model.title,
    body: h.section(
      [h.Class("report-grid-panel"), ...(busy ? [h.Attribute("aria-busy", "true")] : [])],
      [...toolbar(h, model, page.filteredCount, busy), ...hint, ...status, ...body],
    ),
  }
}

/**
 * The same view, branded for embedding under `h.submodel`.
 *
 * A `definePage` owner composes these four components into one application so
 * the page server-renders; an island calls `view` directly. Both paths run the
 * same code, so neither can drift from the other.
 */
export const body = defineView<Model, Message>((model, h) => view(model, h).body)
