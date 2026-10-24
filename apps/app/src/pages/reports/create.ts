import type { APIRoute } from "astro"
import { createRuntimeReport } from "../../lib/runtime-client.js"

const DASHBOARD_PATH = "/" as const
const REDIRECT_STATUS = 302 as const

function buildLocation(query: string): string {
  return query ? `${DASHBOARD_PATH}?${query}` : DASHBOARD_PATH
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData()
  const cookie = request.headers.get("cookie") ?? ""

  const rawName = formData.get("name")
  const rawDatasetName = formData.get("datasetName")
  const rawAnalysisRoot = formData.get("analysisRoot")
  const name = typeof rawName === "string" ? rawName.trim() : ""
  const datasetName = typeof rawDatasetName === "string" ? rawDatasetName.trim() : ""
  const analysisRoot = typeof rawAnalysisRoot === "string" ? rawAnalysisRoot.trim() : ""

  if (!name && !datasetName && !analysisRoot) {
    return redirect(buildLocation("reportError=missing-name"), REDIRECT_STATUS)
  }

  const created = await createRuntimeReport(cookie, {
    ...(name ? { name } : {}),
    ...(datasetName ? { datasetName } : {}),
    ...(analysisRoot ? { analysisRoot } : {}),
  })

  if (!created) {
    return redirect(buildLocation("reportError=create-failed"), REDIRECT_STATUS)
  }

  return redirect(`/reports/${encodeURIComponent(created.slug)}/overview?reportCreated=1`, REDIRECT_STATUS)
}
