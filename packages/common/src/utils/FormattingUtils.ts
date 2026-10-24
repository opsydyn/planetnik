export class FormattingUtils {
  static getFormattedPercentage(value: number, zeroText?: string): string {
    if (value === 0) return zeroText ?? "0%"
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value)
    return `${formatted}%`
  }

  static getFormattedRemainderPercentage(value: number): string {
    return FormattingUtils.getFormattedPercentage(100 - value)
  }

  static formatCount(value: number, zeroText?: string): string {
    if (value === 0 && zeroText !== undefined) return zeroText
    return new Intl.NumberFormat("en-US").format(value)
  }

  static formatCountPlural(count: number, singular: string, plural: string): string {
    const formatted = FormattingUtils.formatCount(count)
    return `${formatted} ${count === 1 ? singular : plural}`
  }

  static getSmallTextForNumberMinK(value: number): string {
    if (value < 1000) return "<1K"
    return `${Math.round(value / 1000)}K`
  }

  static getSmallTextForNumber(value: number): string {
    if (value < 1000) return `<b>${value}</b>`
    const k = value / 1000
    return `<b>${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K</b>`
  }

  static getPlainTextForNumber(value: number): string {
    if (value < 1000) return `${value}`
    const k = value / 1000
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`
  }

  static formatPeriod(days: number): string {
    if (days <= 0) return ""
    const years = Math.floor(days / 365)
    const months = Math.floor((days % 365) / 30)
    const parts: string[] = []
    if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`)
    if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`)
    return parts.join(", ")
  }
}
