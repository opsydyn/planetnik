// ADR-0005: Build the site-wide search corpus from Astro content collections.
import { getCollection, getEntry } from "astro:content"
import { getLandscapeContributorHref, getLandscapeRepositoryHref } from "../landscapeRoutes"
import { route } from "../route"
import type { SearchDocument } from "./types"

type PageDefinition = Omit<SearchDocument, "id" | "kind" | "rank">

const singleRepoPageDefinitions: PageDefinition[] = [
  {
    title: "Dashboard",
    subtitle: "Project summary and language breakdown",
    description: "High-level analysis dashboard with key metrics, language distribution, and duplication summary.",
    keywords: ["home", "dashboard", "summary", "languages", "duplication", "overview"],
    route: route("/"),
    section: "Overview",
  },
  {
    title: "About",
    subtitle: "Why Planetnik",
    description: "Background, positioning, and the software weather model behind Planetnik.",
    keywords: ["about", "planetnik", "weather", "architecture", "entropy", "drift", "turbulence"],
    route: route("/about"),
    section: "Overview",
  },
  {
    title: "Guide",
    subtitle: "How to use Planetnik",
    description: "Onboarding guide organized with tutorials, how-to guidance, reference, and explanation.",
    keywords: ["guide", "help", "documentation", "tutorial", "how-to", "reference", "explanation", "onboarding"],
    route: route("/guide"),
    section: "Overview",
  },
  {
    title: "Source Code Overview",
    subtitle: "Main and test code shape",
    description: "Overview of source code size, tests, and repository-wide structural distribution.",
    keywords: ["overview", "source code", "main", "test", "size", "distribution"],
    route: route("/overview"),
    section: "Overview",
  },
  {
    title: "Metrics",
    subtitle: "Raw and grouped analysis metrics",
    description: "Metric dashboard with grouped raw metrics and summary visualizations.",
    keywords: ["metrics", "loc", "duplication", "analysis time", "measurements"],
    route: route("/metrics"),
    section: "Overview",
  },
  {
    title: "Components",
    subtitle: "Structural components view",
    description: "Component-oriented view of the codebase and mapped file relationships.",
    keywords: ["components", "modules", "structure", "boundaries"],
    route: route("/components"),
    section: "Structure",
  },
  {
    title: "Balanced Coupling",
    subtitle: "Big Ball of Mud and system pressure",
    description: "Component coupling view blending static dependencies, temporal co-change, coordination overlap, and knowledge exposure.",
    keywords: ["coupling", "balanced coupling", "big ball of mud", "coordination", "knowledge risk", "temporal coupling"],
    route: route("/coupling"),
    section: "Structure",
  },
  {
    title: "Dependencies",
    subtitle: "Inter-component dependencies",
    description: "Dependency relationships between components and structural coupling signals.",
    keywords: ["dependencies", "coupling", "components", "edges", "structure"],
    route: route("/dependencies"),
    section: "Structure",
  },
  {
    title: "Duplication",
    subtitle: "Duplicated code overview",
    description: "Duplicate blocks and duplication-heavy parts of the codebase.",
    keywords: ["duplication", "duplicate", "copy paste", "repetition"],
    route: route("/duplication"),
    section: "Structure",
  },
  {
    title: "File Size",
    subtitle: "Largest source files",
    description: "Main source files ranked by lines of code and distribution.",
    keywords: ["files", "file size", "largest files", "loc"],
    route: route("/files/size"),
    section: "Files",
  },
  {
    title: "File Age",
    subtitle: "Oldest and newest files",
    description: "File age metrics across the codebase based on first and latest updates.",
    keywords: ["files", "age", "history", "oldest files", "newest files"],
    route: route("/files/age"),
    section: "Files",
  },
  {
    title: "File Churn",
    subtitle: "Most changed files",
    description: "Files ranked by churn and change activity.",
    keywords: ["files", "churn", "change", "commits", "activity"],
    route: route("/files/churn"),
    section: "Files",
  },
  {
    title: "Temporal Dependencies",
    subtitle: "Files that change together",
    description: "Temporal coupling view showing files frequently committed together.",
    keywords: ["files", "temporal", "dependencies", "co-change", "coupling"],
    route: route("/files/temporal"),
    section: "Files",
  },
  {
    title: "Unit Size",
    subtitle: "Largest functions and methods",
    description: "Units ranked by lines of code across the codebase.",
    keywords: ["units", "functions", "methods", "size", "loc"],
    route: route("/units/size"),
    section: "Units",
  },
  {
    title: "Conditional Complexity",
    subtitle: "Most complex units",
    description: "McCabe complexity view for units and functions.",
    keywords: ["units", "complexity", "mccabe", "conditionals", "risk"],
    route: route("/units/complexity"),
    section: "Units",
  },
  {
    title: "Contributors",
    subtitle: "People active in the codebase",
    description: "Contributor activity, recency, and code ownership signals.",
    keywords: ["contributors", "people", "authors", "ownership", "activity"],
    route: route("/contributors"),
    section: "Team",
  },
  {
    title: "Commits",
    subtitle: "Commit activity and extension trends",
    description: "Commit summaries and extension-level commit activity.",
    keywords: ["commits", "activity", "extensions", "history"],
    route: route("/commits"),
    section: "Team",
  },
  {
    title: "Team Topology",
    subtitle: "People dependencies",
    description: "Contributor relationships built from shared file modification patterns.",
    keywords: ["topology", "team", "people dependencies", "coordination", "ownership"],
    route: route("/topology"),
    section: "Team",
  },
  {
    title: "Hotspots",
    subtitle: "Ranked code health queue",
    description: "Prioritized files, units, and components based on structural, churn, temporal, and ownership signals.",
    keywords: ["hotspots", "code health", "priorities", "risk", "queue", "what to fix"],
    route: route("/hotspots"),
    section: "Quality",
  },
  {
    title: "Impact",
    subtitle: "Work on what matters",
    description: "Structural impact view connecting visible activity to complexity reduction, boundary shaping, knowledge spread, coordination relief, and change enablement.",
    keywords: ["impact", "work on what matters", "staff engineering", "structural impact", "snacking", "leverage"],
    route: route("/impact"),
    section: "Quality",
  },
  {
    title: "Features of Interest",
    subtitle: "Concerns and tagged areas",
    description: "Concern-oriented view of files matching configured features of interest.",
    keywords: ["concerns", "features", "interest", "tagged code"],
    route: route("/concerns"),
    section: "Quality",
  },
  {
    title: "Findings",
    subtitle: "Pattern-based findings",
    description: "Configured findings and notable pattern-based results.",
    keywords: ["findings", "patterns", "rules", "search results"],
    route: route("/findings"),
    section: "Quality",
  },
  {
    title: "Goals & Controls",
    subtitle: "Quality guardrails",
    description: "Quality goals, controls, and progress against them.",
    keywords: ["controls", "goals", "quality", "guardrails"],
    route: route("/controls"),
    section: "Quality",
  },
  {
    title: "Trend",
    subtitle: "Analysis over time",
    description: "Trend view showing how key structural signals move over time.",
    keywords: ["trend", "history", "time series", "change over time"],
    route: route("/trends"),
    section: "Quality",
  },
]

const landscapePageDefinitions: PageDefinition[] = [
  {
    title: "Landscape Dashboard",
    subtitle: "Multi-repository organization overview",
    description: "Landscape-wide overview of repositories, contributors, teams, languages, and recent activity.",
    keywords: ["landscape", "dashboard", "repositories", "organization", "overview", "multi repo"],
    route: route("/landscape"),
    section: "Landscape",
  },
  {
    title: "About",
    subtitle: "Why Planetnik",
    description: "Background, positioning, and the software weather model behind Planetnik.",
    keywords: ["about", "planetnik", "weather", "architecture", "entropy", "drift", "turbulence"],
    route: route("/about"),
    section: "Overview",
  },
  {
    title: "Guide",
    subtitle: "How to use Planetnik",
    description: "Onboarding guide organized with tutorials, how-to guidance, reference, and explanation.",
    keywords: ["guide", "help", "documentation", "tutorial", "how-to", "reference", "explanation", "onboarding"],
    route: route("/guide"),
    section: "Overview",
  },
  {
    title: "Landscape Repositories",
    subtitle: "Repository activity and scale",
    description: "Repository inventory for the landscape with size, contributor activity, and recent commits.",
    keywords: ["landscape", "repositories", "repo inventory", "multi repo", "activity"],
    route: route("/landscape/repositories"),
    section: "Landscape",
  },
  {
    title: "Landscape Contributors",
    subtitle: "People working across repositories",
    description: "Contributor reach, multi-repository activity, and collaboration across the landscape.",
    keywords: ["landscape", "contributors", "people", "multi repo", "teams"],
    route: route("/landscape/contributors"),
    section: "Landscape",
  },
  {
    title: "Landscape Teams",
    subtitle: "Configured team coverage",
    description: "Team inventory and repository ownership across the landscape.",
    keywords: ["landscape", "teams", "ownership", "grouping", "org structure"],
    route: route("/landscape/teams"),
    section: "Landscape",
  },
  {
    title: "Landscape Team Topology",
    subtitle: "Cross-repository people dependencies",
    description: "Contributor relationships built from shared-file work across repositories.",
    keywords: ["landscape", "topology", "people dependencies", "coordination", "cross repo"],
    route: route("/landscape/topology"),
    section: "Landscape",
  },
  {
    title: "Landscape Tags",
    subtitle: "Repository tags and tag matrix",
    description: "Tag coverage, grouped repositories, and tag overlap across the landscape.",
    keywords: ["landscape", "tags", "taxonomy", "repository groups", "tag matrix"],
    route: route("/landscape/tags"),
    section: "Landscape",
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

function makePageDocuments(projectName: string, pages: PageDefinition[]): SearchDocument[] {
  return pages.map((page, index) => ({
    id: `page:${page.route}`,
    kind: "page",
    title: page.title,
    subtitle: page.subtitle,
    description:
      page.route === route("/") || page.route === route("/landscape")
        ? `${projectName} analysis dashboard.`
        : page.description,
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
  const reportContext = await getEntry("reportContext", "context")
  const reportMode = reportContext?.data.reportMode ?? "single_repository"
  const summary = await getEntry("analysis", "summary")
  const projectName = reportContext?.data.title ?? summary?.data.metadata.name ?? "Planetnik"

  if (reportMode === "landscape") {
    const landscapeContributors = await getCollection("landscapeContributors")
    const landscapeRepositories = await getCollection("landscapeRepositories")
    const landscapeTeams = await getCollection("landscapeTeams")

    const documents: SearchDocument[] = [...makePageDocuments(projectName, landscapePageDefinitions)]

    for (const contributor of landscapeContributors) {
      const displayName = contributor.data.displayName || contributor.data.name || contributor.data.email
      documents.push({
        id: `contributor:${contributor.id}`,
        kind: "contributor",
        title: displayName,
        subtitle: `${contributor.data.email} · ${contributor.data.repositoryCount} ${contributor.data.repositoryCount === 1 ? "repository" : "repositories"}`,
        keywords: normalizeKeywords([
          contributor.data.email,
          contributor.data.name,
          contributor.data.displayName,
          contributor.data.isBot ? "bot" : "human",
        ]),
        route: getLandscapeContributorHref(contributor.data.email),
        section: "Landscape",
        rank: 800,
      })
    }

    for (const repo of landscapeRepositories) {
      documents.push({
        id: `repository:${repo.id}`,
        kind: "repository",
        title: repo.data.name,
        subtitle: repo.data.description || `${repo.data.mainLinesOfCode.toLocaleString()} LOC`,
        keywords: normalizeKeywords([
          repo.data.name,
          repo.data.description,
          ...repo.data.tags.map((t) => t.name),
        ]),
        route: getLandscapeRepositoryHref(repo.data.repoKey),
        section: "Landscape",
        rank: 900,
      })
    }

    for (const team of landscapeTeams) {
      documents.push({
        id: `team:${team.id}`,
        kind: "team",
        title: team.data.name,
        subtitle: `${team.data.memberCount} members · ${team.data.repositoryCount} repositories`,
        keywords: normalizeKeywords([team.data.name, team.data.description]),
        route: route("/landscape/teams"),
        section: "Landscape",
        rank: 850,
      })
    }

    return documents.sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
  }

  const filesMain = await getCollection("filesMain")
  const units = await getCollection("units")
  const contributors = await getCollection("contributors")
  const metrics = await getCollection("metrics")
  const documents: SearchDocument[] = [...makePageDocuments(projectName, singleRepoPageDefinitions)]

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
      route: route("/files/size"),
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
      route: route("/units/size"),
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
      route: route("/contributors"),
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
      route: route("/metrics"),
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
      route: route("/"),
      section: "Overview",
      rank: 550,
    })
  }

  return documents.sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title))
}
