import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CodeConfiguration, ScopeCreator } from "@planetnik/analyzer"

const TEST_DIR = join(import.meta.dir, "__test_workspace__")

beforeEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
})

describe("ScopeCreator", () => {
  test("creates config file from source directory", () => {
    // Create sample source files
    mkdirSync(join(TEST_DIR, "src"), { recursive: true })
    writeFileSync(join(TEST_DIR, "src", "App.ts"), 'export function main() { return "hello" }')
    writeFileSync(join(TEST_DIR, "src", "Utils.ts"), "export function add(a: number, b: number) { return a + b }")
    writeFileSync(join(TEST_DIR, "src", "Main.java"), "public class Main { public static void main(String[] args) {} }")

    const confFile = join(TEST_DIR, "_sokrates", "config.json")
    const creator = new ScopeCreator(TEST_DIR, confFile)
    creator.createScopeFromConventions("TestProject")

    expect(existsSync(confFile)).toBe(true)
    const config = JSON.parse(readFileSync(confFile, "utf-8"))
    expect(config.metadata.name).toBe("TestProject")
    expect(config.extensions).toContain("ts")
    expect(config.extensions).toContain("java")
    expect(config.srcRoot).toBe("..")
  })

  test("detects extensions from source files", () => {
    mkdirSync(join(TEST_DIR, "src"), { recursive: true })
    writeFileSync(join(TEST_DIR, "src", "a.py"), "print('hello')")
    writeFileSync(join(TEST_DIR, "src", "b.py"), "print('world')")
    writeFileSync(join(TEST_DIR, "src", "c.go"), "package main")

    const confFile = join(TEST_DIR, "_sokrates", "config.json")
    const creator = new ScopeCreator(TEST_DIR, confFile)
    creator.createScopeFromConventions()

    const config = JSON.parse(readFileSync(confFile, "utf-8"))
    // py has more files so should come first
    expect(config.extensions[0]).toBe("py")
    expect(config.extensions).toContain("go")
  })

  test("skips hidden directories and node_modules", () => {
    mkdirSync(join(TEST_DIR, ".git"), { recursive: true })
    mkdirSync(join(TEST_DIR, "node_modules", "pkg"), { recursive: true })
    mkdirSync(join(TEST_DIR, "src"), { recursive: true })
    writeFileSync(join(TEST_DIR, ".git", "config"), "ignored")
    writeFileSync(join(TEST_DIR, "node_modules", "pkg", "index.js"), "module.exports = {}")
    writeFileSync(join(TEST_DIR, "src", "app.js"), "const x = 1")

    const confFile = join(TEST_DIR, "_sokrates", "config.json")
    const creator = new ScopeCreator(TEST_DIR, confFile)
    creator.createScopeFromConventions()

    const config = JSON.parse(readFileSync(confFile, "utf-8"))
    expect(config.extensions).toEqual(["js"])
  })

  test("uses default name from directory when none provided", () => {
    mkdirSync(join(TEST_DIR, "src"), { recursive: true })
    writeFileSync(join(TEST_DIR, "src", "app.ts"), "export const x = 1")

    const confFile = join(TEST_DIR, "_sokrates", "config.json")
    const creator = new ScopeCreator(TEST_DIR, confFile)
    creator.createScopeFromConventions()

    const config = JSON.parse(readFileSync(confFile, "utf-8"))
    // Directory name should be capitalized
    expect(config.metadata.name.length).toBeGreaterThan(0)
  })

  test("creates logical decomposition", () => {
    mkdirSync(join(TEST_DIR, "src"), { recursive: true })
    writeFileSync(join(TEST_DIR, "src", "app.ts"), "export const x = 1")

    const confFile = join(TEST_DIR, "_sokrates", "config.json")
    const creator = new ScopeCreator(TEST_DIR, confFile)
    creator.createScopeFromConventions()

    const config = JSON.parse(readFileSync(confFile, "utf-8"))
    expect(config.logicalDecompositions.length).toBe(1)
    expect(config.logicalDecompositions[0].name).toBe("primary")
  })
})

describe("CodeConfiguration", () => {
  test("getAbsoluteSrcRoot resolves relative path", () => {
    const result = CodeConfiguration.getAbsoluteSrcRoot("..", "/Users/test/project/_sokrates/config.json")
    expect(result).toBe("/Users/test/project")
  })

  test("getAbsoluteSrcRoot returns absolute path unchanged", () => {
    const result = CodeConfiguration.getAbsoluteSrcRoot("/abs/path", "/Users/test/config.json")
    expect(result).toBe("/abs/path")
  })
})
