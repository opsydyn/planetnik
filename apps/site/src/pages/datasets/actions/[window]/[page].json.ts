import type { APIRoute, GetStaticPaths } from "astro"
import {
  actionQueueArtifactCacheKey,
  defaultActionQueueArtifactDirectory,
  loadActionQueueArtifactManifest,
  parseActionQueueArtifactParams,
  readActionQueueArtifactPage,
} from "../../../../lib/datasets/actionQueueArtifactRoutes.js"

export const prerender = true

export const getStaticPaths: GetStaticPaths = () => {
  const result = loadActionQueueArtifactManifest(defaultActionQueueArtifactDirectory())
  if (result.tag !== "ready") return []

  return result.manifest.windows.flatMap((window) =>
    window.chunks.map((_, index) => {
      const params = { window: window.window, page: String(index + 1) }
      const parsed = parseActionQueueArtifactParams(params.window, params.page)!
      return {
        params,
        props: { artifactDirectory: defaultActionQueueArtifactDirectory(), manifest: result.manifest, parsed },
        cacheKey: actionQueueArtifactCacheKey(result.manifest, parsed),
      }
    }),
  )
}

export const GET: APIRoute = ({ params, props }) => {
  const parsed = parseActionQueueArtifactParams(params.window, params.page)
  if (!parsed) return Response.json({ error: "Invalid action queue artifact path." }, { status: 404 })

  const artifactDirectory =
    (props as { readonly artifactDirectory?: string } | undefined)?.artifactDirectory ??
    defaultActionQueueArtifactDirectory()
  const manifestResult = loadActionQueueArtifactManifest(artifactDirectory)
  if (manifestResult.tag !== "ready") return Response.json({ error: manifestResult.message }, { status: 404 })
  const page = readActionQueueArtifactPage(artifactDirectory, manifestResult.manifest, parsed)
  if (!page) return Response.json({ error: "Action queue artifact page is unavailable." }, { status: 404 })

  return Response.json(page.queue, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Planetnik-Action-Queue-Source": page.sourceFingerprint,
      "X-Planetnik-Action-Queue-Page": `${parsed.window}/${parsed.page}`,
    },
  })
}
