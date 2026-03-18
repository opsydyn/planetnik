// ADR-0005: Build the site-wide search corpus from Astro content collections.
import { getCollection, getEntry } from "astro:content"
import type { SearchDocument } from "./types"

type PageDefinition = Omit<SearchDocument, "id" | "kind" | "rank">

const pageDefinitions: PageDefinition[] = [
  {
    title: "Dashboard",
    subtitle: "Project summary and language breakdown",
    description: "High-level analysis dashboard with key metrics, language distribution, and duplication summary.",
    keywords: ["home", "dashboard", "summary", "languages", "duplication", "overview"],
    route: "/",
    section: "Overview",
  },
  {
    title: "About",
    subtitle: "Why Planetnik",
    description: "Background, positioning, and the software weather model behind Planetnik.",
    keywords: ["about", "planetnik", "weather", "architecture", "entropy", "drift", "turbulence"],
    route: "/about",
    section: "Overview",
  },
  {
    title: "Source Code Overview",
    subtitle: "Main and test code shape",
    description: "Overview of source code size, tests, and repository-wide structural distribution.",
    keywords: ["overview", "source code", "main", "test", "size", "distribution"],
    route: "/overview",
    section: "Overview",
  },
  {
    title: "Metrics",
    subtitle: "Raw and grouped analysis metrics",
    description: "Metric dashboard with grouped raw metrics and summary visualizations.",
    keywords: ["metrics", "loc", "duplication", "analysis time", "measurements"],
    route: "/metrics",
    section: "Overview",
  },
  {
    title: "Components",
    subtitle: "Structural components view",
    description: "Component-oriented view of the codebase and mapped file relationships.",
    keywords: ["components", "modules", "structure", "boundaries"],
    route: "/components",
    section: "Structure",
  },
  {
    title: "Dependencies",
    subtitle: "Inter-component dependencies",
    description: "Dependency relationships between components and structural coupling signals.",
    keywords: ["dependencies", "coupling", "components", "edges", "structure"],
    route: "/dependencies",
    section: "Structure",
  },
  {
    title: "Duplication",
    subtitle: "Duplicated code overview",
    description: "Duplicate blocks and duplication-heavy parts of the codebase.",
    keywords: ["duplication", "duplicate", "copy paste", "repetition"],
    route: "/duplication",
    section: "Structure",
  },
  {
    title: "File Size",
    subtitle: "Largest source files",
    description: "Main source files ranked by lines of code and distribution.",
    keywords: ["files", "file size", "largest files", "loc"],
    route: "/files/size",
    section: "Files",
  },
  {
    title: "File Age",
    subtitle: "Oldest and newest files",
    description: "File age metrics across the codebase based on first and latest updates.",
    keywords: ["files", "age", "history", "oldest files", "newest files"],
    route: "/files/age",
    section: "Files",
  },
  {
    title: "File Churn",
    subtitle: "Most changed files",
    description: "Files ranked by churn and change activity.",
    keywords: ["files", "churn", "change", "commits", "activity"],
    route: "/files/churn",
    section: "Files",
  },
  {
    title: "Temporal Dependencies",
    subtitle: "Files that change together",
    description: "Temporal coupling view showing files frequently committed together.",
    keywords: ["files", "temporal", "dependencies", "co-change", "coupling"],
    route: "/files/temporal",
    section: "Files",
  },
  {
    title: "Unit Size",
    subtitle: "Largest functions and methods",
    description: "Units ranked by lines of code across the codebase.",
    keywords: ["units", "functions", "methods", "size", "loc"],
    route: "/units/size",
    section: "Units",
  },
  {
    title: "Conditional Complexity",
    subtitle: "Most complex units",
    description: "McCabe complexity view for units and functions.",
    keywords: ["units", "complexity", "mccabe", "conditionals", "risk"],
    route: "/units/complexity",
    section: "Units",
  },
  {
    title: "Contributors",
    subtitle: "People active in the codebase",
    description: "Contributor activity, recency, and code ownership signals.",
    keywords: ["contributors", "people", "authors", "ownership", "activity"],
    route: "/contributors",
    section: "Team",
  },
  {
    title: "Commits",
    subtitle: "Commit activity and extension trends",
    description: "Commit summaries and extension-level commit activity.",
    keywords: ["commits", "activity", "extensions", "history"],
    route: "/commits",
    section: "Team",
  },
  {
    title: "Team Topology",
    subtitle: "People dependencies",
    description: "Contributor relationships built from shared file modification patterns.",
    keywords: ["topology", "team", "people dependencies", "coordination", "ownership"],
    route: "/topology",
    section: "Team",
  },
  {
    title: "Features of Interest",
    subtitle: "Concerns and tagged areas",
    description: "Concern-oriented view of files matching configured features of interest.",
    keywords: ["concerns", "features", "interest", "tagged code"],
    route: "/concerns",
    section: "Quality",
  },
  {
    title: "Findings",
    subtitle: "Pattern-based findings",
    description: "Configured findings and notable pattern-based results.",
    keywords: ["findings", "patterns", "rules", "search results"],
    route: "/findings",
    section: "Quality",
  },
  {
    title: "Goals & Controls",
    subtitle: "Quality guardrails",
    description: "Quality goals, controls, and progress against them.",
    keywords: ["controls", "goals", "quality", "guardrails"],
    route: "/controls",
    section: "Quality",
  },
  {
    title: "Trend",
    subtitle: "Analysis over time",
    description: "Trend view showing how key structural signals move over time.",
    keywords: ["trend", "history", "time series", "change over time"],
    route: "/trends",
    section: "Quality",
  },
]

function normalizeKeywords(values: Array<string | number | undefined | null>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (!text) continue
    if (seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }

  return result
}

function takeKeywords(values: string[] | undefined, limit: number): string[] {
  if (!values || values.length === 0) return []
  return values.slice(0, limit)
}

function makePageDocuments(projectName: string): SearchDocument[] {
  return pageDefinitions.map((page, index) => ({
    id: `page:${page.route}`,
    kind: "page",
    title: page.title,
    subtitle: page.subtitle,
    description: page.route === "/" ? `${projectName} analysis dashboard.` : page.description,
    keywords: normalizeKeywords([projectName, ...page.keywords]),
    route: page.route,
    section: page.section,
    rank: 1000 - index,
  }))
}

function groupMetricId(id: string): string {
  const parts = id.split("_")
  if (parts.length >= 3 && parts[0] === "LINES" && parts[1] === "OF") return parts.slice(0, 4).join(" ")
  if (parts.length >= 2) return parts.slice(0, 2).join(" ")
  return id
}

function humanizeMetricId(id: string): string {
  return id.toLowerCase().split("_").filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ")
}

export async function buildSearchDocuments(): Promise<SearchDocument[]> {
  const summary = await getEntry("analysis", "summary")
  const filesMain = await getCollection("filesMain")
  const units = await getCollection("units")
  const contributors = await getCollection("contributors")
  const metrics = await getCollection("metrics")

  const projectName = summary?.data.metadata.name ?? "Planetnik"
  const documents: SearchDocument[] = [...makePageDocuments(projectName)]

  for (const file of filesMain) {
    const extension = file.data.extension || "unknown"
    documents.push({
      id: `file:${file.id}`,
      kind: "file",
      title: file.data.relativePath,
      subtitle: `.${extension} file`,
      keywords: normalizeKeywords([
        extension,
        `.${extension}`,
        ...takeKeywords(file.data.components, 3),
        ...takeKeywords(file.data.concerns, 2),
      ]),
      route: "/files/size",
      section: "Files",
      rank: 700,
    })
  }

  for (const unit of units) {
    documents.push({
      id: `unit:${unit.id}`,
      kind: "unit",
      title: unit.data.shortName || unit.data.longName,
      subtitle: unit.data.relativeFileName,
      keywords: normalizeKeywords([
        unit.data.relativeFileName,
        unit.data.shortName !== unit.data.longName ? unit.data.longName : undefined,
        ...takeKeywords(unit.data.components, 3),
      ]),
      route: "/units/size",
      section: "Units",
      rank: 650,
    })
  }

  for (const contributor of contributors) {
    const contributorName = contributor.data.userName || contributor.data.email
    documents.push({
      id: `contributor:${contributor.id}`,
      kind: "contributor",
      title: contributorName,
      subtitle: contributor.data.email,
      keywords: normalizeKeywords([]),
      route: "/contributors",
      section: "Team",
      rank: 800,
    })
  }

  for (const metric of metrics) {
    const humanizedId = humanizeMetricId(metric.data.id)
    documents.push({
      id: `metric:${metric.id}`,
      kind: "metric",
      title: humanizedId,
      subtitle: metric.data.id,
      keywords: normalizeKeywords([metric.data.id, groupMetricId(metric.data.id), humanizedId]),
      route: "/metrics",
      section: "Overview",
      rank: 600,
    })
  }

  const extensionMap = new Map<string, { files: number; loc: number }>()
  for (const file of filesMain) {
    const extension = file.data.extension || "unknown"
    const current = extensionMap.get(extension) ?? { files: 0, loc: 0 }
    current.files += 1
    current.loc += file.data.linesOfCode
    extensionMap.set(extension, current)
  }

  for (const [extension, stats] of extensionMap) {
    documents.push({
      id: `extension:${extension}`,
      kind: "extension",
      title: `.${extension}`,
      subtitle: `${stats.files.toLocaleString()} files`,
      keywords: normalizeKeywords([extension, `.${extension}`]),
      route: "/",
      section: "Overview",
      rank: 550,
    })
  }

  return documents.sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
}
