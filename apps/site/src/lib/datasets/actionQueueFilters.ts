import type {
  PortfolioActionPriorityBand,
  PortfolioActionQueueFilters,
  PortfolioActionSignalDomain,
  PortfolioActionWindow,
} from "@planetnik/common"

const priorityBands = [
  "critical",
  "high",
  "medium",
  "low",
  "unrated",
] as const satisfies readonly PortfolioActionPriorityBand[]
const domains = [
  "control",
  "coupling",
  "hotspot",
  "impact",
  "ownership",
  "security",
  "trend",
] as const satisfies readonly PortfolioActionSignalDomain[]
const windows = ["current", "latest-compatible", "7d", "30d", "90d"] as const satisfies readonly PortfolioActionWindow[]

const uniqueIdentifiers = (values: readonly string[]): readonly string[] =>
  [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort()

const allowedValues = <Value extends string>(
  values: readonly string[],
  allowlist: readonly Value[],
): readonly Value[] => {
  const selected = new Set(values.filter((value): value is Value => allowlist.includes(value as Value)))
  return allowlist.filter((value) => selected.has(value))
}

const parseWindow = (value: string | null): PortfolioActionWindow =>
  value !== null && windows.includes(value as PortfolioActionWindow) ? (value as PortfolioActionWindow) : "current"

export function portfolioActionFilterDefaults(): PortfolioActionQueueFilters {
  return Object.freeze({
    repositoryIds: Object.freeze([] as string[]),
    teamIds: Object.freeze([] as string[]),
    priorityBands: Object.freeze([] as PortfolioActionPriorityBand[]),
    domains: Object.freeze([] as PortfolioActionSignalDomain[]),
    window: "current" as const,
  })
}

export function parsePortfolioActionFilters(params: URLSearchParams): PortfolioActionQueueFilters {
  return {
    repositoryIds: uniqueIdentifiers(params.getAll("repo")),
    teamIds: uniqueIdentifiers(params.getAll("team")),
    priorityBands: allowedValues(params.getAll("priority"), priorityBands),
    domains: allowedValues(params.getAll("domain"), domains),
    window: parseWindow(params.get("window")),
  }
}

export function serializePortfolioActionFilters(filters: PortfolioActionQueueFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const repositoryId of uniqueIdentifiers(filters.repositoryIds)) params.append("repo", repositoryId)
  for (const teamId of uniqueIdentifiers(filters.teamIds)) params.append("team", teamId)
  for (const priorityBand of allowedValues(filters.priorityBands, priorityBands))
    params.append("priority", priorityBand)
  for (const domain of allowedValues(filters.domains, domains)) params.append("domain", domain)
  const window = parseWindow(filters.window)
  if (window !== "current") params.set("window", window)
  return params
}
