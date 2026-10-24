import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { LandscapeConfiguration, type RepositoryAnalysisResult, RepositoryTag, TagGroup } from "@planetnik/analyzer"
import { buildLandscapeTagMap } from "../commands/landscapeTagMap.js"

function makeRepository(name: string): RepositoryAnalysisResult {
  return {
    name,
    analysisResultsPath: `${name}/data/analysisResults.json`,
    metadata: { name, description: "", tooltip: "", logoLink: "", links: [] },
    mainLoc: 1200,
    mainFilesCount: 12,
    testLoc: 100,
    testFilesCount: 1,
    generatedLoc: 0,
    buildAndDeployLoc: 0,
    otherLoc: 0,
    extensions: ["ts"],
    linesOfCodePerExtension: [{ extension: "ts", linesOfCode: 1200 }],
    contributors: [],
    firstCommitDate: "2024-01-01",
    latestCommitDate: "2024-07-01",
    duplicationPercentage: 0,
  }
}

describe("buildLandscapeTagMap", () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots.splice(0)) {
      if (existsSync(root)) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  test("builds tags from repository file exports and configured tag groups", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-landscape-tag-map-"))
    roots.push(root)

    const repository = makeRepository("agent-sdk")
    const repositoryDir = join(root, "agent-sdk", "data")
    mkdirSync(repositoryDir, { recursive: true })
    writeFileSync(join(repositoryDir, "analysisResults.json"), "{}", "utf-8")
    writeFileSync(
      join(repositoryDir, "files_main.json"),
      JSON.stringify({
        files: [{ relativePath: "src/openapi/client.ts", linesOfCode: 300 }],
      }),
      "utf-8",
    )

    const config = new LandscapeConfiguration()
    config.analysisRoot = root
    const group = new TagGroup()
    group.name = "Domain"
    const tag = new RepositoryTag()
    tag.tag = "SDK"
    tag.patterns = [".*-sdk"]
    tag.pathPatterns = ["src/openapi/.*"]
    tag.group = group
    group.repositoryTags = [tag]
    config.tagGroups = [group]

    const tagMap = buildLandscapeTagMap(config, [repository], root)

    expect(tagMap.tagsCount()).toBe(1)
    expect(tagMap.getTagStats("Domain / SDK")?.repositoryAnalysisResults).toHaveLength(1)
    expect(tagMap.getRepositoryTags(repository).map((entry) => entry.tag)).toEqual(["SDK"])
  })
})
