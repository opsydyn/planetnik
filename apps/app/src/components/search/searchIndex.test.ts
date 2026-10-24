import { describe, expect, spyOn, test } from "bun:test"
import type { SearchIndexPayload } from "../../lib/search/types.js"
import { loadSearchIndex } from "./searchIndex.js"

function indexUrl(title: string) {
  const payload: SearchIndexPayload = {
    version: 1,
    generatedAt: "2026-10-24T00:00:00Z",
    documents: [
      {
        id: title,
        kind: "page",
        title,
        keywords: [],
        route: `/reports/${title}`,
        section: "Overview",
        rank: 1,
      },
    ],
  }
  return `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`
}

describe("report search index loading", () => {
  test("shares an in-flight request and its completed index for one URL", async () => {
    const url = indexUrl("shared-report")
    const first = loadSearchIndex(url)
    const concurrent = loadSearchIndex(url)
    expect(await concurrent).toBe(await first)
    expect(await loadSearchIndex(url)).toBe(await first)
    expect((await first).fuse.search("shared-report")[0]?.item.route).toBe("/reports/shared-report")
  })

  test("does not return another report's cached index", async () => {
    await loadSearchIndex(indexUrl("first-report"))
    const second = await loadSearchIndex(indexUrl("second-report"))
    expect(second.documents[0]?.title).toBe("second-report")
    expect(second.fuse.search("second-report")[0]?.item.route).toBe("/reports/second-report")
  })

  test("retries a failed URL without discarding another report's cache", async () => {
    let attempts = 0
    const originalFetch = globalThis.fetch
    const url = "https://search-index.test/retry"
    const request = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async (...[input, init]: Parameters<typeof fetch>) => {
          if (input !== url) return originalFetch(input, init)
          attempts += 1
          if (attempts === 1) return new Response("Unavailable", { status: 503 })
          return originalFetch(indexUrl("retried-report"))
        },
        { preconnect: originalFetch.preconnect },
      ),
    )
    try {
      const otherUrl = indexUrl("unaffected-report")
      const other = await loadSearchIndex(otherUrl)
      expect(await loadSearchIndex(url).catch((error: unknown) => error)).toEqual(
        new Error("Search index request failed with 503"),
      )
      expect((await loadSearchIndex(url)).documents[0]?.title).toBe("retried-report")
      expect(await loadSearchIndex(otherUrl)).toBe(other)
    } finally {
      request.mockRestore()
    }
  })

  test("keeps each report's index when requests finish out of order", async () => {
    const slowResponse = Promise.withResolvers<Response>()
    const originalFetch = globalThis.fetch
    const slowUrl = "https://search-index.test/slow"
    const fastUrl = "https://search-index.test/fast"
    const request = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async (...[input, init]: Parameters<typeof fetch>) => {
          if (input === slowUrl) return slowResponse.promise
          if (input === fastUrl) return originalFetch(indexUrl("fast-report"))
          return originalFetch(input, init)
        },
        { preconnect: originalFetch.preconnect },
      ),
    )
    try {
      const slow = loadSearchIndex(slowUrl)
      expect((await loadSearchIndex(fastUrl)).documents[0]?.title).toBe("fast-report")
      slowResponse.resolve(await originalFetch(indexUrl("slow-report")))
      expect((await slow).documents[0]?.title).toBe("slow-report")
      expect((await loadSearchIndex(fastUrl)).documents[0]?.title).toBe("fast-report")
    } finally {
      slowResponse.resolve(new Response("Cancelled", { status: 503 }))
      request.mockRestore()
    }
  })
})
