/// <reference path="./wasm-assets.d.ts" />
import { readFileSync } from "node:fs"
import rustGrammarWasmPath from "tree-sitter-rust/tree-sitter-rust.wasm" with { type: "file" }
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

const rustLanguage = await Language.load(readFileSync(rustGrammarWasmPath))

export interface ParsedRustSource {
  readonly parser: Parser
  readonly tree: Tree
  readonly dispose: () => void
}

export function getRustTreeSitterLanguage(): Language {
  return rustLanguage
}

export function createRustTreeSitterParser(): Parser {
  const parser = new Parser()
  parser.setLanguage(rustLanguage)
  return parser
}

export function parseRustSource(source: string): ParsedRustSource {
  const parser = createRustTreeSitterParser()
  const tree = parser.parse(source)

  if (tree === null) {
    parser.delete()
    throw new Error("Failed to parse Rust source with tree-sitter.")
  }

  return {
    parser,
    tree,
    dispose: () => {
      tree.delete()
      parser.delete()
    },
  }
}
