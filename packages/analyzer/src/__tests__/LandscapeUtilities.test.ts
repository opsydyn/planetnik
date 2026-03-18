import { describe, expect, test } from "bun:test"
import { DependenciesCreator } from "../landscape/DependenciesCreator.js"
import { FileExport } from "../landscape/FileExport.js"
import { LandscapeAnalysisUtils } from "../landscape/LandscapeAnalysisUtils.js"
import { MergeExtension } from "../landscape/MergeExtension.js"
import { RepositoryTag } from "../landscape/RepositoryTag.js"
import { TagGroup } from "../landscape/TagGroup.js"

describe("DependenciesCreator", () => {
  test("adds new dependency", () => {
    const creator = new DependenciesCreator()
    creator.add("A", "B")
    expect(creator.getDependencies()).toHaveLength(1)
    expect(creator.getDependencies()[0]!.fromComponent).toBe("A")
    expect(creator.getDependencies()[0]!.toComponent).toBe("B")
    expect(creator.getDependencies()[0]!.count).toBe(1)
  })

  test("increments existing dependency (same direction)", () => {
    const creator = new DependenciesCreator()
    creator.add("A", "B")
    creator.add("A", "B")
    expect(creator.getDependencies()).toHaveLength(1)
    expect(creator.getDependencies()[0]!.count).toBe(2)
  })

  test("increments existing dependency (reverse direction)", () => {
    const creator = new DependenciesCreator()
    creator.add("A", "B")
    creator.add("B", "A")
    expect(creator.getDependencies()).toHaveLength(1)
    expect(creator.getDependencies()[0]!.count).toBe(2)
  })

  test("tracks separate dependencies for different pairs", () => {
    const creator = new DependenciesCreator()
    creator.add("A", "B")
    creator.add("A", "C")
    creator.add("B", "C")
    expect(creator.getDependencies()).toHaveLength(3)
  })

  test("computes indirect dependencies", () => {
    const creator = new DependenciesCreator()
    // A -> X and B -> X means A and B are indirectly connected through X
    creator.add("A", "X")
    creator.add("B", "X")
    const indirect = creator.getIndirectDependencies()
    expect(indirect).toHaveLength(1)
    expect(indirect[0]!.count).toBe(1)
    // A and B are indirectly connected
    const components = [indirect[0]!.fromComponent, indirect[0]!.toComponent].sort()
    expect(components).toEqual(["A", "B"])
  })

  test("computes indirect dependencies with multiple shared targets", () => {
    const creator = new DependenciesCreator()
    creator.add("A", "X")
    creator.add("B", "X")
    creator.add("A", "Y")
    creator.add("B", "Y")
    const indirect = creator.getIndirectDependencies()
    expect(indirect).toHaveLength(1)
    // Count should be 2 since A and B share two targets (X and Y)
    expect(indirect[0]!.count).toBe(2)
  })
})

describe("FileExport", () => {
  test("has correct defaults", () => {
    const fe = new FileExport()
    expect(fe.repository).toBe("")
    expect(fe.path).toBe("")
    expect(fe.scope).toBe("")
    expect(fe.linesOfCode).toBe(0)
  })

  test("constructs with parameters", () => {
    const fe = new FileExport("my-repo", "src/index.ts", "main", 100)
    expect(fe.repository).toBe("my-repo")
    expect(fe.path).toBe("src/index.ts")
    expect(fe.scope).toBe("main")
    expect(fe.linesOfCode).toBe(100)
  })
})

describe("LandscapeAnalysisUtils", () => {
  test("identifies landscape config file", () => {
    expect(LandscapeAnalysisUtils.isLandscapeConfigFile("/root/_planetnik_landscape/config.json")).toBe(true)
    expect(LandscapeAnalysisUtils.isLandscapeConfigFile("/root/some_dir/_planetnik_landscape/config.json")).toBe(true)
    expect(LandscapeAnalysisUtils.isLandscapeConfigFile("/root/config.json")).toBe(false)
    expect(LandscapeAnalysisUtils.isLandscapeConfigFile("/root/landscape/config.json")).toBe(false)
  })

  test("normalizes windows paths", () => {
    expect(LandscapeAnalysisUtils.isLandscapeConfigFile("C:\\root\\_planetnik_landscape\\config.json")).toBe(true)
  })
})

describe("RepositoryTag", () => {
  test("matchesName with regex", () => {
    const tag = new RepositoryTag()
    tag.patterns = [".*-api"]
    expect(tag.matchesName("user-api")).toBe(true)
    expect(tag.matchesName("user-service")).toBe(false)
  })

  test("excludeName with regex", () => {
    const tag = new RepositoryTag()
    tag.excludePatterns = ["test-.*"]
    expect(tag.excludeName("test-repo")).toBe(true)
    expect(tag.excludeName("prod-repo")).toBe(false)
  })

  test("matchesMainTechnology", () => {
    const tag = new RepositoryTag()
    tag.mainExtensions = ["java", "kotlin"]
    expect(tag.matchesMainTechnology("java")).toBe(true)
    expect(tag.matchesMainTechnology("JAVA")).toBe(true)
    expect(tag.matchesMainTechnology("python")).toBe(false)
  })

  test("excludesMainTechnology", () => {
    const tag = new RepositoryTag()
    tag.excludeExtensions = ["xml"]
    expect(tag.excludesMainTechnology("xml")).toBe(true)
    expect(tag.excludesMainTechnology("java")).toBe(false)
  })

  test("matchesAnyTechnology", () => {
    const tag = new RepositoryTag()
    tag.anyExtensions = ["ts"]
    const techs = [
      { name: "*.ts", value: 1000 },
      { name: "*.js", value: 500 },
    ]
    expect(tag.matchesAnyTechnology(techs)).toBe(true)
  })

  test("matchesPath with FileExport", () => {
    const tag = new RepositoryTag()
    tag.pathPatterns = [".*Dockerfile.*"]
    const files = [new FileExport("repo", "docker/Dockerfile", "main", 10)]
    expect(tag.matchesPath(files)).toBe(true)
  })

  test("excludePath prevents match", () => {
    const tag = new RepositoryTag()
    tag.pathPatterns = [".*\\.yaml"]
    tag.excludePathPatterns = [".*test\\.yaml"]
    const files = [new FileExport("repo", "test.yaml", "main", 10)]
    expect(tag.matchesPath(files)).toBe(false)
  })

  test("getKey includes group name", () => {
    const tag = new RepositoryTag()
    tag.tag = "backend"
    const group = new TagGroup()
    group.name = "Type"
    tag.group = group
    expect(tag.getKey()).toBe("Type / backend")
  })

  test("getKey without group", () => {
    const tag = new RepositoryTag()
    tag.tag = "backend"
    expect(tag.getKey()).toBe(" / backend")
  })
})

describe("MergeExtension", () => {
  test("has correct defaults", () => {
    const me = new MergeExtension()
    expect(me.primary).toBe("")
    expect(me.secondary).toBe("")
  })
})

describe("TagGroup", () => {
  test("has correct defaults", () => {
    const tg = new TagGroup()
    expect(tg.name).toBe("")
    expect(tg.description).toBe("")
    expect(tg.color).toBe("")
    expect(tg.repositoryTags).toEqual([])
  })
})
