import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

export class LandscapeAnalysisUtils {
  static findAllLandscapeConfigFiles(root: string): string[] {
    const files: string[] = []

    const walk = (dir: string): void => {
      try {
        const entries = readdirSync(dir)
        for (const entry of entries) {
          const fullPath = join(dir, entry)
          try {
            const stat = statSync(fullPath)
            if (stat.isDirectory()) {
              walk(fullPath)
            } else if (LandscapeAnalysisUtils.isLandscapeConfigFile(fullPath)) {
              files.push(fullPath)
            }
          } catch {
            // skip inaccessible entries
          }
        }
      } catch {
        // skip inaccessible directories
      }
    }

    walk(root)

    // Sort by depth descending (deepest first)
    files.sort((a, b) => {
      const depthA = a.replace(/\\/g, "/").split("/").length
      const depthB = b.replace(/\\/g, "/").split("/").length
      return depthB - depthA
    })

    return files
  }

  static isLandscapeConfigFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, "/")
    return normalized.endsWith("_planetnik_landscape/config.json")
  }
}
