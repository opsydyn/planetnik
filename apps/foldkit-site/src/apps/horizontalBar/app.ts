import { lazyApp } from "@opsydyn/astro-foldkit/define-app"

import type { Props as ChartProps } from "@planetnik/report-view-foldkit/charts/horizontalBar"

// A custom Props type replaces the default EmptyProps, which is where the
// reserved `noMeta` prop is declared, so it has to be re-declared here.
type Props = ChartProps & { readonly noMeta?: boolean | "" }

/**
 * Pre-rendered: the bars, their values and the data table are in the HTML.
 * Hover only darkens a bar, and each bar carries a native `<title>`, so a page
 * can use the chart with no client directive and ship no JavaScript for it.
 */
export default lazyApp<Props>(() => import("@planetnik/report-view-foldkit/charts/horizontalBar"), {
  prerender: true,
})
