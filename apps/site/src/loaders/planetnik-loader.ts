import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Loader } from "astro/loaders"

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
const workspaceRoot = join(siteRoot, "../..")
const defaultDataDir = join(workspaceRoot, "_planetnik", "reports", "data")

let loadedEnv: Record<string, string> | undefined

function getLoadedEnv(): Record<string, string> {
  if (!loadedEnv) {
    const mode = process.env.MODE ?? process.env.NODE_ENV ?? "development"
    const envFiles = [`.env.${mode}.local`, `.env.${mode}`, ".env.local", ".env"]

    for (const envFile of envFiles) {
      const envPath = join(siteRoot, envFile)
      if (existsSync(envPath)) {
        process.loadEnvFile(envPath)
      }
    }

    loadedEnv = { ...process.env } as Record<string, string>
  }
  const env = loadedEnv
  return env
}

export function resolveDataDir(): string {
  const env = getLoadedEnv()
  const dir =
    process.env.PLANETNIK_DATA_DIR ??
    env.PLANETNIK_DATA_DIR ??
    process.env.PLANETNIK_LANDSCAPE_DATA_DIR ??
    env.PLANETNIK_LANDSCAPE_DATA_DIR ??
    defaultDataDir
  if (!existsSync(dir)) {
    console.warn(`[planetnik-loader] Data directory not found: ${dir}`)
    console.warn(
      `[planetnik-loader] Set PLANETNIK_DATA_DIR or PLANETNIK_LANDSCAPE_DATA_DIR env var, or create apps/site/.env.local`,
    )
  }
  return dir
}

function readJsonFile(filename: string): unknown | null {
  const path = join(resolveDataDir(), filename)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf-8"))
}

function readTextFile(filename: string): string | null {
  const path = join(resolveDataDir(), filename)
  if (!existsSync(path)) return null
  return readFileSync(path, "utf-8")
}

function readJsonArrayItems(
  filename: string,
  key: string,
): Array<{
  id: string
  data: Record<string, unknown>
}> {
  const raw = readJsonFile(filename) as Record<string, unknown> | null
  if (!raw) return []

  const items = raw[key]
  if (!Array.isArray(items)) return []

  return items.map((item, index) => {
    const data = item as Record<string, unknown>
    const idCandidate =
      (typeof data.id === "string" && data.id) ||
      (typeof data.email === "string" && data.email) ||
      (typeof data.name === "string" && data.name) ||
      (typeof data.key === "string" && data.key)

    return {
      id: idCandidate || `${key}-${index + 1}`,
      data,
    }
  })
}

function getFallbackReportContext(): Record<string, unknown> {
  const summary = readJsonFile("analysisResults.json") as Record<string, unknown> | null
  const metadata = summary?.metadata as Record<string, unknown> | undefined
  const title = typeof metadata?.name === "string" && metadata.name ? metadata.name : "Planetnik"

  return {
    mode: "single_repository",
    reportMode: "single_repository",
    title,
    rootRoute: "/",
    dataVersion: 1,
    source: "analysisResults",
    hasLandscape: false,
    hasSingleRepositoryAnalysis: true,
    primaryNavigation: ["overview", "structure", "files", "units", "team", "quality"],
  }
}

export function reportContextLoader(): Loader {
  return {
    name: "planetnik-report-context",
    async load({ store, parseData }) {
      const raw = (readJsonFile("report_context.json") as Record<string, unknown> | null) ?? getFallbackReportContext()
      const data = await parseData({ id: "context", data: raw })
      store.set({ id: "context", data })
    },
  }
}

export function landscapeOverviewLoader(): Loader {
  return {
    name: "planetnik-landscape-overview",
    async load({ store, parseData }) {
      const raw = readJsonFile("landscape_overview.json") as Record<string, unknown> | null
      if (!raw) return
      const data = await parseData({ id: "overview", data: raw })
      store.set({ id: "overview", data })
    },
  }
}

export function landscapeRepositoriesLoader(): Loader {
  return {
    name: "planetnik-landscape-repositories",
    async load({ store, parseData }) {
      for (const item of readJsonArrayItems("landscape_repositories.json", "repositories")) {
        const data = await parseData(item)
        store.set({ id: item.id, data })
      }
    },
  }
}

export function landscapeContributorsLoader(): Loader {
  return {
    name: "planetnik-landscape-contributors",
    async load({ store, parseData }) {
      for (const item of readJsonArrayItems("landscape_contributors.json", "contributors")) {
        const data = await parseData(item)
        store.set({ id: item.id, data })
      }
    },
  }
}

export function landscapeTeamsLoader(): Loader {
  return {
    name: "planetnik-landscape-teams",
    async load({ store, parseData }) {
      for (const item of readJsonArrayItems("landscape_teams.json", "teams")) {
        const data = await parseData(item)
        store.set({ id: item.id, data })
      }
    },
  }
}

export function landscapeTopologyLoader(): Loader {
  return {
    name: "planetnik-landscape-topology",
    async load({ store, parseData }) {
      const raw = readJsonFile("landscape_topology.json") as Record<string, unknown> | null
      if (!raw) return
      const data = await parseData({ id: "topology", data: raw })
      store.set({ id: "topology", data })
    },
  }
}

export function landscapeTagsLoader(): Loader {
  return {
    name: "planetnik-landscape-tags",
    async load({ store, parseData }) {
      const raw = readJsonFile("landscape_tags.json") as Record<string, unknown> | null
      if (!raw) return
      const data = await parseData({ id: "tags", data: raw })
      store.set({ id: "tags", data })
    },
  }
}

export function landscapeTagMatrixLoader(): Loader {
  return {
    name: "planetnik-landscape-tag-matrix",
    async load({ store, parseData }) {
      const raw = readJsonFile("landscape_tag_matrix.json") as Record<string, unknown> | null
      if (!raw) return
      const data = await parseData({ id: "tag-matrix", data: raw })
      store.set({ id: "tag-matrix", data })
    },
  }
}

function readJsonFilesInDirectory(directoryName: string): Array<{ id: string; data: Record<string, unknown> }> {
  const directoryPath = join(resolveDataDir(), directoryName)
  if (!existsSync(directoryPath)) return []

  return readdirSync(directoryPath)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const path = join(directoryPath, fileName)
      const data = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>
      const id = typeof data.email === "string" && data.email ? data.email : decodeURIComponent(fileName.replace(/\.json$/, ""))
      return { id, data }
    })
}

export function analysisLoader(): Loader {
  return {
    name: "planetnik-analysis",
    async load({ store, parseData }) {
      const raw = readJsonFile("analysisResults.json")
      if (!raw) return
      const data = await parseData({ id: "summary", data: raw as Record<string, unknown> })
      store.set({ id: "summary", data })
    },
  }
}

export function filesLoader(variant: "main" | "test"): Loader {
  return {
    name: `planetnik-files-${variant}`,
    async load({ store, parseData }) {
      const raw = readJsonFile(`files_${variant}.json`) as { files?: unknown[] } | null
      if (!raw?.files) return
      for (const file of raw.files) {
        const rec = file as Record<string, unknown>
        const id = rec.relativePath as string
        const data = await parseData({ id, data: rec })
        store.set({ id, data })
      }
    },
  }
}

export function unitsLoader(): Loader {
  return {
    name: "planetnik-units",
    async load({ store, parseData }) {
      const raw = readJsonFile("units.json") as { units?: unknown[] } | null
      if (!raw?.units) return
      for (const unit of raw.units) {
        const rec = unit as Record<string, unknown>
        const id = `${rec.relativeFileName}:${rec.startLine}`
        const data = await parseData({ id, data: rec })
        store.set({ id, data })
      }
    },
  }
}

export function duplicatesLoader(): Loader {
  return {
    name: "planetnik-duplicates",
    async load({ store, parseData }) {
      const raw = readJsonFile("duplicates.json") as { duplicates?: unknown[] } | null
      if (!raw?.duplicates) return
      for (let i = 0; i < raw.duplicates.length; i++) {
        const rec = raw.duplicates[i] as Record<string, unknown>
        const id = `dup-${i}`
        const data = await parseData({ id, data: rec })
        store.set({ id, data })
      }
    },
  }
}

export function dependenciesLoader(): Loader {
  return {
    name: "planetnik-dependencies",
    async load({ store, parseData }) {
      const raw = readJsonFile("component_dependencies.json") as { dependencies?: unknown[] } | null
      if (!raw?.dependencies) return
      for (let i = 0; i < raw.dependencies.length; i++) {
        const rec = raw.dependencies[i] as Record<string, unknown>
        const id = `dep-${i}`
        const data = await parseData({ id, data: rec })
        store.set({ id, data })
      }
    },
  }
}

export function metricsLoader(): Loader {
  return {
    name: "planetnik-metrics",
    async load({ store, parseData }) {
      const text = readTextFile("metrics.txt")
      if (!text) return
      for (const line of text.split("\n")) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const colonIdx = trimmed.indexOf(":")
        if (colonIdx < 0) continue
        const id = trimmed.substring(0, colonIdx).trim()
        const value = parseFloat(trimmed.substring(colonIdx + 1).trim())
        if (Number.isNaN(value)) continue
        const data = await parseData({ id, data: { id, value } })
        store.set({ id, data })
      }
    },
  }
}

export function controlsLoader(): Loader {
  return {
    name: "planetnik-controls",
    async load({ store, parseData }) {
      const raw = readJsonFile("controls.json") as {
        goals?: Array<{
          goal?: string
          description?: string
          controls?: Array<Record<string, unknown>>
        }>
      } | null
      if (!raw?.goals) return

      for (const goal of raw.goals) {
        const goalName = goal.goal ?? "Controls"
        const goalDescription = goal.description ?? ""
        const controls = goal.controls ?? []

        for (let i = 0; i < controls.length; i++) {
          const control = controls[i] ?? {}
          const metricId = typeof control.metricId === "string" ? control.metricId : ""
          const id = `${goalName}::${metricId || `control-${i}`}`
          const data = await parseData({
            id,
            data: {
              goal: goalName,
              goalDescription,
              metricId,
              metricValue: typeof control.metricValue === "number" ? control.metricValue : null,
              metricDescription: typeof control.metricDescription === "string" ? control.metricDescription : "",
              desiredRange: control.desiredRange ?? { min: "0", max: "0", tolerance: "0" },
              desiredRangeText: typeof control.desiredRangeText === "string" ? control.desiredRangeText : "",
              status: typeof control.status === "string" ? control.status : "",
              controlDescription: typeof control.controlDescription === "string" ? control.controlDescription : "",
            },
          })
          store.set({ id, data })
        }
      }
    },
  }
}

export function hotspotsLoader(): Loader {
  return {
    name: "planetnik-hotspots",
    async load({ store, parseData }) {
      const raw = readJsonFile("hotspots.json") as {
        fileHotspots?: Array<Record<string, unknown>>
        unitHotspots?: Array<Record<string, unknown>>
        componentHotspots?: Array<Record<string, unknown>>
      } | null
      if (!raw) return

      const groups = [
        ...(raw.fileHotspots ?? []),
        ...(raw.unitHotspots ?? []),
        ...(raw.componentHotspots ?? []),
      ]

      for (const entry of groups) {
        const id =
          typeof entry.id === "string" && entry.id
            ? entry.id
            : `${String(entry.kind ?? "hotspot")}:${String(entry.name ?? "unknown")}:${String(entry.parent ?? "")}`
        const data = await parseData({ id, data: entry })
        store.set({ id, data })
      }
    },
  }
}

export function impactLoader(): Loader {
  return {
    name: "planetnik-impact",
    async load({ store, parseData }) {
      const raw = readJsonFile("impact.json")
      if (!raw || typeof raw !== "object") return
      const data = await parseData({ id: "impact", data: raw as Record<string, unknown> })
      store.set({ id: "impact", data })
    },
  }
}

export function findingsLoader(): Loader {
  return {
    name: "planetnik-findings",
    async load({ store, parseData }) {
      const raw = readJsonFile("findings.json") as {
        items?: Array<Record<string, unknown>>
      } | null
      if (!raw?.items) return

      for (let i = 0; i < raw.items.length; i++) {
        const entry = raw.items[i] ?? {}
        const id =
          typeof entry.id === "string" && entry.id.trim().length > 0
            ? entry.id
            : `finding-${i + 1}`
        const data = await parseData({ id, data: entry })
        store.set({ id, data })
      }
    },
  }
}

export function contributorsLoader(): Loader {
  return {
    name: "planetnik-contributors",
    async load({ store, parseData }) {
      const text = readTextFile("contributors.txt")
      if (!text) return
      const lines = text.split("\n").filter((l) => l.trim())
      if (lines.length < 2) return
      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split("\t")
        if (cols.length < 8) continue
        const email = cols[0].trim()
        const rec: Record<string, unknown> = {
          email,
          commitsAllTime: parseInt(cols[1], 10) || 0,
          commits30Days: parseInt(cols[2], 10) || 0,
          commits90Days: parseInt(cols[3], 10) || 0,
          commits180Days: parseInt(cols[4], 10) || 0,
          commits365Days: parseInt(cols[5], 10) || 0,
          firstCommit: cols[6].trim(),
          lastCommit: cols[7].trim(),
          percentage: cols[8] ? cols[8].trim() : "",
        }
        // New columns: userName, isRookie, isActive
        if (cols[9] !== undefined) rec.userName = cols[9].trim()
        if (cols[10] !== undefined) rec.isRookie = cols[10].trim() === "true"
        if (cols[11] !== undefined) rec.isActive = cols[11].trim() === "true"
        const data = await parseData({ id: email, data: rec })
        store.set({ id: email, data })
      }
    },
  }
}

export function peopleDependenciesLoader(): Loader {
  return {
    name: "planetnik-people-deps",
    async load({ store, parseData }) {
      const raw = readJsonFile("people_dependencies.json") as Array<{
        from: string
        to: string
        count: number
        files: string[]
      }> | null
      if (!raw || !Array.isArray(raw)) return
      for (const entry of raw) {
        const id = `${entry.from}::${entry.to}`
        const data = await parseData({ id, data: entry })
        store.set({ id, data })
      }
    },
  }
}

export function commitsPerExtensionLoader(): Loader {
  return {
    name: "planetnik-commits-per-extension",
    async load({ store, parseData }) {
      const raw = readJsonFile("commits_per_extension.json") as Array<Record<string, unknown>> | null
      if (!raw || !Array.isArray(raw)) return
      for (const entry of raw) {
        const ext = entry.extension as string
        const id = ext || "no-extension"
        const data = await parseData({ id, data: entry })
        store.set({ id, data })
      }
    },
  }
}

export function contributorTimelineLoader(): Loader {
  return {
    name: "planetnik-contributor-timeline",
    async load({ store, parseData }) {
      const raw = readJsonFile("contributor_timeline.json") as {
        perYear?: Array<Record<string, unknown>>
        perMonth?: Array<Record<string, unknown>>
      } | null
      if (!raw) return

      for (const entry of raw.perYear ?? []) {
        const id = `year-${entry.timeSlot}`
        const data = await parseData({ id, data: { ...entry, granularity: "year" } })
        store.set({ id, data })
      }
      for (const entry of raw.perMonth ?? []) {
        const id = `month-${entry.timeSlot}`
        const data = await parseData({ id, data: { ...entry, granularity: "month" } })
        store.set({ id, data })
      }
    },
  }
}

export function contributorDetailsLoader(): Loader {
  return {
    name: "planetnik-contributor-details",
    async load({ store, parseData }) {
      const records = readJsonFilesInDirectory("contributor_details")
      for (const record of records) {
        const data = await parseData({ id: record.id, data: record.data })
        store.set({ id: record.id, data })
      }
    },
  }
}

export function contributorImpactLoader(): Loader {
  return {
    name: "planetnik-contributor-impact",
    async load({ store, parseData }) {
      const raw = readJsonFile("contributor_impact.json") as {
        periods?: Array<{
          period_key?: string
          period_label?: string
          contributors?: Array<Record<string, unknown>>
        }>
      } | null
      if (!raw?.periods) return

      const allTimePeriod = raw.periods.find((period) => period.period_key === "all_time")
      if (!allTimePeriod?.contributors) return

      for (const contributor of allTimePeriod.contributors) {
        const email = typeof contributor.email === "string" ? contributor.email : ""
        if (!email) continue
        const data = await parseData({ id: email, data: contributor })
        store.set({ id: email, data })
      }
    },
  }
}

export function temporalDepsLoader(): Loader {
  return {
    name: "planetnik-temporal-deps",
    async load({ store, parseData }) {
      const raw = readJsonFile("temporal_dependencies.json") as { dependencies?: unknown[] } | null
      if (!raw?.dependencies) return
      for (let i = 0; i < raw.dependencies.length; i++) {
        const rec = raw.dependencies[i] as Record<string, unknown>
        const id = `${String(rec.periodKey)}::${String(rec.file1)}::${String(rec.file2)}`
        const data = await parseData({ id, data: rec })
        store.set({ id, data })
      }
    },
  }
}
