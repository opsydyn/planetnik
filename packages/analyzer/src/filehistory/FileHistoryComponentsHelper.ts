import type { FileModificationHistory } from "./FileModificationHistory.js"

export class FileHistoryComponentsHelper {
  getNumberOfActiveDays(fileModificationHistories: FileModificationHistory[]): number {
    return this.getUniqueDates(fileModificationHistories).length
  }

  getUniqueDates(fileModificationHistories: FileModificationHistory[]): string[] {
    const dateStrings: string[] = []

    for (const history of fileModificationHistories) {
      for (const date of history.dates) {
        if (date.length >= 10) {
          const dateOnly = date.substring(0, 10)
          if (!dateStrings.includes(dateOnly)) {
            dateStrings.push(dateOnly)
          }
        }
      }
    }

    dateStrings.sort()
    return dateStrings
  }
}
