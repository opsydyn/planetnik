/**
 * Distribution chart island.
 *
 * Replaces the React/visx `DistributionChart`: a labelled row per bucket, a
 * track, a bar and a detail column. Hover state lives in the Model, so the
 * highlight and the readout are derived from it rather than from a tooltip
 * library's imperative handle.
 */

import { Option, Schema } from "effect"
import type { Document, Html, HtmlBuilder } from "foldkit/html"
import { defineMessageUnion } from "foldkit/message"
import { defineView } from "foldkit/submodel"

import { numericAxis } from "../scaffold/axes.js"
import { chartLayout } from "../scaffold/layout.js"
import { chartColors } from "../scaffold/palette.js"
import { svgRoot } from "../scaffold/render.js"

const MIN_LABEL_WIDTH = 110
const LABEL_CHAR_WIDTH = 6.4
const LABEL_GAP = 12
const DETAIL_WIDTH = 80
const DETAIL_SECONDARY_WIDTH = 100
const ROW_HEIGHT = 32
const BAR_HEIGHT = 18
const BAR_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2
const WIDTH = 720

export const Item = Schema.Struct({
  label: Schema.String,
  value: Schema.Number,
  detail: Schema.String,
  detailSecondary: Schema.optional(Schema.String),
  color: Schema.optional(Schema.String),
})
export type Item = typeof Item.Type

export type Props = Readonly<{
  data: ReadonlyArray<Item>
  title?: string
  description?: string
  barColor?: string
  noMeta?: boolean | ""
}>

export const Message = defineMessageUnion({
  HoveredRow: { index: Schema.Number },
  LeftChart: {},
})
export type Message = typeof Message.Type

export const Model = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  barColor: Schema.String,
  data: Schema.Array(Item),
  active: Schema.Option(Schema.Number),
})
export type Model = typeof Model.Type

export const init = (props: Props) => ({
  model: {
    title: props.title ?? "Distribution",
    description: props.description ?? "",
    barColor: props.barColor ?? chartColors.accent,
    data: props.data,
    active: Option.none<number>(),
  },
})

export const update = (model: Model, message: Message) =>
  Message.match(message, {
    HoveredRow: ({ index }) => ({ model: { ...model, active: Option.some(index) } }),
    LeftChart: () => ({ model: { ...model, active: Option.none<number>() } }),
  })

const isActive = (model: Model, index: number): boolean =>
  Option.getOrElse(
    Option.map(model.active, (active) => active === index),
    () => false,
  )

/** One line describing a row: the readout's text, reused as a native tooltip. */
const readoutText = (item: Item): string =>
  `${item.label}: ${item.detail}${item.detailSecondary === undefined ? "" : ` · ${item.detailSecondary}`}`

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const hasSecondary = model.data.some((item) => item.detailSecondary !== undefined)
  const detailWidth = DETAIL_WIDTH + (hasSecondary ? DETAIL_SECONDARY_WIDTH : 0)
  const height = model.data.length * ROW_HEIGHT
  // The label column is sized to its longest label. A fixed width clipped
  // "26+ (very complex)" against the viewBox edge, because an SVG clips to its
  // viewport and the label is anchored at the plot's left edge.
  const longestLabel = model.data.reduce((running, item) => Math.max(running, item.label.length), 0)
  const labelWidth = Math.max(MIN_LABEL_WIDTH, longestLabel * LABEL_CHAR_WIDTH + LABEL_GAP)
  const layout = chartLayout({ width: WIDTH, height }, { top: 0, right: detailWidth + 16, bottom: 0, left: labelWidth })
  const max = model.data.reduce((running, item) => Math.max(running, item.value), 0)
  const axis = numericAxis(max, Math.max(layout.plot.width, 40))

  const rows: ReadonlyArray<Html> = model.data.flatMap((item, index) => {
    const y = index * ROW_HEIGHT
    const barWidth = Math.max(axis.scale(item.value), 2)
    const color = item.color ?? model.barColor
    const active = isActive(model, index)

    return [
      h.g(
        [h.Transform(`translate(0, ${y})`)],
        [
          h.text(
            [
              h.X(String(-8)),
              h.Y(String(ROW_HEIGHT / 2)),
              h.TextAnchor("end"),
              h.Attribute("dominant-baseline", "central"),
              h.FontSize("11"),
              h.Fill(chartColors.textMuted),
              h.Attribute("aria-hidden", "true"),
            ],
            [item.label],
          ),
          h.rect([
            h.X("0"),
            h.Y(String(BAR_PADDING)),
            h.Width(String(Math.max(layout.plot.width, 40))),
            h.Height(String(BAR_HEIGHT)),
            h.Fill(chartColors.barBg),
            h.Attribute("aria-hidden", "true"),
          ]),
          h.rect(
            [
              h.X("0"),
              h.Y(String(BAR_PADDING)),
              h.Width(String(barWidth)),
              h.Height(String(BAR_HEIGHT)),
              h.Fill(color),
              h.Attribute("opacity", active ? "1" : "0.85"),
              h.Attribute("data-testid", `distribution-bar-${index}`),
              h.OnMouseEnter(Message.HoveredRow({ index })),
              h.OnMouseLeave(Message.LeftChart()),
            ],
            // The same text the readout shows, as a native tooltip, so the bar
            // still says what it is when the chart ships without a runtime.
            [h.title([], [readoutText(item)])],
          ),
          h.text(
            [
              h.X(String(Math.max(layout.plot.width, 40) + 8)),
              h.Y(String(ROW_HEIGHT / 2)),
              h.TextAnchor("start"),
              h.Attribute("dominant-baseline", "central"),
              h.FontSize("12"),
              h.Fill(chartColors.textMuted),
              h.Attribute("aria-hidden", "true"),
            ],
            [item.detail],
          ),
          ...(hasSecondary && item.detailSecondary !== undefined
            ? [
                h.text(
                  [
                    h.X(String(Math.max(layout.plot.width, 40) + DETAIL_WIDTH + 8)),
                    h.Y(String(ROW_HEIGHT / 2)),
                    h.TextAnchor("start"),
                    h.Attribute("dominant-baseline", "central"),
                    h.FontSize("12"),
                    h.Fill(chartColors.textMuted),
                    h.Attribute("aria-hidden", "true"),
                  ],
                  [item.detailSecondary],
                ),
              ]
            : []),
        ],
      ),
    ]
  })

  const readout = Option.match(model.active, {
    onNone: () => [] as ReadonlyArray<Html>,
    onSome: (index) => {
      const item = model.data[index]
      if (item === undefined) return [] as ReadonlyArray<Html>
      return [
        h.p(
          [h.Class("chart-readout"), h.Attribute("aria-live", "polite"), h.Attribute("data-testid", "chart-readout")],
          [`${item.label}: ${item.detail}${item.detailSecondary === undefined ? "" : ` · ${item.detailSecondary}`}`],
        ),
      ]
    },
  })

  return {
    title: model.title,
    body: h.figure(
      [h.Attribute("data-chart", "distribution")],
      [
        svgRoot(
          h,
          {
            layout,
            title: model.title,
            responsive: true,
            ...(model.description === "" ? {} : { description: model.description }),
          },
          rows,
        ),
        ...readout,
        h.table(
          [h.Attribute("data-chart-table", "true"), h.Class("chart-data-table")],
          [
            h.caption([], [model.title]),
            h.tbody(
              [],
              model.data.map((item) => h.tr([], [h.th([h.Scope("row")], [item.label]), h.td([], [item.detail])])),
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
