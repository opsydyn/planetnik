import { lazyApp } from "@opsydyn/astro-foldkit/define-app"
import type { Props as ChartProps } from "@planetnik/report-view-foldkit/charts/donut"

type Props = ChartProps & { readonly noMeta?: boolean | "" }

/**
 * Pre-rendered: the chart's marks are in the HTML, and the island replaces
 * them with identical markup when it boots. `init` and `view` are pure here,
 * so they run on the server; nothing hydrates the markup, so no build identity
 * and no hydration root are involved and the three charts coexist on one page.
 */
export default lazyApp<Props>(() => import("@planetnik/report-view-foldkit/charts/donut"), {
  prerender: true,
})
