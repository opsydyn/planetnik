import { describe, expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Schema } from "effect"
import { loadPlanetnikConfig, PlanetnikConfigSchema } from "../schemas/PlanetnikConfigSchema.js"

const decode = Schema.decodeUnknownSync(PlanetnikConfigSchema)

describe("PlanetnikConfigSchema", () => {
  test("defaults mode to single_repository when empty object", () => {
    const result = decode({})
    expect(result.mode).toBe("single_repository")
  })

  test("accepts mode: landscape", () => {
    const result = decode({ mode: "landscape" })
    expect(result.mode).toBe("landscape")
  })

  test("accepts mode: single_repository", () => {
    const result = decode({ mode: "single_repository" })
    expect(result.mode).toBe("single_repository")
  })

  test("rejects invalid mode value", () => {
    expect(() => decode({ mode: "invalid" })).toThrow()
  })

  test("rejects non-object input", () => {
    expect(() => decode("string")).toThrow()
    expect(() => decode(null)).toThrow()
  })
})

describe("loadPlanetnikConfig", () => {
  const tmpDir = join(tmpdir(), `planetnik-config-test-${Date.now()}`)

  test("returns default config when file does not exist", () => {
    mkdirSync(tmpDir, { recursive: true })
    const config = loadPlanetnikConfig(tmpDir)
    expect(config.mode).toBe("single_repository")
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("loads and validates config from file", () => {
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(join(tmpDir, "planetnik.config.json"), JSON.stringify({ mode: "landscape" }))
    const config = loadPlanetnikConfig(tmpDir)
    expect(config.mode).toBe("landscape")
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("throws on invalid config file content", () => {
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(join(tmpDir, "planetnik.config.json"), JSON.stringify({ mode: "bad" }))
    expect(() => loadPlanetnikConfig(tmpDir)).toThrow()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test("loads the real planetnik.config.json from project root", () => {
    const config = loadPlanetnikConfig(join(import.meta.dir, "../../../.."))
    expect(config.mode).toBe("landscape")
  })
})
