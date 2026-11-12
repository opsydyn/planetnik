import * as Distribution from "@planetnik/report-view-foldkit/charts/distribution"
import * as Donut from "@planetnik/report-view-foldkit/charts/donut"
import * as Scatter from "@planetnik/report-view-foldkit/charts/scatter"
import * as DataGrid from "@planetnik/report-view-foldkit/tables/dataGrid"
import { Command } from "foldkit"

import { Message } from "./message.js"
import type { Model } from "./model.js"

/** Every page message delegates to the submodel that owns the state it changes. */
export const update = (model: Model, message: Message) =>
  Message.match(message, {
    GotDonutMessage: ({ message: inner }) => ({
      model: { ...model, donut: Donut.update(model.donut, inner).model },
    }),
    GotDistributionMessage: ({ message: inner }) => ({
      model: { ...model, distribution: Distribution.update(model.distribution, inner).model },
    }),
    GotScatterMessage: ({ message: inner }) => ({
      model: { ...model, scatter: Scatter.update(model.scatter, inner).model },
    }),
    // The grid is the one submodel that issues Commands — it fetches the rows
    // the page did not inline — so its result is forwarded, not just its model.
    GotGridMessage: ({ message: inner }) => {
      const next = DataGrid.update(model.grid, inner)
      return {
        model: { ...model, grid: next.model },
        commands: Command.mapMessages(next.commands, (message) => Message.GotGridMessage({ message })),
      }
    },
  })
