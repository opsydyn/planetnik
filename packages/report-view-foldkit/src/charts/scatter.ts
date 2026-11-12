/**
 * Scatter plot island.
 *
 * Replaces the React/visx `ScatterPlot`, including its threshold guides: a
 * point past either threshold is drawn in the risk colour, which is how the
 * complexity report flags units that are both long and branchy.
 */

import { Option, Schema } from "effect"
import type { Document, Html, HtmlBuilder } from "foldkit/html"
import { defineMessageUnion } from "foldkit/message"
import { defineView } from "foldkit/submodel"

import { numericAxis } from "../scaffold/axes.js"
import { chartLayout } from "../scaffold/layout.js"
import { chartColors } from "../scaffold/palette.js"
import {
  axisCaption,
  gridLines,
  horizontalGridLines,
  numericAxisLabels,
  svgRoot,
  verticalAxisLabels,
} from "../scaffold/render.js"

const WIDTH = 720
const HEIGHT = 400
const MARGINS = { top: 16, right: 16, bottom: 44, left: 56 }
const HEADROOM = 1.05

export const Point = Schema.Struct({ x: Schema.Number, y: Schema.Number, label: Schema.String })
export type Point = typeof Point.Type

export type Props = Readonly<{
  data: ReadonlyArray<Point>
  xLabel: string
  yLabel: string
  title?: string
  description?: string
  thresholdX?: number
  thresholdY?: number
  noMeta?: boolean | ""
}>

export const Message = defineMessageUnion({
  HoveredPoint: { index: Schema.Number },
  LeftChart: {},
})
export type Message = typeof Message.Type

export const Model = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  xLabel: Schema.String,
  yLabel: Schema.String,
  data: Schema.Array(Point),
  thresholdX: Schema.Option(Schema.Number),
  thresholdY: Schema.Option(Schema.Number),
  active: Schema.Option(Schema.Number),
})
export type Model = typeof Model.Type

export const init = (props: Props) => ({
  model: {
    title: props.title ?? `${props.yLabel} against ${props.xLabel}`,
    description: props.description ?? "",
    xLabel: props.xLabel,
    yLabel: props.yLabel,
    data: props.data,
    thresholdX: Option.fromUndefinedOr(props.thresholdX),
    thresholdY: Option.fromUndefinedOr(props.thresholdY),
    active: Option.none<number>(),
  },
})

export const update = (model: Model, message: Message) =>
  Message.match(message, {
    HoveredPoint: ({ index }) => ({ model: { ...model, active: Option.some(index) } }),
    LeftChart: () => ({ model: { ...model, active: Option.none<number>() } }),
  })

/** A point is at risk when it is past either threshold, matching the React rule. */
const atRisk = (model: Model, point: Point): boolean => {
  const pastX = Option.getOrElse(
    Option.map(model.thresholdX, (threshold) => point.x > threshold),
    () => false,
  )
  const pastY = Option.getOrElse(
    Option.map(model.thresholdY, (threshold) => point.y > threshold),
    () => false,
  )
  return pastX || pastY
}

/** One line describing a point: the readout's text, reused as a native tooltip. */
const pointText = (model: Model, point: Point): string =>
  `${point.label} — ${model.xLabel}: ${point.x.toLocaleString()}, ${model.yLabel}: ${point.y.toLocaleString()}`

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const layout = chartLayout({ width: WIDTH, height: HEIGHT }, MARGINS)
  const maxX = model.data.reduce((running, point) => Math.max(running, point.x), 0) * HEADROOM
  const maxY = model.data.reduce((running, point) => Math.max(running, point.y), 0) * HEADROOM
  const xAxis = numericAxis(maxX, layout.plot.width, 5, (value) => Math.round(value).toLocaleString())
  const yAxis = numericAxis(maxY, layout.plot.height, 5, (value) => Math.round(value).toLocaleString())

  // The vertical scale is inverted: zero sits on the baseline, not the top.
  const yPosition = (value: number): number => layout.plot.height - yAxis.scale(value)

  const thresholdLines: ReadonlyArray<Html> = [
    ...Option.match(model.thresholdX, {
      onNone: () => [] as ReadonlyArray<Html>,
      onSome: (threshold) => [
        h.line([
          h.X1(String(xAxis.scale(threshold))),
          h.X2(String(xAxis.scale(threshold))),
          h.Y1("0"),
          h.Y2(String(layout.plot.height)),
          h.Stroke(chartColors.orange),
          h.StrokeWidth("1.5"),
          h.StrokeDasharray("6,4"),
          h.Attribute("opacity", "0.6"),
          h.Attribute("aria-hidden", "true"),
        ]),
      ],
    }),
    ...Option.match(model.thresholdY, {
      onNone: () => [] as ReadonlyArray<Html>,
      onSome: (threshold) => [
        h.line([
          h.X1("0"),
          h.X2(String(layout.plot.width)),
          h.Y1(String(yPosition(threshold))),
          h.Y2(String(yPosition(threshold))),
          h.Stroke(chartColors.orange),
          h.StrokeWidth("1.5"),
          h.StrokeDasharray("6,4"),
          h.Attribute("opacity", "0.6"),
          h.Attribute("aria-hidden", "true"),
        ]),
      ],
    }),
  ]

  const points: ReadonlyArray<Html> = model.data.map((point, index) => {
    const risk = atRisk(model, point)
    const highlighted = Option.getOrElse(
      Option.map(model.active, (current) => current === index),
      () => false,
    )
    const color = risk ? chartColors.red : chartColors.accent
    return h.circle(
      [
        h.Cx(String(xAxis.scale(point.x))),
        h.Cy(String(yPosition(point.y))),
        h.R(highlighted ? "7" : "4"),
        h.Fill(color),
        h.FillOpacity(highlighted ? "0.95" : "0.6"),
        h.Stroke(color),
        h.StrokeWidth("1"),
        h.Attribute("data-testid", `scatter-point-${index}`),
        h.OnMouseEnter(Message.HoveredPoint({ index })),
        h.OnMouseLeave(Message.LeftChart()),
      ],
      // The readout's text as a native tooltip, so a point still
      // identifies itself when the chart ships without a runtime.
      [h.title([], [pointText(model, point)])],
    )
  })

  const readout = Option.match(model.active, {
    onNone: () => [] as ReadonlyArray<Html>,
    onSome: (index) => {
      const point = model.data[index]
      if (point === undefined) return [] as ReadonlyArray<Html>
      return [
        h.p(
          [h.Class("chart-readout"), h.Attribute("aria-live", "polite"), h.Attribute("data-testid", "chart-readout")],
          [
            `${point.label} — ${model.xLabel}: ${point.x.toLocaleString()}, ${model.yLabel}: ${point.y.toLocaleString()}`,
          ],
        ),
      ]
    },
  })

  return {
    title: model.title,
    body: h.figure(
      [h.Attribute("data-chart", "scatter")],
      [
        svgRoot(
          h,
          {
            layout,
            title: model.title,
            responsive: true,
            ...(model.description === "" ? {} : { description: model.description }),
          },
          [
            ...gridLines(h, xAxis.ticks, layout.plot.height),
            ...horizontalGridLines(
              h,
              yAxis.ticks.map((tick) => ({ ...tick, position: layout.plot.height - tick.position })),
              layout.plot.width,
            ),
            ...numericAxisLabels(h, xAxis.ticks, layout.plot.height),
            ...verticalAxisLabels(
              h,
              yAxis.ticks.map((tick) => ({ ...tick, position: layout.plot.height - tick.position })),
            ),
            axisCaption(h, model.xLabel, {
              x: layout.plot.width / 2,
              y: layout.plot.height + 36,
            }),
            axisCaption(h, model.yLabel, {
              x: -40,
              y: layout.plot.height / 2,
              rotate: -90,
            }),
            ...thresholdLines,
            ...points,
          ],
        ),
        ...readout,
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
