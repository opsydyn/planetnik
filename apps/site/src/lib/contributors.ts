import { route } from "./route"

export interface ContributorIdentity {
  email: string
  userName?: string | null
}

export interface DailyActivityEntry {
  date: string
  commits: number
}

export function getContributorDisplayName({ email, userName }: ContributorIdentity): string {
  const trimmedUserName = userName?.trim()
  if (trimmedUserName) return trimmedUserName

  const atIndex = email.indexOf("@")
  return atIndex > 0 ? email.slice(0, atIndex) : email
}

export function getContributorRouteParam(email: string): string {
  return encodeURIComponent(email).replace(/%/g, "$")
}

export function getContributorHref(
  email: string,
  options?: {
    source?: string
  },
): string {
  const basePath = route(`/contributors/${getContributorRouteParam(email)}`)
  if (!options?.source) return basePath

  const searchParams = new URLSearchParams()
  searchParams.set("from", options.source)
  return `${basePath}?${searchParams.toString()}`
}

export function getContributorEmailFromParam(param: string): string {
  try {
    return decodeURIComponent(param.replace(/\$/g, "%"))
  } catch {
    return param
  }
}

export function getContributorMonthlyActivity(dailyActivity: DailyActivityEntry[]): Array<{ label: string; value: number }> {
  const monthlyActivity = new Map<string, number>()

  for (const entry of dailyActivity) {
    if (!entry.date || entry.date.length < 7) continue
    const month = entry.date.slice(0, 7)
    monthlyActivity.set(month, (monthlyActivity.get(month) ?? 0) + entry.commits)
  }

  return Array.from(monthlyActivity.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }))
}
