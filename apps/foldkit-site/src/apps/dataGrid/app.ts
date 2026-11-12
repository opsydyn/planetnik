import { lazyApp } from "@opsydyn/astro-foldkit/define-app"
import type { Props as GridProps } from "@planetnik/report-view-foldkit/tables/dataGrid"

type Props = GridProps & { readonly noMeta?: boolean | "" }

export default lazyApp<Props>(() => import("@planetnik/report-view-foldkit/tables/dataGrid"), {
  prerender: true,
})
