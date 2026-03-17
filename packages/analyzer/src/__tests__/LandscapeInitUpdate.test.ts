import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { LandscapeAnalysisInitiator } from "../landscape/LandscapeAnalysisInitiator.js"
import { LandscapeAnalysisUpdater } from "../landscape/LandscapeAnalysisUpdater.js"
import { LandscapeConfiguration } from "../landscape/LandscapeConfiguration.js"
import { LandscapeInfo } from "../landscape/LandscapeInfo.js"
import { RepositoryLink } from "../landscape/RepositoryLink.js"
import { SubLandscapeLink } from "../landscape/SubLandscapeLink.js"

const tmpRoot = join(import.meta.dir, "__tmp_landscape_init__")

beforeEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
  mkdirSync(tmpRoot, { recursive: true })
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

function createAnalysisResultFile(repoName: string): void {
  const dir = join(tmpRoot, repoName, "data")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "analysisResults.json"), "{}", "utf-8")
}

function createSubLandscapeFile(landscapeName: string): void {
  const dir = join(tmpRoot, landscapeName, "_planetnik_landscape")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "index.html"), "<html></html>", "utf-8")
}

describe("RepositoryLink", () => {
  test("extracts name from path", () => {
    const link = new RepositoryLink("myRepo/data/analysisResults.json")
    expect(link.name).toBe("myRepo")
  })

  test("computes htmlReportsRoot", () => {
    const link = new RepositoryLink("myRepo/data/analysisResults.json")
    expect(link.htmlReportsRoot).toContain("html")
  })

  test("handles empty path", () => {
    const link = new RepositoryLink()
    expect(link.analysisResultsPath).toBe("")
    expect(link.htmlReportsRoot).toBe("")
  })
})

describe("SubLandscapeLink", () => {
  test("stores name and path", () => {
    const link = new SubLandscapeLink("MyLandscape", "sub/_planetnik_landscape/index.html")
    expect(link.name).toBe("MyLandscape")
    expect(link.indexFilePath).toBe("sub/_planetnik_landscape/index.html")
    expect(link.landscapeAnalysisResults).toBeNull()
  })
})

describe("LandscapeInfo", () => {
  test("initializes with empty arrays", () => {
    const info = new LandscapeInfo()
    expect(info.subLandscapes).toEqual([])
    expect(info.repositories).toEqual([])
  })
})

describe("LandscapeAnalysisInitiator", () => {
  test("discovers analysis result files", () => {
    createAnalysisResultFile("repoA")
    createAnalysisResultFile("repoB")

    const initiator = new LandscapeAnalysisInitiator()
    const config = initiator.initConfiguration(tmpRoot, null, false)

    expect(config.repositories.length).toBe(2)
    const names = config.repositories.map((r) => r.name).sort()
    expect(names).toEqual(["repoA", "repoB"])
  })

  test("discovers sub-landscape files", () => {
    createSubLandscapeFile("teamA")
    createSubLandscapeFile("teamB")

    const initiator = new LandscapeAnalysisInitiator()
    const config = initiator.initConfiguration(tmpRoot, null, false)

    expect(config.subLandscapes.length).toBe(2)
    const names = config.subLandscapes.map((s) => s.name).sort()
    expect(names).toEqual(["teamA", "teamB"])
  })

  test("sets analysis root", () => {
    const initiator = new LandscapeAnalysisInitiator()
    const config = initiator.initConfiguration(tmpRoot, null, false)

    expect(config.analysisRoot).toBe(tmpRoot)
  })

  test("auto-generates landscape name from directory", () => {
    const initiator = new LandscapeAnalysisInitiator()
    const config = initiator.initConfiguration(tmpRoot, null, false)

    expect(config.metadata.name).toContain("Landscape")
  })

  test("saves config file when saveFile is true", () => {
    createAnalysisResultFile("repo1")

    const configPath = join(tmpRoot, "_planetnik_landscape", "config.json")
    const initiator = new LandscapeAnalysisInitiator()
    initiator.initConfiguration(tmpRoot, configPath, true)

    expect(existsSync(configPath)).toBe(true)
    const saved = JSON.parse(readFileSync(configPath, "utf-8"))
    expect(saved.repositories.length).toBe(1)
  })

  test("returns empty lists when no analysis files found", () => {
    const initiator = new LandscapeAnalysisInitiator()
    const config = initiator.initConfiguration(tmpRoot, null, false)

    expect(config.repositories.length).toBe(0)
    expect(config.subLandscapes.length).toBe(0)
  })
})

describe("LandscapeAnalysisUpdater", () => {
  test("creates new config when none exists", () => {
    createAnalysisResultFile("repo1")

    const updater = new LandscapeAnalysisUpdater()
    const config = updater.updateConfiguration(tmpRoot, null, null)

    expect(config.repositories.length).toBe(1)

    // Check that both config.json and info.json were created
    const configPath = join(tmpRoot, "_planetnik_landscape", "config.json")
    const infoPath = join(tmpRoot, "_planetnik_landscape", "info.json")
    expect(existsSync(configPath)).toBe(true)
    expect(existsSync(infoPath)).toBe(true)
  })

  test("updates existing config preserving settings", () => {
    createAnalysisResultFile("repo1")

    // Create an existing config with custom settings
    const landscapeDir = join(tmpRoot, "_planetnik_landscape")
    mkdirSync(landscapeDir, { recursive: true })
    const existingConfig = new LandscapeConfiguration()
    existingConfig.extensionThresholdLoc = 500
    existingConfig.commitsMaxYears = 5
    existingConfig.metadata.name = "My Custom Landscape"
    writeFileSync(join(landscapeDir, "config.json"), JSON.stringify(existingConfig, null, 2), "utf-8")

    // Add a second repo
    createAnalysisResultFile("repo2")

    const updater = new LandscapeAnalysisUpdater()
    const config = updater.updateConfiguration(tmpRoot, null, null)

    // Settings preserved
    expect(config.extensionThresholdLoc).toBe(500)
    expect(config.commitsMaxYears).toBe(5)
    expect(config.metadata.name).toBe("My Custom Landscape")

    // Repositories updated
    expect(config.repositories.length).toBe(2)
  })

  test("applies metadata overrides", () => {
    createAnalysisResultFile("repo1")

    const updater = new LandscapeAnalysisUpdater()
    const config = updater.updateConfiguration(tmpRoot, null, {
      name: "Overridden Name",
      description: "Custom description",
      tooltip: "",
      logoLink: "logo.png",
      links: [{ label: "Home", href: "https://example.com" }],
    })

    expect(config.metadata.name).toBe("Overridden Name")
    expect(config.metadata.description).toBe("Custom description")
    expect(config.metadata.logoLink).toBe("logo.png")
    expect(config.metadata.links).toEqual([{ label: "Home", href: "https://example.com" }])
  })

  test("writes info.json with repositories and sub-landscapes", () => {
    createAnalysisResultFile("repo1")
    createSubLandscapeFile("team1")

    const updater = new LandscapeAnalysisUpdater()
    updater.updateConfiguration(tmpRoot, null, null)

    const infoPath = join(tmpRoot, "_planetnik_landscape", "info.json")
    const info = JSON.parse(readFileSync(infoPath, "utf-8"))
    expect(info.subLandscapes.length).toBe(1)
    expect(info.repositories.length).toBe(1)
  })

  test("does not override metadata with empty values", () => {
    createAnalysisResultFile("repo1")

    // Create existing config with name
    const landscapeDir = join(tmpRoot, "_planetnik_landscape")
    mkdirSync(landscapeDir, { recursive: true })
    const existingConfig = new LandscapeConfiguration()
    existingConfig.metadata.name = "Keep This"
    existingConfig.metadata.description = "Keep Description"
    writeFileSync(join(landscapeDir, "config.json"), JSON.stringify(existingConfig, null, 2), "utf-8")

    const updater = new LandscapeAnalysisUpdater()
    const config = updater.updateConfiguration(tmpRoot, null, {
      name: "",
      description: "",
      tooltip: "",
      logoLink: "",
      links: [],
    })

    expect(config.metadata.name).toBe("Keep This")
    expect(config.metadata.description).toBe("Keep Description")
  })
})
