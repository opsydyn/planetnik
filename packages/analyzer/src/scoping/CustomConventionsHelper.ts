import { CustomScopingConventions } from "./CustomScopingConventions.js"
import { ScopingConventions } from "./ScopingConventions.js"

export class CustomConventionsHelper {
  static exportStandardConventions(): CustomScopingConventions {
    const conventions = new CustomScopingConventions()
    conventions.testFilesConventions = ScopingConventions.testConventions()
    conventions.generatedFilesConventions = ScopingConventions.generatedConventions()
    conventions.buildAndDeploymentFilesConventions = ScopingConventions.buildAndDeploymentConventions()
    return conventions
  }
}
