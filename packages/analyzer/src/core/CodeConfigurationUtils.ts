import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import type { SourceFile } from "../aspects/SourceFile.js"

export class CodeConfigurationUtils {
  static readonly DEFAULT_CONFIGURATION_FOLDER = "_sokrates"
  static readonly UNCLASSIFIED_FILES = "Unclassified"
  static readonly FILES_IN_MULTIPLE_CLASSIFICATIONS = "Multiple Classifications"

  static getDefaultSokratesFolder(srcRoot: string): string {
    return `${srcRoot}/${CodeConfigurationUtils.DEFAULT_CONFIGURATION_FOLDER}`
  }

  static getDefaultSokratesConfigFile(srcRoot: string): string {
    return `${CodeConfigurationUtils.getDefaultSokratesFolder(srcRoot)}/config.json`
  }

  static getDefaultSokratesReportsFolder(srcRoot: string): string {
    return `${CodeConfigurationUtils.getDefaultSokratesFolder(srcRoot)}/reports`
  }

  static populateUnclassifiedAndMultipleAspectsFiles(
    aspects: NamedSourceCodeAspect[],
    sourceFiles: SourceFile[],
    updateCallback: (sourceFile: SourceFile, aspect: NamedSourceCodeAspect) => void,
  ): void {
    const unclassified = new NamedSourceCodeAspect(CodeConfigurationUtils.UNCLASSIFIED_FILES)
    const multipleClassifications = new NamedSourceCodeAspect(CodeConfigurationUtils.FILES_IN_MULTIPLE_CLASSIFICATIONS)

    for (const sourceFile of sourceFiles) {
      let count = 0
      for (const aspect of aspects) {
        if (aspect.sourceFiles.includes(sourceFile)) {
          count++
        }
      }
      if (count === 0) {
        unclassified.sourceFiles.push(sourceFile)
        updateCallback(sourceFile, unclassified)
      } else if (count > 1) {
        multipleClassifications.sourceFiles.push(sourceFile)
      }
    }

    if (multipleClassifications.sourceFiles.length > 0) {
      aspects.push(multipleClassifications)
    }
    if (unclassified.sourceFiles.length > 0) {
      aspects.push(unclassified)
    }
  }

  static removeEmptyAspects(aspects: NamedSourceCodeAspect[]): void {
    const withFiles = aspects.filter((a) => a.sourceFiles.length > 0)
    aspects.length = 0
    aspects.push(...withFiles)
  }
}
