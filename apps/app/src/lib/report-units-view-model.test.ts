import { describe, expect, test } from "bun:test"
import { buildReportUnitsViewModel } from "./report-units-view-model.js"

describe("report units view model", () => {
  test("builds hosted unit size cards and sections", () => {
    const viewModel = buildReportUnitsViewModel({
      reportName: "Effect TS",
      slug: "effect-ts",
      units: {
        view: "size",
        headline: {
          unitCount: 3,
          totalLinesOfCode: 220,
        },
        sizeRisk: [
          { label: "Low (1-20 LOC)", value: 1 },
          { label: "Medium (21-50 LOC)", value: 1 },
          { label: "Very High (101+ LOC)", value: 1 },
        ],
        sizeDistribution: [
          { label: "1-10 LOC", value: 8, detail: "1 units" },
          { label: "21-50 LOC", value: 32, detail: "1 units" },
          { label: "101+ LOC", value: 180, detail: "1 units" },
        ],
        rows: [
          {
            shortName: "createRuntimeReport",
            relativeFileName: "src/lib/runtime-client.ts",
            linesOfCode: 180,
            mcCabeIndex: 12,
            numberOfParameters: 3,
            startLine: 120,
            endLine: 300,
          },
        ],
      },
    })

    expect(viewModel.heading).toBe("Effect TS")
    expect(viewModel.subtitle).toBe("Hosted unit-level summary from the linked Planetnik dataset.")
    expect(viewModel.activeView).toBe("size")
    expect(viewModel.cards).toEqual([
      { label: "Units", value: "3", detail: null },
      { label: "Total LOC", value: "220", detail: null },
    ])
    expect(viewModel.sections).toEqual([
      {
        title: "Size risk",
        rows: [
          { label: "Low (1-20 LOC)", value: "1 units" },
          { label: "Medium (21-50 LOC)", value: "1 units" },
          { label: "Very High (101+ LOC)", value: "1 units" },
        ],
      },
      {
        title: "Size distribution",
        rows: [
          { label: "1-10 LOC", value: "8 loc · 1 units" },
          { label: "21-50 LOC", value: "32 loc · 1 units" },
          { label: "101+ LOC", value: "180 loc · 1 units" },
        ],
      },
      {
        title: "Unit inventory",
        rows: [
          {
            label: "createRuntimeReport",
            value: "src/lib/runtime-client.ts · 180 loc · McCabe 12 · 3 params",
          },
        ],
      },
    ])
    expect(viewModel.viewLinks).toEqual([
      { label: "Size", href: "/reports/effect-ts/units/size", active: true },
      {
        label: "Complexity",
        href: "/reports/effect-ts/units/complexity",
        active: false,
      },
    ])
  })

  test("supports a custom route base for repo drilldown unit routes", () => {
    const viewModel = buildReportUnitsViewModel({
      reportName: "web-app",
      slug: "platform-landscape",
      routeBase: "/reports/platform-landscape/repositories/acme__web-app/units",
      units: {
        view: "size",
        headline: {
          unitCount: 1,
          totalLinesOfCode: 180,
        },
        sizeRisk: [{ label: "Very High (101+ LOC)", value: 1 }],
        sizeDistribution: [{ label: "101+ LOC", value: 180, detail: "1 units" }],
        rows: [
          {
            shortName: "createRuntimeReport",
            relativeFileName: "src/lib/runtime-client.ts",
            linesOfCode: 180,
            mcCabeIndex: 12,
            numberOfParameters: 3,
            startLine: 120,
            endLine: 300,
          },
        ],
      },
    })

    expect(viewModel.viewLinks).toEqual([
      {
        label: "Size",
        href: "/reports/platform-landscape/repositories/acme__web-app/units/size",
        active: true,
      },
      {
        label: "Complexity",
        href: "/reports/platform-landscape/repositories/acme__web-app/units/complexity",
        active: false,
      },
    ])
  })
})
