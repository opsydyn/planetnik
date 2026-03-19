import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NodeContext } from "@effect/platform-node"
import { Effect } from "effect"
import { runAnalysis } from "../commands/generateReports.js"

function createWorkspace(): { root: string; configPath: string; reportsFolder: string } {
  const root = mkdtempSync(join(tmpdir(), "planetnik-cli-generate-reports-"))
  const srcDir = join(root, "src")
  const configDir = join(root, "_planetnik")
  const reportsFolder = join(configDir, "reports")
  const configPath = join(configDir, "config.json")

  mkdirSync(srcDir, { recursive: true })
  mkdirSync(configDir, { recursive: true })

  writeFileSync(
    join(configDir, "findings.html"),
    `<finding><summary>Manual note</summary><body><p>OrderService needs a deeper review.</p></body></finding>`,
  )

  writeFileSync(
    join(srcDir, "OrderService.java"),
    `package demo;

public class OrderService {
  public int total(int a, int b) {
    return a + b;
  }
}
`,
  )

  writeFileSync(
    join(srcDir, "cart.js"),
    `export function addToCart(items, item) {
  return [...items, item]
}
`,
  )

  writeFileSync(
    join(root, "git-history.txt"),
    `2025-01-10 alice@example.com c1 src/OrderService.java
2025-01-12 alice@example.com c2 src/OrderService.java
2025-01-12 alice@example.com c2 src/cart.js
2025-01-14 bob@example.com c3 src/OrderService.java
`,
  )

  writeFileSync(
    configPath,
    JSON.stringify(
      {
        metadata: {
          name: "CLI Generate Reports Test",
          description: "",
          tooltip: "",
          logoLink: "",
          links: [],
        },
        findingsHtmlPath: "findings.html",
        srcRoot: "..",
        extensions: ["java", "js"],
        main: {
          name: "main",
          sourceFileFilters: [{ pathPattern: ".*" }],
          files: [],
        },
        logicalDecompositions: [
          {
            name: "primary",
            scope: "main",
            filters: [],
            componentsFolderDepth: 1,
            minComponentsCount: 0,
            components: [
              {
                name: "orders",
                sourceFileFilters: [{ pathPattern: "src/OrderService\\.java" }],
                files: [],
              },
              {
                name: "cart",
                sourceFileFilters: [{ pathPattern: "src/cart\\.js" }],
                files: [],
              },
            ],
            includeRemainingFiles: true,
            includeExternalComponents: true,
            dependenciesFinder: { useBuiltInDependencyFinders: true, rules: [], metaRules: [] },
            dependencyLinkThreshold: 1,
            duplicationLinkThreshold: 50,
            temporalLinkThreshold: 1,
            maxSearchDepthLines: 200,
          },
        ],
        concernGroups: [
          {
            name: "general",
            concerns: [
              {
                name: "Business Logic",
                sourceFileFilters: [{ contentPattern: "return .*" }],
              },
            ],
            metaConcerns: [],
          },
        ],
      },
      null,
      2,
    ),
    "utf-8",
  )

  return { root, configPath, reportsFolder }
}

async function runAnalysisInNode(configPath: string, reportsFolder: string): Promise<void> {
  await Effect.runPromise(runAnalysis(configPath, reportsFolder).pipe(Effect.provide(NodeContext.layer)))
}

describe("generateReports CLI contract", () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots.splice(0)) {
      if (existsSync(root)) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  test("runAnalysis exports contributor detail data and findings", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder)

    const contributorFile = join(
      workspace.reportsFolder,
      "data",
      "contributor_details",
      `${encodeURIComponent("alice@example.com")}.json`,
    )
    const findingsFile = join(workspace.reportsFolder, "data", "findings.json")

    expect(existsSync(contributorFile)).toBe(true)
    expect(existsSync(findingsFile)).toBe(true)

    const exported = JSON.parse(readFileSync(contributorFile, "utf-8")) as {
      email: string
      files: Array<{ relativePath: string; commits: number; logicalComponents: string[]; concerns: string[] }>
      dailyActivity: Array<{ date: string; commits: number }>
      logicalComponents: Array<{ name: string; files: number; linesOfCode: number }>
      concerns: Array<{ name: string; files: number; linesOfCode: number }>
      collaborators: Array<{ email: string; sharedFiles: number }>
    }

    const filesMain = JSON.parse(readFileSync(join(workspace.reportsFolder, "data", "files_main.json"), "utf-8")) as {
      files: Array<{ relativePath: string; components: string[]; concerns: string[] }>
    }
    const findings = JSON.parse(readFileSync(findingsFile, "utf-8")) as {
      items: Array<{ summary: string; bodyText: string }>
    }

    expect(exported.email).toBe("alice@example.com")
    expect(exported.dailyActivity).toEqual([
      { date: "2025-01-10", commits: 1 },
      { date: "2025-01-12", commits: 1 },
    ])
    expect(filesMain.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "src/OrderService.java",
          components: ["orders"],
          concerns: ["Business Logic"],
        }),
        expect.objectContaining({
          relativePath: "src/cart.js",
          components: ["cart"],
          concerns: ["Business Logic"],
        }),
      ]),
    )
    expect(exported.files).toHaveLength(2)
    expect(exported.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "src/OrderService.java",
          commits: 2,
          logicalComponents: ["orders"],
          concerns: ["Business Logic"],
        }),
        expect.objectContaining({
          relativePath: "src/cart.js",
          commits: 1,
          logicalComponents: ["cart"],
          concerns: ["Business Logic"],
        }),
      ]),
    )
    expect(exported.logicalComponents).toEqual([
      { name: "cart", files: 1, linesOfCode: 3 },
      { name: "orders", files: 1, linesOfCode: 6 },
    ])
    expect(exported.concerns).toEqual([{ name: "Business Logic", files: 2, linesOfCode: 9 }])
    expect(exported.collaborators).toEqual([{ email: "bob@example.com", sharedFiles: 1 }])
    expect(findings.items).toEqual([
      {
        id: "finding-1",
        summary: "Manual note",
        bodyHtml: "<p>OrderService needs a deeper review.</p>",
        bodyText: "OrderService needs a deeper review.",
      },
    ])
  })
})
