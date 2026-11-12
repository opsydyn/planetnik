/**
 * Page view.
 *
 * The page chrome that was Astro markup in the island version lives here,
 * because a `definePage` owner owns the document body. Each report component
 * is embedded with `h.submodel`, which gives it a builder typed to its own
 * Message and routes what it dispatches back through `toParentMessage`.
 */

import * as Distribution from "@planetnik/report-view-foldkit/charts/distribution"
import * as Donut from "@planetnik/report-view-foldkit/charts/donut"
import * as Scatter from "@planetnik/report-view-foldkit/charts/scatter"
import * as DataGrid from "@planetnik/report-view-foldkit/tables/dataGrid"
import type { Document, Html, HtmlBuilder } from "foldkit/html"

import { Message } from "./message.js"
import type { Model } from "./model.js"

const section = (h: HtmlBuilder<Message>, heading: string, content: Html): Html =>
  h.section([h.Class("section")], [h.h3([], [heading]), content])

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  // The whole title, not just the page part: FoldKit writes `Document.title`
  // to `document.title` when it hydrates, so a title the Astro layout composes
  // is overwritten a frame later. A page owner owns its metadata outright.
  title: model.projectName === "" ? "Conditional Complexity" : `Conditional Complexity — ${model.projectName}`,
  body: h.div(
    [h.Class("complexity-report")],
    [
      h.h2([], ["Conditional Complexity"]),
      h.p([h.Class("subtitle")], [`${model.unitCount.toLocaleString()} units analyzed`]),
      section(
        h,
        "Complexity Risk",
        h.submodel({
          slotId: "complexity-risk",
          model: model.donut,
          view: Donut.body,
          toParentMessage: (message) => Message.GotDonutMessage({ message }),
        }),
      ),
      section(
        h,
        "McCabe Complexity Distribution",
        h.submodel({
          slotId: "complexity-distribution",
          model: model.distribution,
          view: Distribution.body,
          toParentMessage: (message) => Message.GotDistributionMessage({ message }),
        }),
      ),
      section(
        h,
        "LOC vs McCabe Complexity",
        h.submodel({
          slotId: "complexity-scatter",
          model: model.scatter,
          view: Scatter.body,
          toParentMessage: (message) => Message.GotScatterMessage({ message }),
        }),
      ),
      section(
        h,
        "Most Complex Units",
        h.submodel({
          slotId: "complexity-grid",
          model: model.grid,
          view: DataGrid.body,
          toParentMessage: (message) => Message.GotGridMessage({ message }),
        }),
      ),
    ],
  ),
})
