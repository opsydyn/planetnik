import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { Effect } from "effect"
import { type RunAnalysisOptions, runAnalysis } from "../commands/generateReports.js"

function createWorkspace(): {
  root: string
  configPath: string
  reportsFolder: string
} {
  const root = mkdtempSync(join(tmpdir(), "planetnik-cli-generate-reports-"))
  const srcDir = join(root, "src")
  const configDir = join(root, "_planetnik")
  const reportsFolder = join(configDir, "reports")
  const configPath = join(configDir, "config.json")

  mkdirSync(srcDir, { recursive: true })
  mkdirSync(configDir, { recursive: true })

  writeFileSync(
    join(configDir, "findings.json"),
    JSON.stringify({
      items: [
        {
          id: "manual-note",
          summary: "Manual note",
          body: "OrderService needs a deeper review.",
        },
      ],
    }),
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
        findingsPath: "findings.json",
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
            dependenciesFinder: {
              useBuiltInDependencyFinders: true,
              rules: [],
              metaRules: [],
            },
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

async function runAnalysisInNode(
  configPath: string,
  reportsFolder: string,
  options?: RunAnalysisOptions,
): Promise<void> {
  await Effect.runPromise(runAnalysis(configPath, reportsFolder, options).pipe(Effect.provide(NodeServices.layer)))
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
    const impactFile = join(workspace.reportsFolder, "data", "impact.json")

    expect(existsSync(contributorFile)).toBe(true)
    expect(existsSync(findingsFile)).toBe(true)
    expect(existsSync(impactFile)).toBe(true)

    const exported = JSON.parse(readFileSync(contributorFile, "utf-8")) as {
      email: string
      files: Array<{
        relativePath: string
        commits: number
        logicalComponents: string[]
        concerns: string[]
      }>
      dailyActivity: Array<{ date: string; commits: number }>
      logicalComponents: Array<{
        name: string
        files: number
        linesOfCode: number
      }>
      concerns: Array<{ name: string; files: number; linesOfCode: number }>
      collaborators: Array<{ email: string; sharedFiles: number }>
    }

    const filesMain = JSON.parse(readFileSync(join(workspace.reportsFolder, "data", "files_main.json"), "utf-8")) as {
      files: Array<{
        relativePath: string
        components: string[]
        concerns: string[]
      }>
    }
    const findings = JSON.parse(readFileSync(findingsFile, "utf-8")) as {
      items: Array<{
        id: string
        summary: string
        bodyMarkdown: string
        bodyHtml: string
        bodyText: string
      }>
    }
    const impact = JSON.parse(readFileSync(impactFile, "utf-8")) as {
      visible_activity: {
        commits: number
        contributors: number
        changed_files: number
        changed_units: number
      }
      structural_impact: {
        summary: {
          overall_score: number
          dominant_dimension: string
        }
        dimensions: Record<string, number>
      }
      impact_dimensions: Array<{ id: string; score: number }>
      impact_opportunities: Array<{ id: string; kind: string; route: string }>
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
        id: "manual-note",
        summary: "Manual note",
        bodyMarkdown: "OrderService needs a deeper review.",
        bodyHtml: "<p>OrderService needs a deeper review.</p>",
        bodyText: "OrderService needs a deeper review.",
      },
    ])
    expect(impact.visible_activity).toEqual({
      commits: 3,
      contributors: 2,
      changed_files: 2,
      changed_units: 2,
    })
    expect(Object.keys(impact.structural_impact.dimensions)).toEqual([
      "complexity_reduction",
      "boundary_shaping",
      "knowledge_spread",
      "coordination_relief",
      "change_enablement",
    ])
    expect(impact.structural_impact.summary.overall_score).toBeGreaterThan(0)
    expect(impact.impact_dimensions.map((dimension) => dimension.id)).toEqual([
      "complexity_reduction",
      "boundary_shaping",
      "knowledge_spread",
      "coordination_relief",
      "change_enablement",
    ])
    expect(impact.impact_opportunities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "component:primary:orders",
          kind: "component",
          route: "/components",
        }),
      ]),
    )
  })

  test("runAnalysis exports Rust Tree-sitter facts through the canonical v2 contract", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)

    const rustRoot = join(workspace.root, "tokio", "src")
    mkdirSync(join(rustRoot, "sync"), { recursive: true })
    writeFileSync(
      join(rustRoot, "main.rs"),
      `use crate::sync::oneshot::Receiver;

pub fn main() {
  let _receiver: Receiver;
}
`,
    )
    writeFileSync(join(rustRoot, "lib.rs"), "pub mod sync;\n")
    writeFileSync(join(rustRoot, "sync", "oneshot.rs"), "pub struct Receiver;\n\npub fn receive() {}\n")

    const config = JSON.parse(readFileSync(workspace.configPath, "utf-8")) as {
      extensions: string[]
      main: { sourceFileFilters: Array<{ pathPattern: string }> }
    }
    config.extensions = ["rs"]
    config.main.sourceFileFilters = [{ pathPattern: "^tokio/.*\\.rs$" }]
    writeFileSync(workspace.configPath, JSON.stringify(config), "utf-8")

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder)

    const dataFolder = join(workspace.reportsFolder, "data")
    const context = JSON.parse(readFileSync(join(dataFolder, "report_context.json"), "utf-8")) as {
      dataVersion: number
      reportMode: string
      repositoryId: string
      snapshotId: string
      generatedAt: string
      capabilities: string[]
      canonicalShards: Record<string, string>
      compatibilityProjections: Record<string, string>
    }
    const units = JSON.parse(readFileSync(join(dataFolder, "units.json"), "utf-8")) as {
      totalUnitsCount: number
      units: Array<{
        shortName: string
        relativeFileName: string
        startLine: number
      }>
    }
    const dependencies = JSON.parse(readFileSync(join(dataFolder, "dependencies.json"), "utf-8")) as {
      links: Array<{
        from: { anchor: string }
        to: { anchor: string }
        fromFiles: Array<{ codeFragment: string }>
      }>
    }

    expect(context.dataVersion).toBe(2)
    expect(context.reportMode).toBe("single_repository")
    expect(context.repositoryId).toBe("repo:CLI Generate Reports Test")
    expect(context.snapshotId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
    expect(Number.isNaN(Date.parse(context.generatedAt))).toBe(false)
    expect(context.canonicalShards.summary).toBe("analysisResults.json")
    expect(context.canonicalShards.metrics).toBe("metrics.json")
    expect(context.canonicalShards.units).toBe("units.json")
    expect(context.canonicalShards.dependencies).toBe("dependencies.json")
    expect(context.compatibilityProjections).toEqual({})
    expect(context.capabilities).toContain("units")
    expect(context.capabilities).toContain("dependencies")
    expect(units.totalUnitsCount).toBe(2)
    expect(units.units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shortName: "main",
          relativeFileName: "tokio/src/main.rs",
        }),
        expect.objectContaining({
          shortName: "receive",
          relativeFileName: "tokio/src/sync/oneshot.rs",
        }),
      ]),
    )
    expect(dependencies.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: expect.objectContaining({ anchor: "tokio" }),
          to: expect.objectContaining({ anchor: "tokio::sync::oneshot" }),
          fromFiles: expect.arrayContaining([
            expect.objectContaining({
              codeFragment: expect.stringContaining("use crate::sync::oneshot::Receiver;"),
            }),
          ]),
        }),
      ]),
    )
  })

  test("runAnalysis keeps legacy TXT and HTML projections opt-in", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder)

    const dataFolder = join(workspace.reportsFolder, "data")
    const context = JSON.parse(readFileSync(join(dataFolder, "report_context.json"), "utf-8")) as {
      canonicalShards: Record<string, string>
      compatibilityProjections: Record<string, string>
    }

    expect(existsSync(join(dataFolder, "metrics.json"))).toBe(true)
    expect(existsSync(join(dataFolder, "metrics.txt"))).toBe(false)
    expect(existsSync(join(dataFolder, "files.txt"))).toBe(false)
    expect(existsSync(join(dataFolder, "controls.txt"))).toBe(false)
    expect(existsSync(join(dataFolder, "contributors.txt"))).toBe(false)
    expect(existsSync(join(dataFolder, "units.txt"))).toBe(false)
    expect(existsSync(join(workspace.reportsFolder, "html", "SourceCodeOverview.html"))).toBe(false)
    expect(existsSync(join(workspace.reportsFolder, "index.html"))).toBe(false)
    expect(context.canonicalShards.metrics).toBe("metrics.json")
    expect(context.compatibilityProjections).toEqual({})
  })

  test("runAnalysis does not use findingsHtmlPath as a findings input", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)
    rmSync(join(workspace.root, "_planetnik", "findings.json"))
    writeFileSync(
      join(workspace.root, "_planetnik", "findings.html"),
      "<finding><summary>Legacy note</summary><body>Ignored.</body></finding>",
    )
    const config = JSON.parse(readFileSync(workspace.configPath, "utf-8")) as {
      findingsPath?: string
      findingsHtmlPath?: string
    }
    delete config.findingsPath
    config.findingsHtmlPath = "findings.html"
    writeFileSync(workspace.configPath, JSON.stringify(config), "utf-8")

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder)

    const findings = JSON.parse(readFileSync(join(workspace.reportsFolder, "data", "findings.json"), "utf-8")) as {
      items: readonly unknown[]
    }

    expect(findings.items).toEqual([])
  })

  test("runAnalysis emits legacy TXT and HTML projections when opted in", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder, {
      emitLegacyProjections: true,
    })

    const dataFolder = join(workspace.reportsFolder, "data")
    const context = JSON.parse(readFileSync(join(dataFolder, "report_context.json"), "utf-8")) as {
      compatibilityProjections: Record<string, string>
    }

    expect(existsSync(join(dataFolder, "metrics.txt"))).toBe(true)
    expect(existsSync(join(workspace.reportsFolder, "html", "SourceCodeOverview.html"))).toBe(true)
    expect(existsSync(join(workspace.reportsFolder, "index.html"))).toBe(true)
    expect(context.compatibilityProjections.metrics).toBe("metrics.txt")
  })

  test("runAnalysis retains a canonical snapshot pair when retention is opted in", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder, {
      retainSnapshots: 3,
    })
    const dataFolder = join(workspace.reportsFolder, "data")
    const firstContext = JSON.parse(readFileSync(join(dataFolder, "report_context.json"), "utf-8")) as {
      snapshotId: string
    }

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder, {
      retainSnapshots: 3,
    })
    const secondContext = JSON.parse(readFileSync(join(dataFolder, "report_context.json"), "utf-8")) as {
      snapshotId: string
    }
    const manifest = JSON.parse(readFileSync(join(dataFolder, "snapshot-history.json"), "utf-8")) as {
      snapshots: Array<{ dataDir: string }>
    }

    expect(secondContext.snapshotId).not.toBe(firstContext.snapshotId)
    expect(manifest.snapshots).toHaveLength(2)
    expect(manifest.snapshots[0]?.dataDir).toBe(".")
    expect(manifest.snapshots[1]?.dataDir).toBe(`history/${firstContext.snapshotId}`)
    expect(existsSync(join(dataFolder, `history/${firstContext.snapshotId}/metrics.json`))).toBe(true)
    expect(existsSync(join(dataFolder, `history/${firstContext.snapshotId}/metrics.txt`))).toBe(false)
  })

  test("runAnalysis honours the explicit config opt-in", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)

    const config = JSON.parse(readFileSync(workspace.configPath, "utf-8")) as {
      emitLegacyProjections?: boolean
    }
    config.emitLegacyProjections = true
    writeFileSync(workspace.configPath, JSON.stringify(config), "utf-8")

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder)

    expect(existsSync(join(workspace.reportsFolder, "data", "metrics.txt"))).toBe(true)
    expect(existsSync(join(workspace.reportsFolder, "html", "SourceCodeOverview.html"))).toBe(true)
  })

  test("runAnalysis prefers canonical findings.json over legacy HTML", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)
    writeFileSync(
      join(workspace.root, "_planetnik", "findings.json"),
      JSON.stringify({
        title: "Canonical findings",
        items: [
          {
            id: "validation-gap",
            summary: "Validation gap",
            body: "**Checkout** skips validation in one path.\n\nReview the fallback.",
          },
        ],
      }),
      "utf-8",
    )

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder)

    const findings = JSON.parse(readFileSync(join(workspace.reportsFolder, "data", "findings.json"), "utf-8")) as {
      items: Array<{
        id: string
        summary: string
        bodyMarkdown: string
        bodyHtml: string
        bodyText: string
      }>
    }

    expect(findings.items).toEqual([
      {
        id: "validation-gap",
        summary: "Validation gap",
        bodyMarkdown: "**Checkout** skips validation in one path.\n\nReview the fallback.",
        bodyHtml: "<p><strong>Checkout</strong> skips validation in one path.</p><p>Review the fallback.</p>",
        bodyText: "Checkout skips validation in one path. Review the fallback.",
      },
    ])
  })

  test("runAnalysis renders canonical findings in the opt-in legacy report", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)
    writeFileSync(
      join(workspace.root, "_planetnik", "findings.json"),
      JSON.stringify({
        items: [
          {
            id: "legacy-preview",
            summary: "Legacy preview",
            body: "A **safe** compatibility preview.",
          },
        ],
      }),
      "utf-8",
    )

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder, {
      emitLegacyProjections: true,
    })

    const legacyReport = readFileSync(join(workspace.reportsFolder, "html", "Notes.html"), "utf-8")
    expect(legacyReport).toContain("Legacy preview")
    expect(legacyReport).toContain("<strong>safe</strong>")
    expect(legacyReport).not.toContain("<finding>")
  })

  test("runAnalysis resolves an explicit findingsPath relative to the config", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)
    const customFindingsPath = join(workspace.root, "notes", "review.json")
    mkdirSync(join(workspace.root, "notes"), { recursive: true })
    writeFileSync(
      customFindingsPath,
      JSON.stringify({
        items: [{ id: "custom-path", summary: "Custom path", body: "Body" }],
      }),
      "utf-8",
    )

    const config = JSON.parse(readFileSync(workspace.configPath, "utf-8")) as {
      findingsPath?: string
    }
    config.findingsPath = "../notes/review.json"
    writeFileSync(workspace.configPath, JSON.stringify(config), "utf-8")

    await runAnalysisInNode(workspace.configPath, workspace.reportsFolder)

    const findings = JSON.parse(readFileSync(join(workspace.reportsFolder, "data", "findings.json"), "utf-8")) as {
      items: Array<{ id: string }>
    }
    expect(findings.items[0]?.id).toBe("custom-path")
  })

  test("runAnalysis rejects an explicitly configured missing findings file", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)
    const config = JSON.parse(readFileSync(workspace.configPath, "utf-8")) as {
      findingsPath?: string
    }
    config.findingsPath = "missing-findings.json"
    writeFileSync(workspace.configPath, JSON.stringify(config), "utf-8")

    let failure: unknown
    try {
      await runAnalysisInNode(workspace.configPath, workspace.reportsFolder)
    } catch (error) {
      failure = error
    }

    expect(String(failure)).toContain("Findings JSON file not found")
  })

  test("runAnalysis rejects malformed canonical findings input", async () => {
    const workspace = createWorkspace()
    roots.push(workspace.root)
    writeFileSync(
      join(workspace.root, "_planetnik", "findings.json"),
      JSON.stringify({
        items: [
          { id: "duplicate", summary: "One", body: "First" },
          { id: "duplicate", summary: "Two", body: "Second" },
        ],
      }),
      "utf-8",
    )

    let failure: unknown
    try {
      await runAnalysisInNode(workspace.configPath, workspace.reportsFolder)
    } catch (error) {
      failure = error
    }

    expect(String(failure)).toContain("duplicate finding id")
    expect(String(failure)).toContain("duplicate")
  })
})
