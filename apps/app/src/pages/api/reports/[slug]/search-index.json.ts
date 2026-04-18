import type { APIRoute } from "astro"
import { isHostedIntelligenceEnabled } from "../../../../lib/feature-flags.js"
import { buildReportNavSections } from "../../../../lib/hosted-shell.js"
import { getRuntimeReport, getRuntimeReportContributors } from "../../../../lib/runtime-client.js"
import type { SearchDocument, SearchIndexPayload } from "../../../../lib/search/types"

export const GET: APIRoute = async ({ params, request }) => {
  const slug = params.slug ?? ""
  const cookie = request.headers.get("cookie") ?? ""

  const [reportDetail, contributors] = await Promise.all([
    getRuntimeReport(cookie, slug),
    getRuntimeReportContributors(cookie, slug),
  ])

  if (!reportDetail) {
    return new Response(JSON.stringify({ error: "Report not found" }), { status: 404 })
  }

  const reportMode = reportDetail.context?.reportMode ?? "single_repository"
  const reportTitle = reportDetail.report.name

  const navSections = buildReportNavSections(
    {
      kind: "report",
      reportSlug: slug,
      reportTitle,
      reportMode,
    },
    isHostedIntelligenceEnabled(),
  )

  const documents: SearchDocument[] = []
  let pageRank = 1000

  for (const section of navSections) {
    for (const item of section.items) {
      documents.push({
        id: `page:${item.href}`,
        kind: "page",
        title: item.label,
        subtitle: section.label,
        keywords: [item.label.toLowerCase(), section.label.toLowerCase(), reportTitle],
        route: item.href,
        section: section.label,
        rank: pageRank--,
      })
    }
  }

  if (contributors && contributors.length > 0) {
    for (const c of contributors) {
      const baseHref = `/reports/${slug}`
      documents.push({
        id: `contributor:${c.email}`,
        kind: "contributor",
        title: c.email,
        subtitle: `${c.commitsAllTime} commits`,
        keywords: [c.email],
        route: `${baseHref}/contributors/${encodeURIComponent(c.email)}`,
        section: "Team",
        rank: 800,
      })
    }
  }

  const payload: SearchIndexPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    documents,
  }

  return Response.json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  })
}
