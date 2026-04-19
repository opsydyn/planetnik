import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { Language, Parser, type Tree } from "web-tree-sitter"

const require = createRequire(import.meta.url)
const webTreeSitterWasmPath = require.resolve("web-tree-sitter/web-tree-sitter.wasm")
const rustGrammarWasmPath = require.resolve("tree-sitter-rust/tree-sitter-rust.wasm")

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
