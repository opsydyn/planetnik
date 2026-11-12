import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { renderToString } from "foldkit/experimental/server"

import * as HorizontalBar from "../charts/horizontalBar.js"

// The same call @opsydyn/astro-foldkit makes to pre-render an island, so this
// asserts the markup a page ships when the chart has no client directive.
const prerender = (props: HorizontalBar.Props): Promise<string> =>
  Effect.runPromise(
    renderToString({ init: () => HorizontalBar.init(props), view: HorizontalBar.view }, { isHydratable: false }),
  ).then((rendered) => rendered.html)

const rows = [
  { label: "parse", value: 420 },
  { label: "render", value: 210 },
]

describe("horizontal bar chart, pre-rendered", () => {
  test("draws one bar per row", async () => {
    const html = await prerender({ title: "Largest units", rows })

    expect(html).toContain('data-testid="bar-0"')
    expect(html).toContain('data-testid="bar-1"')
  })

  test("names each bar with a native tooltip, so it reads without a runtime", async () => {
    const html = await prerender({ title: "Largest units", rows })

    expect(html).toContain("<title>parse: 420</title>")
    expect(html).toContain("<title>render: 210</title>")
  })
})
