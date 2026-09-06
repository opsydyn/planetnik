import { describe, expect, test } from "bun:test"
import { parsePythonSource } from "../TreeSitterPythonParser.js"

describe("TreeSitterPythonParser", () => {
  test("parses a representative async Python module without syntax errors", () => {
    const parsed = parsePythonSource(`class Service:
    async def run(self, value: int = 1) -> int:
        return value
`)

    try {
      const root = parsed.tree.rootNode

      expect(root.type).toBe("module")
      expect(root.hasError).toBe(false)
      expect(root.namedChildren.find((child) => child.type === "class_definition")).toBeDefined()
    } finally {
      parsed.dispose()
    }
  })
})
