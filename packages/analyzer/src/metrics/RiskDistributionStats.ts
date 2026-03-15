export class RiskDistributionStats {
  key: string = ""
  lowRiskThreshold: number = 0
  mediumRiskThreshold: number = 0
  highRiskThreshold: number = 0
  veryHighRiskThreshold: number = 0

  negligibleRiskValue: number = 0
  lowRiskValue: number = 0
  mediumRiskValue: number = 0
  highRiskValue: number = 0
  veryHighRiskValue: number = 0

  negligibleRiskCount: number = 0
  lowRiskCount: number = 0
  mediumRiskCount: number = 0
  highRiskCount: number = 0
  veryHighRiskCount: number = 0

  negligibleRiskLabel: string = ""
  lowRiskLabel: string = ""
  mediumRiskLabel: string = ""
  highRiskLabel: string = ""
  veryHighRiskLabel: string = ""

  valueUnit: string = "LOC"
  countUnit: string = "files"

  constructor(key?: string)
  constructor(low: number, medium: number, high: number, veryHigh: number)
  constructor(keyOrLow?: string | number, medium?: number, high?: number, veryHigh?: number) {
    if (typeof keyOrLow === "string") {
      this.key = keyOrLow
    } else if (typeof keyOrLow === "number" && medium !== undefined && high !== undefined && veryHigh !== undefined) {
      this.lowRiskThreshold = keyOrLow
      this.mediumRiskThreshold = medium
      this.highRiskThreshold = high
      this.veryHighRiskThreshold = veryHigh
      this.setLabels()
    }
  }

  private setLabels(): void {
    this.negligibleRiskLabel = `0-${this.lowRiskThreshold}`
    this.lowRiskLabel = `${this.lowRiskThreshold + 1}-${this.mediumRiskThreshold}`
    this.mediumRiskLabel = `${this.mediumRiskThreshold + 1}-${this.highRiskThreshold}`
    this.highRiskLabel = `${this.highRiskThreshold + 1}-${this.veryHighRiskThreshold}`
    this.veryHighRiskLabel = `${this.veryHighRiskThreshold + 1}+`
  }

  reset(): void {
    this.negligibleRiskValue = 0
    this.lowRiskValue = 0
    this.mediumRiskValue = 0
    this.highRiskValue = 0
    this.veryHighRiskValue = 0
    this.negligibleRiskCount = 0
    this.lowRiskCount = 0
    this.mediumRiskCount = 0
    this.highRiskCount = 0
    this.veryHighRiskCount = 0
  }

  update(testValue: number, addValue: number): void {
    if (testValue <= this.lowRiskThreshold) {
      this.negligibleRiskValue += addValue
      this.negligibleRiskCount++
    } else if (testValue <= this.mediumRiskThreshold) {
      this.lowRiskValue += addValue
      this.lowRiskCount++
    } else if (testValue <= this.highRiskThreshold) {
      this.mediumRiskValue += addValue
      this.mediumRiskCount++
    } else if (testValue <= this.veryHighRiskThreshold) {
      this.highRiskValue += addValue
      this.highRiskCount++
    } else {
      this.veryHighRiskValue += addValue
      this.veryHighRiskCount++
    }
  }

  getTotalValue(): number {
    return this.negligibleRiskValue + this.lowRiskValue + this.mediumRiskValue + this.highRiskValue + this.veryHighRiskValue
  }

  getTotalCount(): number {
    return this.negligibleRiskCount + this.lowRiskCount + this.mediumRiskCount + this.highRiskCount + this.veryHighRiskCount
  }

  private getPercentage(value: number): number {
    const total = this.getTotalValue()
    return total > 0 ? (100.0 * value) / total : 0
  }

  getVeryHighRiskPercentage(): number { return this.getPercentage(this.veryHighRiskValue) }
  getHighRiskPercentage(): number { return this.getPercentage(this.highRiskValue) }
  getMediumRiskPercentage(): number { return this.getPercentage(this.mediumRiskValue) }
  getLowRiskPercentage(): number { return this.getPercentage(this.lowRiskValue) }
  getNegligibleRiskPercentage(): number { return this.getPercentage(this.negligibleRiskValue) }
}
