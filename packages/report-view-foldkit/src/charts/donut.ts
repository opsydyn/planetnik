/**
 * Donut chart island.
 *
 * Replaces the React/visx `DonutChart`. The arc geometry comes from
 * `@opsydyn/foldkit-viz`, which publishes `shape/pie` and `shape/arc`; only
 * the legend, the centre total and the hover state are local.
 */

import { arc } from "@opsydyn/foldkit-viz/shape/arc"
import { pie } from "@opsydyn/foldkit-viz/shape/pie"
import { Option, Schema } from "effect"
import type { Document, Html, HtmlBuilder } from "foldkit/html"
import { defineMessageUnion } from "foldkit/message"
import { defineView } from "foldkit/submodel"

import { chartColors, seriesColor } from "../scaffold/palette.js"

const SIZE = 260
const THICKNESS = 40
const PAD_ANGLE = 0.02
const LEGEND_LIMIT = 10

export const Item = Schema.Struct({ label: Schema.String, value: Schema.Number })
export type Item = typeof Item.Type

export type Props = Readonly<{
  data: ReadonlyArray<Item>
  title?: string
  description?: string
  valueLabel?: string
  noMeta?: boolean | ""
}>

export const Message = defineMessageUnion({
  HoveredSlice: { index: Schema.Number },
  LeftChart: {},
})
export type Message = typeof Message.Type

export const Model = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  valueLabel: Schema.String,
  data: Schema.Array(Item),
  active: Schema.Option(Schema.Number),
})
export type Model = typeof Model.Type

export const init = (props: Props) => ({
  model: {
    title: props.title ?? "Breakdown",
    description: props.description ?? "",
    valueLabel: props.valueLabel ?? "total",
    data: props.data,
    active: Option.none<number>(),
  },
})

export const update = (model: Model, message: Message) =>
  Message.match(message, {
    HoveredSlice: ({ index }) => ({ model: { ...model, active: Option.some(index) } }),
    LeftChart: () => ({ model: { ...model, active: Option.none<number>() } }),
  })

const share = (value: number, total: number): number => (total > 0 ? (value / total) * 100 : 0)

/** Label and value for a slice, as a native tooltip. */
const sliceText = (model: Model, index: number): string => {
  const item = model.data[index]
  if (item === undefined) return ""
  return `${item.label}: ${item.value.toLocaleString()}${model.valueLabel === "" ? "" : ` ${model.valueLabel}`}`
}

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const total = model.data.reduce((running, item) => running + item.value, 0)
  const radius = SIZE / 2
  const innerRadius = Math.max(radius - THICKNESS, radius * 0.58)
  const arcs = pie([...model.data], { value: (item) => item.value, sort: null, padAngle: PAD_ANGLE })

  const active = (index: number): boolean =>
    Option.getOrElse(
      Option.map(model.active, (current) => current === index),
      () => false,
    )

  const slices: ReadonlyArray<Html> = arcs.map((datum, index) =>
    h.path(
      [
        h.D(
          arc({
            innerRadius,
            // The hovered slice lifts slightly, which is the hover affordance the
            // visx version got from its tooltip following the cursor.
            outerRadius: active(index) ? radius : radius - 4,
            startAngle: datum.startAngle,
            endAngle: datum.endAngle,
            padAngle: datum.padAngle,
          }),
        ),
        h.Fill(seriesColor(index)),
        h.Attribute("data-testid", `donut-slice-${index}`),
        h.OnMouseEnter(Message.HoveredSlice({ index })),
        h.OnMouseLeave(Message.LeftChart()),
      ],
      // A native tooltip, so a slice still names itself when the chart ships
      // without a runtime and the hover lift cannot happen.
      [h.title([], [sliceText(model, index)])],
    ),
  )

  const centre: ReadonlyArray<Html> = [
    h.text(
      [
        h.TextAnchor("middle"),
        h.Attribute("dominant-baseline", "central"),
        h.FontSize("18"),
        h.FontWeight("700"),
        h.Fill(chartColors.text),
        h.Dy("-6"),
        h.Attribute("aria-hidden", "true"),
      ],
      [total.toLocaleString()],
    ),
    h.text(
      [
        h.TextAnchor("middle"),
        h.Attribute("dominant-baseline", "central"),
        h.FontSize("10"),
        h.Fill(chartColors.textMuted),
        h.Dy("12"),
        h.Attribute("aria-hidden", "true"),
      ],
      [model.valueLabel],
    ),
  ]

  const legend: ReadonlyArray<Html> = [
    ...model.data
      .slice(0, LEGEND_LIMIT)
      .map((item, index) =>
        h.li(
          [
            h.Class("chart-legend__item"),
            h.Attribute("data-active", active(index) ? "true" : "false"),
            h.OnMouseEnter(Message.HoveredSlice({ index })),
            h.OnMouseLeave(Message.LeftChart()),
          ],
          [
            h.span([h.Class("chart-legend__swatch"), h.Attribute("style", `background:${seriesColor(index)}`)], []),
            h.span([h.Class("chart-legend__label")], [item.label]),
            h.span([h.Class("chart-legend__value")], [`${share(item.value, total).toFixed(1)}%`]),
          ],
        ),
      ),
    ...(model.data.length > LEGEND_LIMIT
      ? [h.li([h.Class("chart-legend__more")], [`+${model.data.length - LEGEND_LIMIT} more`])]
      : []),
  ]

  return {
    title: model.title,
    body: h.figure(
      [h.Attribute("data-chart", "donut"), h.Class("chart-donut")],
      [
        h.svg(
          [
            h.ViewBox(`0 0 ${SIZE} ${SIZE}`),
            h.Attribute("style", `width:100%;max-width:${SIZE}px;height:auto`),
            h.PreserveAspectRatio("xMidYMid meet"),
            h.Role("img"),
            h.AriaLabel(model.description === "" ? model.title : `${model.title}. ${model.description}`),
          ],
          [
            h.title([], [model.title]),
            ...(model.description === "" ? [] : [h.desc([], [model.description])]),
            h.g([h.Transform(`translate(${radius}, ${radius})`)], [...slices, ...centre]),
          ],
        ),
        h.ul([h.Class("chart-legend")], [...legend]),
        h.table(
          [h.Attribute("data-chart-table", "true"), h.Class("chart-data-table")],
          [
            h.caption([], [model.title]),
            h.tbody(
              [],
              model.data.map((item) =>
                h.tr(
                  [],
                  [
                    h.th([h.Scope("row")], [item.label]),
                    h.td([], [item.value.toLocaleString()]),
                    h.td([], [`${share(item.value, total).toFixed(1)}%`]),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
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
