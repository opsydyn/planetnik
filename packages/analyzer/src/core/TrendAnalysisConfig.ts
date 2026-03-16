export class TrendAnalysisConfig {
  /** A relative folder name where analysis history snapshots are stored */
  referenceAnalysesFolder: string = "history"

  /** If true, analysis will save a new snapshot with the defined frequency */
  saveHistory: boolean = false

  /** Frequency of history saves: "daily", "weekly", or "monthly" */
  frequency: string = "weekly"

  /** Maximum number of snapshots to analyze */
  maxReferencePointsForAnalysis: number = 20

  getSnapshotFolderName(): string {
    const now = new Date()
    const year = now.getFullYear()
    const subFolder = "snapshots/"

    if (this.frequency.toLowerCase().startsWith("week")) {
      const weekNum = getISOWeek(now)
      return `${subFolder}${year}-${String(weekNum).padStart(2, "0")}`
    }
    if (this.frequency.toLowerCase().startsWith("month")) {
      const month = String(now.getMonth() + 1).padStart(2, "0")
      return `${subFolder}${year}-${month}`
    }
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${subFolder}${year}-${month}-${day}`
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
