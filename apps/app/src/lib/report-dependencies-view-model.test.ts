import { describe, expect, test } from "bun:test"
import { buildReportDependenciesViewModel } from "./report-dependencies-view-model.js"

const baseDependencies = {
  sections: [
    {
      decompositionKey: "components",
      linksCount: 2,
      incoming: [
        { label: "runtime", value: 8 },
        { label: "reports", value: 5 },
      ],
      outgoing: [
        { label: "site", value: 8 },
        { label: "runtime", value: 5 },
      ],
      links: [
        {
          fromComponent: "site",
          toComponent: "runtime",
          count: 8,
          evidenceCount: 3,
          locFrom: 1200,
        },
        {
          fromComponent: "runtime",
          toComponent: "reports",
          count: 5,
          evidenceCount: 2,
          locFrom: 900,
        },
      ],
    },
  ],
}

describe("report dependencies view model", () => {
  test("builds summary cards", () => {
    const viewModel = buildReportDependenciesViewModel({
      reportName: "Effect TS",
      dependencies: baseDependencies,
    })

    expect(viewModel.heading).toBe("Effect TS")
    expect(viewModel.subtitle).toBe("Static component dependency summary from the linked Planetnik dataset.")
    expect(viewModel.cards).toEqual([
      { label: "Decompositions", value: "1", detail: null },
      { label: "Component Links", value: "2", detail: null },
    ])
  })

  test("builds matrixData from links", () => {
    const viewModel = buildReportDependenciesViewModel({
      reportName: "Effect TS",
      dependencies: baseDependencies,
    })

    expect(viewModel.sections[0].matrixData).toEqual([
      { from: "site", to: "runtime", count: 8 },
      { from: "runtime", to: "reports", count: 5 },
    ])
  })

  test("passes inDegreeData and outDegreeData straight through", () => {
    const viewModel = buildReportDependenciesViewModel({
      reportName: "Effect TS",
      dependencies: baseDependencies,
    })

    expect(viewModel.sections[0].inDegreeData).toEqual([
      { label: "runtime", value: 8 },
      { label: "reports", value: 5 },
    ])
    expect(viewModel.sections[0].outDegreeData).toEqual([
      { label: "site", value: 8 },
      { label: "runtime", value: 5 },
    ])
  })

  test("builds gridRows with id and all link fields", () => {
    const viewModel = buildReportDependenciesViewModel({
      reportName: "Effect TS",
      dependencies: baseDependencies,
    })

    expect(viewModel.sections[0].gridRows).toEqual([
      {
        id: "components:site:runtime",
        fromComponent: "site",
        toComponent: "runtime",
        count: 8,
        evidenceCount: 3,
        locFrom: 1200,
      },
      {
        id: "components:runtime:reports",
        fromComponent: "runtime",
        toComponent: "reports",
        count: 5,
        evidenceCount: 2,
        locFrom: 900,
      },
    ])
  })

  test("sums links across all sections for the Component Links card", () => {
    const viewModel = buildReportDependenciesViewModel({
      reportName: "Effect TS",
      dependencies: {
        sections: [
          { ...baseDependencies.sections[0], linksCount: 3 },
          {
            decompositionKey: "layers",
            linksCount: 7,
            incoming: [],
            outgoing: [],
            links: [],
          },
        ],
      },
    })

    expect(viewModel.cards[1]).toEqual({ label: "Component Links", value: "10", detail: null })
  })
})
