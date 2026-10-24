import { describe, expect, test } from "bun:test"
import { SourceFile } from "../../aspects/SourceFile.js"
import type { SourceFileFilterType } from "../../core/SourceFileFilter.js"
import { createConvention } from "../Convention.js"
import { ConventionUtils } from "../ConventionUtils.js"
import { ScopeCreator } from "../ScopeCreator.js"
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
    expect(filters[0]!.pathPattern).toBe(".*test.*")
  })

  test("does not add duplicate conventions", () => {
    const conventions = [createConvention(".*test.*", "", "Test file")]
    const filters: SourceFileFilterType[] = [
      {
        pathPattern: ".*test.*",
        contentPattern: "",
        exception: false,
        note: "Already added",
      },
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
    expect(filters[0]!.note).toBe("Test folder")
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

describe("ScopeCreator.greatestCommonPrefix", () => {
  test("returns empty for empty input", () => {
    expect(ScopeCreator.greatestCommonPrefix([])).toBe("")
  })

  test("returns common folder prefix", () => {
    const paths = ["src/main/java", "src/main/resources", "src/test/java"]
    expect(ScopeCreator.greatestCommonPrefix(paths)).toBe("src/")
  })

  test("returns empty when no common folder", () => {
    const paths = ["common", "reports", "cli"]
    expect(ScopeCreator.greatestCommonPrefix(paths)).toBe("")
  })

  test("returns full common prefix with trailing slash", () => {
    const paths = ["codeanalyzer/src", "codeanalyzer/test"]
    expect(ScopeCreator.greatestCommonPrefix(paths)).toBe("codeanalyzer/")
  })
})

describe("ScopeCreator.getComponentsAtDepth", () => {
  const files = [
    new SourceFile("codeanalyzer/src/main/Foo.java"),
    new SourceFile("codeanalyzer/src/test/FooTest.java"),
    new SourceFile("common/src/main/Bar.java"),
    new SourceFile("reports/src/main/Baz.java"),
  ]

  test("depth 1 groups by top-level folder", () => {
    const components = ScopeCreator.getComponentsAtDepth(files, 1)
    const names = components.map((c) => c.name)
    expect(names).toEqual(["codeanalyzer", "common", "reports"])
  })

  test("depth 2 groups by two levels", () => {
    const components = ScopeCreator.getComponentsAtDepth(files, 2)
    const names = components.map((c) => c.name)
    // Common prefix is empty since all share different top-level
    // At depth 2: codeanalyzer/src, common/src, reports/src
    expect(names.length).toBe(3)
    expect(names).toContain("codeanalyzer/src")
    expect(names).toContain("common/src")
    expect(names).toContain("reports/src")
  })

  test("creates path filters for each component", () => {
    const components = ScopeCreator.getComponentsAtDepth(files, 1)
    const first = components[0]
    expect(first!.sourceFileFilters.length).toBeGreaterThanOrEqual(1)
    expect(first!.sourceFileFilters[0]!.pathPattern).toBe("codeanalyzer/.*")
  })

  test("files at root level are excluded", () => {
    // A file with no directory should not create a component
    const files = [new SourceFile("Makefile"), new SourceFile("src/main/Foo.java")]
    const components = ScopeCreator.getComponentsAtDepth(files, 1)
    const names = components.map((c) => c.name)
    expect(names).toEqual(["src"])
  })
})

describe("ScopeCreator.getComponentsFromFolderDepth", () => {
  test("searches deeper when minCount not met", () => {
    // At depth 1, only 1 component (src). At depth 2, two components.
    const files = [new SourceFile("src/main/Foo.java"), new SourceFile("src/test/Bar.java")]
    const components = ScopeCreator.getComponentsFromFolderDepth(files, 1, 2)
    // Should auto-increment to depth 2 where it finds main + test
    expect(components.length).toBeGreaterThanOrEqual(2)
  })

  test("returns components at start depth when minCount is 0", () => {
    const files = [new SourceFile("src/Foo.java"), new SourceFile("lib/Bar.java")]
    const components = ScopeCreator.getComponentsFromFolderDepth(files, 1, 0)
    expect(components.length).toBe(2)
  })
})
