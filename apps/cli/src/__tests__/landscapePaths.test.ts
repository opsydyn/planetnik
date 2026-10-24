import { describe, expect, test } from "bun:test"
import { resolveLandscapeDataDir, resolveLandscapeReportsDir } from "../commands/landscapePaths.js"

describe("landscapePaths", () => {
  test("resolves landscape reports dir under _planetnik_landscape", () => {
    expect(resolveLandscapeReportsDir("/tmp/workspace")).toBe("/tmp/workspace/_planetnik_landscape/reports")
  })

  test("resolves landscape data dir under _planetnik_landscape reports", () => {
    expect(resolveLandscapeDataDir("/tmp/workspace")).toBe("/tmp/workspace/_planetnik_landscape/reports/data")
  })
})
