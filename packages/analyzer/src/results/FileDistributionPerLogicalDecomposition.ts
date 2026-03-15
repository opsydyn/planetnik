import type { RiskDistributionStats } from "../metrics/RiskDistributionStats.js"

export class FileDistributionPerLogicalDecomposition {
  name: string = ""
  fileSizeDistributionPerComponent: RiskDistributionStats[] = []
}
