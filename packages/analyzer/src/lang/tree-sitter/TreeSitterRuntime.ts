/// <reference path="./wasm-assets.d.ts" />
import { readFileSync } from "node:fs"
import { Language, Parser, type Tree } from "web-tree-sitter"
import webTreeSitterWasmPath from "web-tree-sitter/web-tree-sitter.wasm" with { type: "file" }

await Parser.init({
  locateFile(scriptName: string) {
    if (scriptName === "web-tree-sitter.wasm") {
      return webTreeSitterWasmPath
    }

    return scriptName
  },
})

export interface TreeSitterLanguageAdapter {
  readonly id: string
  readonly displayName: string
  readonly grammarWasmPath: string
}

export interface ParsedTreeSitterSource {
  readonly parser: Parser
  readonly tree: Tree
  readonly dispose: () => void
}

const languageCache = new Map<string, Promise<Language>>()

/**
 * Load one grammar per adapter identity. The runtime is initialised once when
 * this module is evaluated, while each source gets its own disposable parser
 * and tree. A syntax-invalid source still returns a tree and callers should
 * inspect `tree.rootNode.hasError`; a null tree is a hard parse failure and
 * throws instead of silently falling back to heuristics.
 */
export function loadTreeSitterLanguage(adapter: TreeSitterLanguageAdapter): Promise<Language> {
  const cachedLanguage = languageCache.get(adapter.id)
  if (cachedLanguage) {
    return cachedLanguage
  }

  const language = Promise.resolve()
    .then(() => Language.load(readFileSync(adapter.grammarWasmPath)))
    .catch((error: unknown) => {
      languageCache.delete(adapter.id)
      throw error
    })
  languageCache.set(adapter.id, language)
  return language
}

export function createTreeSitterParser(language: Language): Parser {
  const parser = new Parser()
  parser.setLanguage(language)
  return parser
}

export function parseTreeSitterSource(source: string, language: Language, displayName: string): ParsedTreeSitterSource {
  const parser = createTreeSitterParser(language)
  let tree: Tree | null = null

  try {
    tree = parser.parse(source)
  } catch (error) {
    parser.delete()
    throw error
  }

  if (tree === null) {
    parser.delete()
    throw new Error(`Failed to parse ${displayName} source with tree-sitter.`)
  }

  let disposed = false
  return {
    parser,
    tree,
    dispose: () => {
      if (disposed) return
      disposed = true
      tree?.delete()
      parser.delete()
    },
  }
}
