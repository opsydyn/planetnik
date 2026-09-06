import pythonGrammarWasmPath from "tree-sitter-python/tree-sitter-python.wasm" with { type: "file" }
import type { Language, Parser } from "web-tree-sitter"
import {
  createTreeSitterParser,
  loadTreeSitterLanguage,
  type ParsedTreeSitterSource,
  parseTreeSitterSource,
  type TreeSitterLanguageAdapter,
} from "../tree-sitter/TreeSitterRuntime.js"

export const PYTHON_TREE_SITTER_LANGUAGE_ADAPTER = {
  id: "python",
  displayName: "Python",
  grammarWasmPath: pythonGrammarWasmPath,
} satisfies TreeSitterLanguageAdapter

const pythonLanguage = await loadTreeSitterLanguage(PYTHON_TREE_SITTER_LANGUAGE_ADAPTER)

export type ParsedPythonSource = ParsedTreeSitterSource

export function getPythonTreeSitterLanguage(): Language {
  return pythonLanguage
}

export function createPythonTreeSitterParser(): Parser {
  return createTreeSitterParser(pythonLanguage)
}

export function parsePythonSource(source: string): ParsedPythonSource {
  return parseTreeSitterSource(source, pythonLanguage, PYTHON_TREE_SITTER_LANGUAGE_ADAPTER.displayName)
}
