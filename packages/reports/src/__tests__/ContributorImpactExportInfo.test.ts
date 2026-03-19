import { describe, expect, test } from "bun:test"
import {
  CodeAnalysisResults,
  CodeConfiguration,
  CommitInfo,
  ComponentDependency,
  Contributor,
  FileModificationHistory,
  NamedSourceCodeAspect,
  SourceFile,
} from "@planetnik/analyzer"
import { ContributorImpactExporter } from "../exporters/ContributorImpactExportInfo.js"
import type { ImpactSourceHotspot } from "../exporters/ImpactExportInfo.js"

function createHotspot(overrides: Partial<ImpactSourceHotspot>): ImpactSourceHotspot {
  return {
    id: "file:default",
    kind: "file",
    name: "default",
    parent: "default-parent",
    route: "/files/churn",
    score: 0,
    severity: "Medium",
    size: 100,
    commitsCount: 10,
    contributorsCount: 2,
    temporalLinks: 0,
    complexity: 0,
    dimensions: {
      structuralRisk: 20,
      changePressure: 20,
      coordinationCost: 20,
      knowledgeRisk: 20,
    },
    dominantDimension: "structuralRisk",
    suggestedAction: "Review this area.",
    reasons: ["default reason"],
    ...overrides,
  }
}

describe("ContributorImpactExporter", () => {
  test("exportContributorImpact marks glue and snacking contributors from topology and touched hotspot signals", () => {
    const results = new CodeAnalysisResults()
    const config = new CodeConfiguration()
    config.srcRoot = "/repo"

    const billing = new NamedSourceCodeAspect("Billing")
    const checkout = new NamedSourceCodeAspect("Checkout")
    const docs = new NamedSourceCodeAspect("Docs")

    const orderService = new SourceFile("src/orders/OrderService.java")
    orderService.linesOfCode = 320
    orderService.logicalComponents = [billing]
    orderService.fileModificationHistory = new FileModificationHistory(orderService.relativePath)
    orderService.fileModificationHistory.commits.push(
      new CommitInfo("c1", "2026-03-10", "alice@example.com"),
      new CommitInfo("c2", "2026-03-11", "alice@example.com"),
      new CommitInfo("c3", "2026-03-11", "bob@example.com"),
    )
    orderService.fileModificationHistory.dates.push("2026-03-10", "2026-03-11", "2026-03-11")

    const checkoutFlow = new SourceFile("src/checkout/CheckoutFlow.java")
    checkoutFlow.linesOfCode = 260
    checkoutFlow.logicalComponents = [checkout]
    checkoutFlow.fileModificationHistory = new FileModificationHistory(checkoutFlow.relativePath)
    checkoutFlow.fileModificationHistory.commits.push(
      new CommitInfo("c4", "2026-03-12", "alice@example.com"),
      new CommitInfo("c5", "2026-03-12", "carol@example.com"),
    )
    checkoutFlow.fileModificationHistory.dates.push("2026-03-12", "2026-03-12")

    const docsScript = new SourceFile("src/docs/rename-labels.js")
    docsScript.linesOfCode = 24
    docsScript.logicalComponents = [docs]
    docsScript.fileModificationHistory = new FileModificationHistory(docsScript.relativePath)
    docsScript.fileModificationHistory.commits.push(
      new CommitInfo("c6", "2026-03-13", "dave@example.com"),
      new CommitInfo("c7", "2026-03-14", "dave@example.com"),
      new CommitInfo("c8", "2026-03-15", "dave@example.com"),
      new CommitInfo("c9", "2026-03-16", "dave@example.com"),
      new CommitInfo("c10", "2026-03-17", "dave@example.com"),
      new CommitInfo("c11", "2026-03-18", "dave@example.com"),
    )
    docsScript.fileModificationHistory.dates.push(
      "2026-03-13",
      "2026-03-14",
      "2026-03-15",
      "2026-03-16",
      "2026-03-17",
      "2026-03-18",
    )

    config.main.sourceFiles = [orderService, checkoutFlow, docsScript]
    results.codeConfiguration = config

    const alice = new Contributor("alice@example.com")
    alice.userName = "Alice"
    const bob = new Contributor("bob@example.com")
    bob.userName = "Bob"
    const carol = new Contributor("carol@example.com")
    carol.userName = "Carol"
    const dave = new Contributor("dave@example.com")
    dave.userName = "Dave"
    results.contributorsAnalysisResults.contributors = [alice, bob, carol, dave]

    const aliceBob = new ComponentDependency("alice@example.com", "bob@example.com")
    aliceBob.count = 3
    const aliceCarol = new ComponentDependency("alice@example.com", "carol@example.com")
    aliceCarol.count = 2
    results.contributorsAnalysisResults.peopleDependenciesAllTime = [aliceBob, aliceCarol]
    results.contributorsAnalysisResults.peopleDependencies30Days = [aliceBob, aliceCarol]

    const exported = ContributorImpactExporter.exportContributorImpact(
      results,
      {
        componentHotspots: [
          createHotspot({
            id: "component:primary:Billing",
            kind: "component",
            name: "Billing",
            parent: "primary",
            route: "/components",
            commitsCount: 10,
            contributorsCount: 2,
            temporalLinks: 8,
            complexity: 5,
            dimensions: {
              structuralRisk: 62,
              changePressure: 72,
              coordinationCost: 58,
              knowledgeRisk: 35,
            },
          }),
          createHotspot({
            id: "component:primary:Checkout",
            kind: "component",
            name: "Checkout",
            parent: "primary",
            route: "/components",
            commitsCount: 8,
            contributorsCount: 2,
            temporalLinks: 6,
            complexity: 4,
            dimensions: {
              structuralRisk: 54,
              changePressure: 68,
              coordinationCost: 52,
              knowledgeRisk: 34,
            },
          }),
          createHotspot({
            id: "component:primary:Docs",
            kind: "component",
            name: "Docs",
            parent: "primary",
            route: "/components",
            commitsCount: 6,
            contributorsCount: 1,
            temporalLinks: 0,
            complexity: 0,
            dimensions: {
              structuralRisk: 8,
              changePressure: 18,
              coordinationCost: 4,
              knowledgeRisk: 12,
            },
          }),
        ],
        fileHotspots: [
          createHotspot({
            id: `file:${orderService.relativePath}`,
            name: orderService.relativePath,
            parent: "Billing",
            route: "/files/churn",
            commitsCount: 3,
            contributorsCount: 2,
            temporalLinks: 5,
            complexity: 12,
            dimensions: {
              structuralRisk: 60,
              changePressure: 60,
              coordinationCost: 44,
              knowledgeRisk: 30,
            },
          }),
          createHotspot({
            id: `file:${checkoutFlow.relativePath}`,
            name: checkoutFlow.relativePath,
            parent: "Checkout",
            route: "/files/churn",
            commitsCount: 2,
            contributorsCount: 2,
            temporalLinks: 4,
            complexity: 10,
            dimensions: {
              structuralRisk: 56,
              changePressure: 54,
              coordinationCost: 42,
              knowledgeRisk: 28,
            },
          }),
          createHotspot({
            id: `file:${docsScript.relativePath}`,
            name: docsScript.relativePath,
            parent: "Docs",
            route: "/files/churn",
            commitsCount: 6,
            contributorsCount: 1,
            temporalLinks: 0,
            complexity: 1,
            dimensions: {
              structuralRisk: 6,
              changePressure: 20,
              coordinationCost: 3,
              knowledgeRisk: 10,
            },
          }),
        ],
        unitHotspots: [],
      },
      "2026-03-19T00:00:00.000Z",
    )

    expect(exported.periods.map((period) => period.period_key)).toEqual(["all_time", "30d", "90d", "180d", "365d"])

    const allTime = exported.periods[0]!
    const aliceImpact = allTime.contributors.find((contributor) => contributor.email === "alice@example.com")
    const daveImpact = allTime.contributors.find((contributor) => contributor.email === "dave@example.com")

    expect(aliceImpact).toBeDefined()
    expect(aliceImpact?.is_glue).toBe(true)
    expect(aliceImpact?.glue_score).toBeGreaterThan(60)
    expect(aliceImpact?.top_components.map((component) => component.name)).toEqual(["Billing", "Checkout"])
    expect(aliceImpact?.top_routes).toContain("/topology")
    expect(aliceImpact?.top_routes).toContain(`/contributors/${encodeURIComponent("alice@example.com")}`)
    expect(aliceImpact?.reasons.some((reason) => reason.includes("connects with"))).toBe(true)

    expect(daveImpact).toBeDefined()
    expect(daveImpact?.is_snacking).toBe(true)
    expect(daveImpact?.snacking_score).toBeGreaterThan(60)
    expect(daveImpact?.visible_activity_score).toBeGreaterThan(daveImpact?.structural_impact_score ?? 0)
    expect(daveImpact?.top_components.map((component) => component.name)).toEqual(["Docs"])
    expect(daveImpact?.reasons.some((reason) => reason.includes("outpaces structural leverage"))).toBe(true)
  })
})
