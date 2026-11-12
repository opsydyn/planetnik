/**
 * FoldKit rendering helpers for report charts.
 *
 * Kept separate from the pure geometry in `layout` and `axes`, mirroring how
 * `@opsydyn/foldkit-viz` splits pure modules from its `foldkit/` adapter: the
 * geometry stays testable without a DOM or a FoldKit runtime.
 */

import type { Html, HtmlBuilder } from "foldkit/html"

import type { CategoryBand, NumericTick } from "./axes.js"
import type { ChartLayout } from "./layout.js"

export type SvgRootOptions = Readonly<{
  layout: ChartLayout
  title: string
  description?: string
  /**
   * Scale to the container width instead of pinning the frame's pixel size.
   *
   * The React charts measured their container with a `ResizeObserver` and
   * re-rendered, which is why `ChartCard` needed a skeleton and an `aria-busy`
   * state to cover the first paint. A `viewBox` with no width/height attribute
   * scales in CSS, so there is nothing to measure and no empty first frame.
   */
  responsive?: boolean
}>

/**
 * An accessible SVG root. The chart is announced as a single image with a
 * name, rather than leaving screen readers to walk hundreds of bare shapes.
 */
export const svgRoot = <M>(
  h: HtmlBuilder<M>,
  { layout, title, description, responsive }: SvgRootOptions,
  children: ReadonlyArray<Html>,
): Html =>
  h.svg(
    [
      h.ViewBox(`0 0 ${layout.dimensions.width} ${layout.dimensions.height}`),
      ...(responsive === true
        ? [h.Attribute("style", "width:100%;height:auto"), h.PreserveAspectRatio("xMinYMin meet")]
        : [h.Width(String(layout.dimensions.width)), h.Height(String(layout.dimensions.height))]),
      h.Role("img"),
      h.AriaLabel(description === undefined ? title : `${title}. ${description}`),
    ],
    [
      h.title([], [title]),
      ...(description === undefined ? [] : [h.desc([], [description])]),
      h.g([h.Transform(`translate(${layout.plot.left}, ${layout.plot.top})`)], [...children]),
    ],
  )

/** Vertical gridlines at each tick, drawn behind the data. */
export const gridLines = <M>(
  h: HtmlBuilder<M>,
  ticks: ReadonlyArray<NumericTick>,
  height: number,
): ReadonlyArray<Html> =>
  ticks.map((tick) =>
    h.line([
      h.X1(String(tick.position)),
      h.X2(String(tick.position)),
      h.Y1("0"),
      h.Y2(String(height)),
      h.Stroke("currentColor"),
      h.StrokeWidth("0.5"),
      h.Attribute("opacity", "0.2"),
      h.Attribute("aria-hidden", "true"),
    ]),
  )

/** Tick labels along the bottom edge. */
export const numericAxisLabels = <M>(
  h: HtmlBuilder<M>,
  ticks: ReadonlyArray<NumericTick>,
  height: number,
): ReadonlyArray<Html> =>
  ticks.map((tick) =>
    h.text(
      [
        h.X(String(tick.position)),
        h.Y(String(height + 16)),
        h.TextAnchor("middle"),
        h.FontSize("10"),
        h.Fill("currentColor"),
        h.Attribute("aria-hidden", "true"),
      ],
      [tick.label],
    ),
  )

/**
 * Category labels down the left edge. This is the piece `foldkit-viz` has no
 * equivalent for: its `axis` helper takes `format: (value: number) => string`.
 */
export const categoryAxisLabels = <M>(
  h: HtmlBuilder<M>,
  bands: ReadonlyArray<CategoryBand>,
  gap = 8,
): ReadonlyArray<Html> =>
  bands.map((b) =>
    h.text(
      [
        h.X(String(-gap)),
        h.Y(String(b.centre + 4)),
        h.TextAnchor("end"),
        h.FontSize("11"),
        h.Fill("currentColor"),
        h.Attribute("aria-hidden", "true"),
      ],
      [b.key],
    ),
  )

/** Horizontal gridlines at each tick of a vertical axis. */
export const horizontalGridLines = <M>(
  h: HtmlBuilder<M>,
  ticks: ReadonlyArray<NumericTick>,
  width: number,
): ReadonlyArray<Html> =>
  ticks.map((tick) =>
    h.line([
      h.X1("0"),
      h.X2(String(width)),
      h.Y1(String(tick.position)),
      h.Y2(String(tick.position)),
      h.Stroke("currentColor"),
      h.StrokeWidth("0.5"),
      h.Attribute("opacity", "0.2"),
      h.Attribute("aria-hidden", "true"),
    ]),
  )

/** Tick labels down the left edge of a vertical axis. */
export const verticalAxisLabels = <M>(
  h: HtmlBuilder<M>,
  ticks: ReadonlyArray<NumericTick>,
  gap = 8,
): ReadonlyArray<Html> =>
  ticks.map((tick) =>
    h.text(
      [
        h.X(String(-gap)),
        h.Y(String(tick.position + 3)),
        h.TextAnchor("end"),
        h.FontSize("10"),
        h.Fill("currentColor"),
        h.Attribute("aria-hidden", "true"),
      ],
      [tick.label],
    ),
  )

/** An axis caption, centred on the plot edge it names. */
export const axisCaption = <M>(
  h: HtmlBuilder<M>,
  text: string,
  position: Readonly<{ x: number; y: number; rotate?: number }>,
): Html =>
  h.text(
    [
      h.X(String(position.x)),
      h.Y(String(position.y)),
      h.TextAnchor("middle"),
      h.FontSize("11"),
      h.Fill("currentColor"),
      h.Attribute("aria-hidden", "true"),
      ...(position.rotate === undefined
        ? []
        : [h.Transform(`rotate(${position.rotate}, ${position.x}, ${position.y})`)]),
    ],
    [text],
  )
