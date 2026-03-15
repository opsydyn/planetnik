import { NamedSourceCodeAspect } from "./NamedSourceCodeAspect.js"
import type { SourceFile } from "./SourceFile.js"

export class SourceCodeAspectUtils {
  static getAspectsPerExtensions(aspect: NamedSourceCodeAspect): NamedSourceCodeAspect[] {
    const extensionMap = new Map<string, SourceFile[]>()

    for (const file of aspect.sourceFiles) {
      const ext = file.extension
      const key = `*.${ext}`
      let files = extensionMap.get(key)
      if (!files) {
        files = []
        extensionMap.set(key, files)
      }
      files.push(file)
    }

    const result: NamedSourceCodeAspect[] = []
    for (const [key, files] of extensionMap) {
      const sub = new NamedSourceCodeAspect(key)
      sub.sourceFiles = files
      result.push(sub)
    }

    return result
  }
}
