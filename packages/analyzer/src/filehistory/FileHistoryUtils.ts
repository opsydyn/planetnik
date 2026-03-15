export class FileHistoryUtils {
  static getDateFromString(dateString: string): Date | null {
    if (!dateString || dateString.length < 10) return null
    const dateStr = dateString.substring(0, 10)
    const parsed = new Date(`${dateStr}T00:00:00Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  static daysBetween(date1: Date, date2: Date): number {
    const diffMs = Math.abs(date1.getTime() - date2.getTime())
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
  }

  static daysFromToday(dateString: string): number {
    const date = FileHistoryUtils.getDateFromString(dateString)
    if (!date) return 0
    const now = DateUtils.getAnalysisDateAsDate()
    const diffMs = Math.abs(now.getTime() - date.getTime())
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
  }
}

export class DateUtils {
  private static dateParam: string | null = null
  private static latestCommitDate: string | null = null

  static setDateParam(dateParam: string | null): void {
    DateUtils.dateParam = dateParam
  }

  static getDateParam(): string | null {
    return DateUtils.dateParam
  }

  static setLatestCommitDate(date: string | null): void {
    DateUtils.latestCommitDate = date
  }

  static getLatestCommitDate(): string | null {
    return DateUtils.latestCommitDate
  }

  static getAnalysisDate(): string {
    const d = DateUtils.getAnalysisDateAsDate()
    return d.toISOString().substring(0, 10)
  }

  static getAnalysisDateAsDate(): Date {
    if (DateUtils.dateParam) {
      return new Date(`${DateUtils.dateParam}T00:00:00Z`)
    }
    if (DateUtils.latestCommitDate) {
      return new Date(`${DateUtils.latestCommitDate}T00:00:00Z`)
    }
    return new Date()
  }

  static getAnalysisYear(): number {
    return DateUtils.getAnalysisDateAsDate().getUTCFullYear()
  }

  static isDateWithinRange(date: string, rangeInDays: number): boolean {
    const d = FileHistoryUtils.getDateFromString(date)
    if (!d) return false
    const now = DateUtils.getAnalysisDateAsDate()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= rangeInDays
  }

  static isCommittedBetween(date: string, daysAgo1: number, daysAgo2: number): boolean {
    const d = FileHistoryUtils.getDateFromString(date)
    if (!d) return false
    const now = DateUtils.getAnalysisDateAsDate()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    const minDays = Math.min(daysAgo1, daysAgo2)
    const maxDays = Math.max(daysAgo1, daysAgo2)
    return diffDays >= minDays && diffDays <= maxDays
  }

  static isCommittedLessThanDaysAgo(date: string, daysAgo: number): boolean {
    return DateUtils.isCommittedBetween(date, 0, daysAgo)
  }

  static isAnyDateCommittedBetween(dates: string[], daysAgo1: number, daysAgo2: number): boolean {
    return dates.some((d) => DateUtils.isCommittedBetween(d, daysAgo1, daysAgo2))
  }

  static getPastDays(numberOfDays: number, latestCommitDate: string): string[] {
    const result: string[] = []
    const base = new Date(`${latestCommitDate}T00:00:00Z`)
    for (let i = 0; i < numberOfDays; i++) {
      const d = new Date(base.getTime() - i * 24 * 60 * 60 * 1000)
      result.push(d.toISOString().substring(0, 10))
    }
    return result
  }

  static getPastWeeks(numberOfWeeks: number, latestCommitDate: string): string[] {
    const result: string[] = []
    const base = new Date(`${latestCommitDate}T00:00:00Z`)
    for (let i = 0; i < numberOfWeeks; i++) {
      const d = new Date(base.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      result.push(DateUtils.getWeekMonday(d.toISOString().substring(0, 10)))
    }
    return result
  }

  static getPastMonths(numberOfMonths: number, latestCommitDate: string): string[] {
    const result: string[] = []
    const base = new Date(`${latestCommitDate}T00:00:00Z`)
    for (let i = 0; i < numberOfMonths; i++) {
      const d = new Date(base.getUTCFullYear(), base.getUTCMonth() - i, 1)
      result.push(d.toISOString().substring(0, 7))
    }
    return result
  }

  static getPastYears(numberOfYears: number, latestCommitDate: string): string[] {
    const result: string[] = []
    const base = new Date(`${latestCommitDate}T00:00:00Z`)
    for (let i = 0; i < numberOfYears; i++) {
      result.push(`${base.getUTCFullYear() - i}`)
    }
    return result
  }

  static getWeekMonday(date: string): string {
    const d = new Date(`${date}T00:00:00Z`)
    const day = d.getUTCDay()
    const diff = day === 0 ? 6 : day - 1
    d.setUTCDate(d.getUTCDate() - diff)
    return d.toISOString().substring(0, 10)
  }

  static getMonth(date: string): string {
    return date.substring(0, 7)
  }

  static getYear(date: string): string {
    return date.substring(0, 4)
  }

  static reset(): void {
    DateUtils.dateParam = null
    DateUtils.latestCommitDate = null
  }
}
