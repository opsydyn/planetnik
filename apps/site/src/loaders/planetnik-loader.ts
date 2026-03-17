import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Loader } from "astro/loaders"

// Load .env manually since content loaders run before Vite's env loading
const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
const envPath = join(siteRoot, ".env")
if (existsSync(envPath) && !process.env.PLANETNIK_DATA_DIR) {
  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx < 0) continue
    const key = trimmed.substring(0, eqIdx).trim()
    const value = trimmed.substring(eqIdx + 1).trim()
    if (key === "PLANETNIK_DATA_DIR") process.env.PLANETNIK_DATA_DIR = value
  }
}

export function resolveDataDir(): string {
  const dir = process.env.PLANETNIK_DATA_DIR ?? join(process.cwd(), "_planetnik", "reports", "data")
  if (!existsSync(dir)) {
    console.warn(`[planetnik-loader] Data directory not found: ${dir}`)
    console.warn(`[planetnik-loader] Set PLANETNIK_DATA_DIR env var or create apps/site/.env`)
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
      const raw = readJsonFile("dependencies.json") as { dependencies?: unknown[] } | null
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
        const rec = {
          email,
          commitsAllTime: parseInt(cols[1]) || 0,
          commits30Days: parseInt(cols[2]) || 0,
          commits90Days: parseInt(cols[3]) || 0,
          commits180Days: parseInt(cols[4]) || 0,
          commits365Days: parseInt(cols[5]) || 0,
          firstCommit: cols[6].trim(),
          lastCommit: cols[7].trim(),
          percentage: cols[8] ? cols[8].trim() : "",
        }
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

export function temporalDepsLoader(): Loader {
  return {
    name: "planetnik-temporal-deps",
    async load({ store, parseData }) {
      const text = readTextFile("temporal_dependencies.txt")
      if (!text) return
      const lines = text.split("\n").filter((l) => l.trim())
      if (lines.length < 2) return
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split("\t")
        if (cols.length < 5) continue
        const id = `${cols[0].trim()}::${cols[1].trim()}`
        const rec = {
          file1: cols[0].trim(),
          file2: cols[1].trim(),
          sameCommits: parseInt(cols[2]) || 0,
          commitsFile1: parseInt(cols[3]) || 0,
          commitsFile2: parseInt(cols[4]) || 0,
        }
        const data = await parseData({ id, data: rec })
        store.set({ id, data })
      }
    },
  }
}
