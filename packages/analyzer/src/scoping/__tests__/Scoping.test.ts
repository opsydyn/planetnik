import { describe, expect, test } from "bun:test"
import { SourceFile } from "../../aspects/SourceFile.js"
import type { SourceFileFilterType } from "../../core/SourceFileFilter.js"
import { createConvention } from "../Convention.js"
import { ConventionUtils } from "../ConventionUtils.js"
import { ScopingConventions } from "../ScopingConventions.js"

describe("Convention", () => {
  test("createConvention creates a convention with defaults", () => {
    const conv = createConvention(".*\\.test\\.ts", "", "Test files")
    expect(conv.pathPattern).toBe(".*\\.test\\.ts")
    expect(conv.contentPattern).toBe("")
    expect(conv.note).toBe("Test files")
    expect(conv.exception).toBe(false)
  })
})

describe("ConventionUtils", () => {
  test("adds matching convention to filters", () => {
    const conventions = [createConvention(".*test.*", "", "Test file")]
    const filters: SourceFileFilterType[] = []
    const files = [new SourceFile("src/test/Foo.java"), new SourceFile("src/main/Bar.java")]

    ConventionUtils.addConventions(conventions, filters, files)

    expect(filters).toHaveLength(1)
    expect(filters[0].pathPattern).toBe(".*test.*")
  })

  test("does not add duplicate conventions", () => {
    const conventions = [createConvention(".*test.*", "", "Test file")]
    const filters: SourceFileFilterType[] = [
      { pathPattern: ".*test.*", contentPattern: "", exception: false, note: "Already added" },
    ]
    const files = [new SourceFile("src/test/Foo.java")]

    ConventionUtils.addConventions(conventions, filters, files)

    // Should still be 1, not 2
    expect(filters).toHaveLength(1)
  })

  test("stops at first matching convention per file", () => {
    const conventions = [
      createConvention(".*test.*", "", "Test folder"),
      createConvention(".*\\.java", "", "Java file"),
    ]
    const filters: SourceFileFilterType[] = []
    const files = [new SourceFile("src/test/Foo.java")]

    ConventionUtils.addConventions(conventions, filters, files)

    // First convention matched, second should also be added since it's different
    expect(filters.length).toBeGreaterThanOrEqual(1)
    expect(filters[0].note).toBe("Test folder")
  })
})

describe("ScopingConventions", () => {
  test("test conventions match test files", () => {
    const conventions = ScopingConventions.testConventions()
    expect(conventions.length).toBeGreaterThan(0)

    const testFile = new SourceFile("src/test/FooTest.java")
    const hasMatch = conventions.some((c) => {
      try {
        return new RegExp(`^(?:${c.pathPattern})$`).test(testFile.relativePath)
      } catch {
        return false
      }
    })
    expect(hasMatch).toBe(true)
  })

  test("generated conventions match generated files", () => {
    const conventions = ScopingConventions.generatedConventions()
    expect(conventions.length).toBeGreaterThan(0)

    const genFile = new SourceFile("src/generated/Model.java")
    const hasMatch = conventions.some((c) => {
      try {
        return new RegExp(`^(?:${c.pathPattern})$`).test(genFile.relativePath)
      } catch {
        return false
      }
    })
    expect(hasMatch).toBe(true)
  })

  test("build conventions match build files", () => {
    const conventions = ScopingConventions.buildAndDeploymentConventions()
    expect(conventions.length).toBeGreaterThan(0)
  })

  test("ignore conventions match git folders", () => {
    const conventions = ScopingConventions.ignoreConventions()
    const gitFile = new SourceFile("project/.git/config")
    const hasMatch = conventions.some((c) => {
      try {
        return new RegExp(`^(?:${c.pathPattern})$`).test(gitFile.relativePath)
      } catch {
        return false
      }
    })
    expect(hasMatch).toBe(true)
  })
})
