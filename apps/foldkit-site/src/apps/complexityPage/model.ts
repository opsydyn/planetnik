/**
 * Page model for the server-rendered complexity report.
 *
 * One FoldKit application owns the whole route, which is what `definePage`
 * requires and what makes the page server-render: the Astro renderer only
 * executes a FoldKit app when it is a page owner. An island is emitted as an
 * empty mount shell whatever directive it carries.
 *
 * The four report components are embedded as submodels, so the same code backs
 * both this page and the island version of it.
 */

import * as Distribution from "@planetnik/report-view-foldkit/charts/distribution"
import * as Donut from "@planetnik/report-view-foldkit/charts/donut"
import * as Scatter from "@planetnik/report-view-foldkit/charts/scatter"
import { GridColumnConfig, GridRow } from "@planetnik/report-view-foldkit/tables/grid"
import * as DataGrid from "@planetnik/report-view-foldkit/tables/dataGrid"
import { Schema } from "effect"
import { Command } from "foldkit"

import { Message } from "./message.js"

/**
 * Flags are the public, JSON-serialisable handoff from server to browser: the
 * data needed to build the first Model and nothing else. Astro prepares them
 * in frontmatter, exactly as it prepares island props today.
 */
export const Flags = Schema.Struct({
  projectName: Schema.String,
  unitCount: Schema.Number,
  risk: Schema.Array(Donut.Item),
  distribution: Schema.Array(Distribution.Item),
  scatter: Schema.Array(Scatter.Point),
  /** One page of rows; the rest are fetched from `gridRowsUrl`. */
  gridRows: Schema.Array(GridRow),
  gridTotalRows: Schema.Number,
  gridRowsUrl: Schema.String,
  gridColumns: Schema.Array(GridColumnConfig),
  riskHelp: Schema.String,
  distributionHelp: Schema.String,
  scatterHelp: Schema.String,
})
export type Flags = typeof Flags.Type

export const Model = Schema.Struct({
  projectName: Schema.String,
  unitCount: Schema.Number,
  donut: Donut.Model,
  distribution: Distribution.Model,
  scatter: Scatter.Model,
  grid: DataGrid.Model,
})
export type Model = typeof Model.Type

const grid = (flags: Flags) =>
  DataGrid.init({
    title: "Complexity Table",
    description:
      "Search and paginate the full complexity dataset while the charts stay focused on the highest-signal views.",
    searchPlaceholder: "Search unit or file path",
    rows: flags.gridRows,
    totalRows: flags.gridTotalRows,
    rowsUrl: flags.gridRowsUrl,
    columns: flags.gridColumns,
  })

export const init = (flags: Flags) => {
  const gridInit = grid(flags)
  return {
    model: {
      projectName: flags.projectName,
      unitCount: flags.unitCount,
      donut: Donut.init({
        title: "Complexity risk",
        valueLabel: "units",
        data: flags.risk,
        description: flags.riskHelp,
      }).model,
      distribution: Distribution.init({
        title: "McCabe complexity distribution",
        data: flags.distribution,
        description: flags.distributionHelp,
      }).model,
      scatter: Scatter.init({
        title: "Lines of code against McCabe complexity",
        xLabel: "Lines of Code",
        yLabel: "McCabe Index",
        thresholdX: 50,
        thresholdY: 10,
        data: flags.scatter,
        description: flags.scatterHelp,
      }).model,
      grid: gridInit.model,
    },
    // The grid's row fetch is the page's only Command. Mapping it here is what
    // keeps the island and the page owner running the same grid code.
    commands: Command.mapMessages(gridInit.commands, (message) => Message.GotGridMessage({ message })),
  }
}
