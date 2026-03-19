import { describe, expect, test } from "bun:test"
import { buildBalancedCouplingModel } from "../coupling/balancedCouplingModel"

describe("buildBalancedCouplingModel", () => {
  test("combines static, temporal, coordination, and knowledge signals for primary components", () => {
    const model = buildBalancedCouplingModel({
      decompositionKey: "primary",
      files: [
        {
          relativePath: "src/billing/InvoiceService.java",
          linesOfCode: 220,
          components: ["Billing"],
          contributors: ["alice@example.com"],
        },
        {
          relativePath: "src/billing/InvoicePolicy.java",
          linesOfCode: 120,
          components: ["Billing"],
          contributors: ["alice@example.com", "bob@example.com"],
        },
        {
          relativePath: "src/orders/OrderService.java",
          linesOfCode: 180,
          components: ["Orders"],
          contributors: ["bob@example.com", "carol@example.com"],
        },
        {
          relativePath: "src/shared/Money.java",
          linesOfCode: 80,
          components: ["Shared"],
          contributors: ["alice@example.com", "bob@example.com", "carol@example.com"],
        },
      ],
      dependencies: [
        { decompositionKey: "primary", fromComponent: "Billing", toComponent: "Orders", count: 3 },
        { decompositionKey: "primary", fromComponent: "Orders", toComponent: "Shared", count: 2 },
        { decompositionKey: "secondary", fromComponent: "Ignored", toComponent: "IgnoredToo", count: 99 },
      ],
      temporalDependencies: [
        { file1: "src/billing/InvoiceService.java", file2: "src/orders/OrderService.java", sameCommits: 6 },
        { file1: "src/orders/OrderService.java", file2: "src/shared/Money.java", sameCommits: 3 },
      ],
      hotspots: [
        {
          kind: "component",
          name: "Billing",
          parent: "primary",
          score: 78,
          dimensions: {
            structuralRisk: 72,
            changePressure: 64,
            coordinationCost: 68,
            knowledgeRisk: 88,
          },
          reasons: ["single-contributor component knowledge", "high dependency centrality"],
        },
        {
          kind: "component",
          name: "Orders",
          parent: "primary",
          score: 52,
          dimensions: {
            structuralRisk: 40,
            changePressure: 55,
            coordinationCost: 58,
            knowledgeRisk: 45,
          },
          reasons: ["strong co-change pressure"],
        },
      ],
    })

    expect(model.decompositionKey).toBe("primary")
    expect(model.snapshots).toHaveLength(3)
    expect(model.aggregate.totalComponents).toBe(3)
    expect(model.aggregate.topRiskComponent).toBe("Orders")

    const billing = model.snapshots.find((snapshot) => snapshot.component === "Billing")
    expect(billing).toBeDefined()
    expect(billing?.staticCoupling).toBeGreaterThan(0)
    expect(billing?.temporalCoupling).toBeGreaterThan(0)
    expect(billing?.knowledgeRisk).toBeGreaterThan(billing?.coordinationCoupling ?? 0)
    expect(billing?.riskTier).toMatch(/Medium|High|Critical/)
    expect(billing?.explainability).toContain("single-contributor component knowledge")

    const orders = model.snapshots.find((snapshot) => snapshot.component === "Orders")
    expect(orders?.systemicRisk).toBeGreaterThan(billing?.systemicRisk ?? 0)
    expect(orders?.temporalPartners).toBeGreaterThan(0)
    expect(orders?.contributorOverlap).toBeGreaterThan(0)

    expect(model.aggregate.dimensionMix).toHaveLength(4)
    expect(model.aggregate.dominantDimensionBreakdown.length).toBeGreaterThan(0)
  })
})
