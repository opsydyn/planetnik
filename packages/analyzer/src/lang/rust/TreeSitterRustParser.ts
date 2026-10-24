import rustGrammarWasmPath from "tree-sitter-rust/tree-sitter-rust.wasm" with { type: "file" }
import {
  loadTreeSitterLanguage,
  type ParsedTreeSitterSource,
  parseTreeSitterSource,
  type TreeSitterLanguageAdapter,
} from "../tree-sitter/TreeSitterRuntime.js"

const RUST_TREE_SITTER_LANGUAGE_ADAPTER = {
  id: "rust",
  displayName: "Rust",
  grammarWasmPath: rustGrammarWasmPath,
} satisfies TreeSitterLanguageAdapter

const rustLanguage = await loadTreeSitterLanguage(RUST_TREE_SITTER_LANGUAGE_ADAPTER)

export type ParsedRustSource = ParsedTreeSitterSource

export function parseRustSource(source: string): ParsedRustSource {
  return parseTreeSitterSource(source, rustLanguage, RUST_TREE_SITTER_LANGUAGE_ADAPTER.displayName)
}
