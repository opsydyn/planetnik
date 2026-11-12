import { definePage } from "@opsydyn/astro-foldkit/define-page"
import { Schema } from "effect"

import { Flags } from "./model.js"

type Props = { readonly flags: Flags }

/**
 * A page owner rather than an island.
 *
 * `lazyApp` is never executed during SSR — the renderer emits a mount shell
 * for anything that is not a page — so this is the only route to
 * server-rendered FoldKit HTML. The Flags factory is synchronous and may only
 * shape data Astro already resolved: it is a render handoff, not a place to
 * load anything.
 */
export default definePage<Props, Flags>(() => import("./main.js"), {
  flags: ({ props }) => Schema.decodeSync(Flags)(props.flags),
})
