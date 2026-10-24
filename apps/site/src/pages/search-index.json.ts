import type { APIRoute } from "astro"
import { buildSearchDocuments } from "../lib/search/buildSearchDocuments"
import type { SearchIndexPayload } from "../lib/search/types"

export const prerender = true

let cachedPayload: SearchIndexPayload | null = null

export const GET: APIRoute = async () => {
  if (cachedPayload) {
    return Response.json(cachedPayload, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    })
  }

  const documents = await buildSearchDocuments()

  cachedPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    documents,
  }

  return Response.json(cachedPayload, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  })
}
