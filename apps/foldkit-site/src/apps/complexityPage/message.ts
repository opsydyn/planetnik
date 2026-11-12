/**
 * Page messages.
 *
 * Each variant lifts one submodel's own message, which is the `Got…` naming
 * the FoldKit conventions expect: the page does not reinterpret what a chart
 * or the grid reports, it routes it back to the component that owns it.
 */

import * as Distribution from "@planetnik/report-view-foldkit/charts/distribution"
import * as Donut from "@planetnik/report-view-foldkit/charts/donut"
import * as Scatter from "@planetnik/report-view-foldkit/charts/scatter"
import * as DataGrid from "@planetnik/report-view-foldkit/tables/dataGrid"
import { defineMessageUnion } from "foldkit/message"

export const Message = defineMessageUnion({
  GotDonutMessage: { message: Donut.Message },
  GotDistributionMessage: { message: Distribution.Message },
  GotScatterMessage: { message: Scatter.Message },
  GotGridMessage: { message: DataGrid.Message },
})
export type Message = typeof Message.Type
