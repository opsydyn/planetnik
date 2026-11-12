import { lazyApp } from "@opsydyn/astro-foldkit/define-app"

import type { Props as ChartProps } from "@planetnik/report-view-foldkit/charts/horizontalBar"

// A custom Props type replaces the default EmptyProps, which is where the
// reserved `noMeta` prop is declared, so it has to be re-declared here.
type Props = ChartProps & { readonly noMeta?: boolean | "" }

export default lazyApp<Props>(() => import("@planetnik/report-view-foldkit/charts/horizontalBar"))
