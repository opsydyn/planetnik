/**
 * Chart colour tokens.
 *
 * Ported from `apps/site/src/components/charts/theme.ts`: the same CSS custom
 * properties, so a FoldKit chart and the React chart it replaces pick up the
 * same palette from the same stylesheet and follow the theme switcher without
 * either knowing about it.
 */

export const chartColors = {
  accent: "var(--chart-accent)",
  accentLight: "var(--chart-accent-light)",
  textMuted: "var(--chart-text-muted)",
  border: "var(--chart-border)",
  card: "var(--chart-card)",
  bg: "var(--chart-bg)",
  barBg: "var(--chart-bar-bg)",
  text: "var(--chart-text)",
  green: "var(--chart-green)",
  yellow: "var(--chart-yellow)",
  orange: "var(--chart-orange)",
  red: "var(--chart-red)",
} as const

/** Series palette, in order, for multi-category charts. */
export const chartPalette: ReadonlyArray<string> = [
  "var(--chart-palette-1)",
  "var(--chart-palette-2)",
  "var(--chart-palette-3)",
  "var(--chart-palette-4)",
  "var(--chart-palette-5)",
  "var(--chart-palette-6)",
]

/** The series colour for an index, wrapping at the end of the palette. */
export const seriesColor = (index: number): string =>
  chartPalette[((index % chartPalette.length) + chartPalette.length) % chartPalette.length] ?? chartColors.accent
