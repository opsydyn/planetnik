/**
 * Chart frame geometry.
 *
 * `@opsydyn/foldkit-viz` publishes scales and geometry but not chart
 * components; FoldKit's own chart components depend on an app-local module it
 * does not publish. This is that module for planetnik's reports.
 */

export type Margins = Readonly<{
  top: number
  right: number
  bottom: number
  left: number
}>

export type Dimensions = Readonly<{ width: number; height: number }>

export type PlotBounds = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

export type ChartLayout = Readonly<{
  dimensions: Dimensions
  margins: Margins
  plot: PlotBounds
}>

export const DEFAULT_MARGINS: Margins = { top: 8, right: 56, bottom: 28, left: 128 }

/**
 * Resolves the drawable area inside a frame. Plot width and height are clamped
 * at zero so an over-constrained frame yields an empty plot rather than
 * negative geometry that would produce invalid SVG.
 */
export const chartLayout = (dimensions: Dimensions, margins: Margins = DEFAULT_MARGINS): ChartLayout => ({
  dimensions,
  margins,
  plot: {
    left: margins.left,
    top: margins.top,
    width: Math.max(0, dimensions.width - margins.left - margins.right),
    height: Math.max(0, dimensions.height - margins.top - margins.bottom),
  },
})

/** Height that fits `rowCount` bands of `rowHeight` plus the frame's margins. */
export const heightForRows = (rowCount: number, rowHeight: number, margins: Margins = DEFAULT_MARGINS): number =>
  margins.top + margins.bottom + Math.max(0, rowCount) * rowHeight
