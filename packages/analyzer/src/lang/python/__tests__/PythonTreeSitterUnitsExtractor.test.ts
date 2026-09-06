import { describe, expect, test } from "bun:test"
import { SourceFile } from "../../../aspects/SourceFile.js"
import { PythonAnalyzer } from "../../PythonAnalyzer.js"

describe("PythonAnalyzer Tree-sitter unit extraction", () => {
  test("extracts functions, classes, methods, parameters, ranges, and complexity", () => {
    const source = `async def fetch(client, url):
    if url:
        return await client.get(url)
    return None

class Service:
    def run(
        self,
        values,
        limit=3,
    ):
        for value in values:
            if value > limit and limit > 0:
                print(value)

def helper(value):
    return value
`
    const sourceFile = new SourceFile("src/service.py", source)
    const units = new PythonAnalyzer().extractUnits(sourceFile)

    expect(units.map((unit) => unit.shortName)).toEqual(["fetch", "Service", "Service::run", "helper"])

    expect(units[0]?.startLine).toBe(0)
    expect(units[0]?.endLine).toBe(3)
    expect(units[0]?.numberOfParameters).toBe(2)
    expect(units[0]?.mcCabeIndex).toBe(2)

    expect(units[1]?.numberOfParameters).toBe(0)
    expect(units[1]?.mcCabeIndex).toBe(1)

    expect(units[2]?.startLine).toBe(6)
    expect(units[2]?.endLine).toBe(13)
    expect(units[2]?.numberOfParameters).toBe(3)
    expect(units[2]?.mcCabeIndex).toBe(4)
    expect(units[2]?.longName).toContain("def run(")
  })
})
