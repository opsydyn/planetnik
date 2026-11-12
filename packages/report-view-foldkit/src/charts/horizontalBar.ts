/**
 * Horizontal bar chart island.
 *
 * Replaces the React/visx `HorizontalBarChart`, the most-used island in
 * `apps/site` (15 call sites). Astro prepares the rows in frontmatter and
 * passes them as props, exactly as the React version receives them.
 */

import { Option, Schema } from "effect"
import type { Document, Html, HtmlBuilder } from "foldkit/html"
import { defineMessageUnion } from "foldkit/message"

import { categoryBands, numericAxis } from "../scaffold/axes.js"
import { chartLayout, DEFAULT_MARGINS, heightForRows } from "../scaffold/layout.js"
import { categoryAxisLabels, gridLines, numericAxisLabels, svgRoot } from "../scaffold/render.js"

const ROW_HEIGHT = 26
const WIDTH = 460
const BAR = "var(--chart-bar, #6366f1)"
const BAR_ACTIVE = "var(--chart-bar-active, #4338ca)"

const Row = Schema.Struct({ label: Schema.String, value: Schema.Number })
export type Row = typeof Row.Type

export type Props = Readonly<{
  title: string
  rows: ReadonlyArray<Row>
  description?: string
  noMeta?: boolean | ""
}>

export const Message = defineMessageUnion({
  HoveredBar: { index: Schema.Number },
  BlurredBar: {},
})
export type Message = typeof Message.Type

/**
 * A runtime Schema, not a plain value: FoldKit reads `Model.ast` while the
 * island hydrates. A non-Schema Model type-checks and then fails at runtime.
 */
export const Model = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  rows: Schema.Array(Row),
  active: Schema.Option(Schema.Number),
})
export type Model = typeof Model.Type

export const init = (props: Props) => ({
  model: {
    title: props.title,
    description: props.description ?? "",
    rows: props.rows,
    active: Option.none<number>(),
  },
})

export const update = (model: Model, message: Message) =>
  Message.match(message, {
    HoveredBar: ({ index }) => ({ model: { ...model, active: Option.some(index) } }),
    BlurredBar: () => ({ model: { ...model, active: Option.none<number>() } }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const height = heightForRows(model.rows.length, ROW_HEIGHT)
  const layout = chartLayout({ width: WIDTH, height }, DEFAULT_MARGINS)
  const max = model.rows.reduce((m, r) => Math.max(m, r.value), 0)
  const axis = numericAxis(max, layout.plot.width)
  const bands = categoryBands(
    model.rows.map((r) => r.label),
    layout.plot.height,
  )

  const bars: ReadonlyArray<Html> = model.rows.flatMap((row, index) => {
    const slot = bands[index]
    if (slot === undefined) return []
    const active = Option.getOrElse(
      Option.map(model.active, (i) => i === index),
      () => false,
    )
    return [
      h.rect([
        h.X("0"),
        h.Y(String(slot.start)),
        h.Width(String(axis.scale(row.value))),
        h.Height(String(slot.size)),
        h.Rx("2"),
        h.Fill(active ? BAR_ACTIVE : BAR),
        h.OnMouseEnter(Message.HoveredBar({ index })),
        h.OnMouseLeave(Message.BlurredBar()),
        h.Attribute("data-testid", `bar-${index}`),
      ]),
      h.text(
        [
          h.X(String(axis.scale(row.value) + 6)),
          h.Y(String(slot.centre + 4)),
          h.FontSize("10"),
          h.Fill("currentColor"),
          h.Attribute("aria-hidden", "true"),
        ],
        [String(row.value)],
      ),
    ]
  })

  return {
    title: model.title,
    body: h.figure(
      [h.Attribute("data-chart", "horizontal-bar")],
      [
        svgRoot(
          h,
          {
            layout,
            title: model.title,
            ...(model.description === "" ? {} : { description: model.description }),
          },
          [
            ...gridLines(h, axis.ticks, layout.plot.height),
            ...numericAxisLabels(h, axis.ticks, layout.plot.height),
            ...categoryAxisLabels(h, bands),
            ...bars,
          ],
        ),
        // The accessible table carries the same data for screen readers and for
        // anyone who needs the exact values rather than the shape.
        h.table(
          [h.Attribute("data-chart-table", "true")],
          [
            h.caption([], [model.title]),
            h.tbody(
              [],
              model.rows.map((row) =>
                h.tr([], [h.th([h.Attribute("scope", "row")], [row.label]), h.td([], [String(row.value)])]),
              ),
            ),
          ],
        ),
      ],
    ),
  }
}
