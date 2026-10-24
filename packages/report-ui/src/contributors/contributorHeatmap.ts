export interface DailyActivityEntry {
  date: string
  commits: number
}

export interface ContributorHeatmapCell {
  date: string
  commits: number
  dayIndex: number
}

export interface ContributorHeatmapWeek {
  startDate: string
  bins: ContributorHeatmapCell[]
}

export interface ContributorHeatmapMonthLabel {
  weekIndex: number
  label: string
}

export interface ContributorHeatmapModel {
  weeks: ContributorHeatmapWeek[]
  monthLabels: ContributorHeatmapMonthLabel[]
  maxCommits: number
  totalCommits: number
  activeDays: number
  startDate: string
  endDate: string
  weekdayLabels: readonly string[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
})

interface BuildContributorHeatmapOptions {
  endDate?: string
  weeks?: number
}

export function buildContributorHeatmap(
  dailyActivity: DailyActivityEntry[],
  { endDate, weeks = 53 }: BuildContributorHeatmapOptions = {},
): ContributorHeatmapModel {
  const safeWeekCount = Math.max(1, weeks)
  const activityByDate = new Map<string, number>()

  for (const entry of dailyActivity) {
    const date = parseIsoDate(entry.date)
    if (!date) continue
    const key = formatIsoDate(date)
    activityByDate.set(key, (activityByDate.get(key) ?? 0) + entry.commits)
  }

  const resolvedEndDate = parseIsoDate(endDate) ?? getLatestActivityDate(activityByDate) ?? startOfUtcDay(new Date())

  const lastWeekStart = startOfWeek(resolvedEndDate)
  const firstWeekStart = addDays(lastWeekStart, -7 * (safeWeekCount - 1))
  const weeksData = Array.from({ length: safeWeekCount }, (_, weekIndex) => {
    const weekStart = addDays(firstWeekStart, weekIndex * 7)
    return {
      startDate: formatIsoDate(weekStart),
      bins: Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDays(weekStart, dayIndex)
        const key = formatIsoDate(date)
        return { date: key, commits: activityByDate.get(key) ?? 0, dayIndex }
      }),
    }
  })

  const maxCommits = weeksData.reduce((maxValue, week) => {
    return Math.max(maxValue, ...week.bins.map((cell) => cell.commits))
  }, 0)

  return {
    weeks: weeksData,
    monthLabels: getMonthLabels(weeksData),
    maxCommits,
    totalCommits: weeksData.reduce(
      (sum, week) => sum + week.bins.reduce((weekSum, cell) => weekSum + cell.commits, 0),
      0,
    ),
    activeDays: weeksData.reduce((sum, week) => sum + week.bins.filter((cell) => cell.commits > 0).length, 0),
    startDate: weeksData[0]?.startDate ?? formatIsoDate(firstWeekStart),
    endDate: formatIsoDate(resolvedEndDate),
    weekdayLabels: WEEKDAY_LABELS,
  }
}

export function getContributorMonthlyActivity(
  dailyActivity: DailyActivityEntry[],
): Array<{ label: string; value: number }> {
  const monthlyActivity = new Map<string, number>()
  for (const entry of dailyActivity) {
    if (typeof entry.date !== "string" || entry.date.length < 7) continue
    const month = entry.date.slice(0, 7)
    monthlyActivity.set(month, (monthlyActivity.get(month) ?? 0) + entry.commits)
  }
  return Array.from(monthlyActivity.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }))
}

function getMonthLabels(weeks: ContributorHeatmapWeek[]): ContributorHeatmapMonthLabel[] {
  const labels: ContributorHeatmapMonthLabel[] = []
  let lastMonthKey = ""

  weeks.forEach((week, weekIndex) => {
    const anchorDate =
      week.bins.find((cell) => cell.date.endsWith("-01"))?.date ?? (weekIndex === 0 ? week.startDate : null)

    if (!anchorDate) return
    const monthKey = anchorDate.slice(0, 7)
    if (monthKey === lastMonthKey) return

    const parsed = parseIsoDate(anchorDate)
    if (!parsed) return

    labels.push({ weekIndex, label: MONTH_LABEL_FORMATTER.format(parsed) })
    lastMonthKey = monthKey
  })

  return labels
}

function getLatestActivityDate(activityByDate: Map<string, number>): Date | null {
  const latest = Array.from(activityByDate.keys()).sort().at(-1)
  return latest ? parseIsoDate(latest) : null
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfWeek(date: Date): Date {
  const dayIndex = date.getUTCDay()
  const mondayOffset = (dayIndex + 6) % 7
  return addDays(date, -mondayOffset)
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
