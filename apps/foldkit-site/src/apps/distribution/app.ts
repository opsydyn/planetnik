import { lazyApp } from "@opsydyn/astro-foldkit/define-app"
import type { Props as ChartProps } from "@planetnik/report-view-foldkit/charts/distribution"

// `lazyApp<Props>` replaces the contract's `EmptyProps`, so `noMeta` has to be
// re-declared here or the island cannot opt out of writing `document.title`.
type Props = ChartProps & { readonly noMeta?: boolean | "" }

/**
 * Pre-rendered: the chart's marks are in the HTML, and the island replaces
 * them with identical markup when it boots. `init` and `view` are pure here,
 * so they run on the server; nothing hydrates the markup, so no build identity
 * and no hydration root are involved and the three charts coexist on one page.
 */
export default lazyApp<Props>(() => import("@planetnik/report-view-foldkit/charts/distribution"), {
  prerender: true,
})
