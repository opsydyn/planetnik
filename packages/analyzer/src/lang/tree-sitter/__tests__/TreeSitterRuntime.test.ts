import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import rustGrammarWasmPath from "tree-sitter-rust/tree-sitter-rust.wasm" with { type: "file" }
import { loadTreeSitterLanguage, parseTreeSitterSource } from "../TreeSitterRuntime.js"

const rustAdapter = {
  id: "rust-runtime-test",
  displayName: "Rust",
  grammarWasmPath: rustGrammarWasmPath,
} as const

describe("TreeSitterRuntime", () => {
  test("reuses one loaded language for an adapter identity", async () => {
    const first = await loadTreeSitterLanguage(rustAdapter)
    const second = await loadTreeSitterLanguage(rustAdapter)

    expect(second).toBe(first)
  })

  test("returns disposable trees and preserves syntax errors as tree facts", async () => {
    const language = await loadTreeSitterLanguage(rustAdapter)
    const valid = parseTreeSitterSource("fn main() {}", language, rustAdapter.displayName)
    const invalid = parseTreeSitterSource("fn main( {}", language, rustAdapter.displayName)

    expect(valid.tree.rootNode.type).toBe("source_file")
    expect(valid.tree.rootNode.hasError).toBe(false)
    expect(invalid.tree.rootNode.hasError).toBe(true)

    valid.dispose()
    valid.dispose()
    invalid.dispose()
  })

  test("does not poison the language cache after a grammar load failure", async () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "planetnik-tree-sitter-runtime-"))
    const grammarPath = join(temporaryRoot, "grammar.wasm")
    const adapter = {
      id: `retry-${temporaryRoot}`,
      displayName: "Retry Rust",
      grammarWasmPath: grammarPath,
    } as const

    try {
      writeFileSync(grammarPath, "not a wasm grammar")
      await expect(loadTreeSitterLanguage(adapter)).rejects.toThrow()

      writeFileSync(grammarPath, readFileSync(rustGrammarWasmPath))
      const language = await loadTreeSitterLanguage(adapter)

      expect(language).toBeDefined()
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  })
})
