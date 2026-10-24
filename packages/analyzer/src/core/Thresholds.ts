import { RiskDistributionStats } from "../metrics/RiskDistributionStats.js"

export class Thresholds {
  low: number
  medium: number
  high: number
  veryHigh: number

  constructor(low: number = 200, medium: number = 500, high: number = 1000, veryHigh: number = 2000) {
    this.low = low
    this.medium = medium
    this.high = high
    this.veryHigh = veryHigh
  }

  toRiskDistribution(_key: string = ""): RiskDistributionStats {
    return new RiskDistributionStats(this.low, this.medium, this.high, this.veryHigh)
  }

  static defaultFileSizeThresholds(): Thresholds {
    return new Thresholds(200, 500, 1000, 2000)
  }

  static defaultUnitSizeThresholds(): Thresholds {
    return new Thresholds(10, 20, 50, 100)
  }

  static defaultConditionalComplexityThresholds(): Thresholds {
    return new Thresholds(5, 10, 25, 50)
  }

  static defaultFileAgeThresholds(): Thresholds {
    return new Thresholds(30, 90, 180, 365)
  }

  static defaultFileUpdateFrequencyThresholds(): Thresholds {
    return new Thresholds(5, 20, 50, 100)
  }

  static defaultFileContributorsCountThresholds(): Thresholds {
    return new Thresholds(1, 5, 10, 25)
  }
}
