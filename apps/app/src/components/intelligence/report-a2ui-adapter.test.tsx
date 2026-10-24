import { describe, expect, test } from "bun:test"
import { A2UIProvider, basicCatalog, useA2UIActions } from "@copilotkit/a2ui-renderer"
import { renderToStaticMarkup } from "react-dom/server"
import { buildReportGenUiBetaSurface } from "../../../../runtime/src/routes/reports/gen-ui-beta-surface.js"
import { createReportA2uiMessages, loadReportA2uiSurface, normalizeReportA2uiAction } from "./report-a2ui-adapter.js"

function Probe({ capture }: { readonly capture: (actions: ReturnType<typeof useA2UIActions>) => void }) {
  capture(useA2UIActions())
  return null
}

const fixture = () =>
  buildReportGenUiBetaSurface({
    reportName: "Example",
    reportMode: "single_repository",
    betaMessage: "Beta",
    readinessTitle: "Ready",
    readinessDetail: "Details",
    pressureSummary: { title: "Pressure", metric: "5", details: ["One"] },
    rankingTitle: "Ranking",
    rankingItems: [{ label: "Core", metric: "3", routeHint: "/core" }],
    severityTitle: "Severity",
    severityItems: [{ label: "High", metric: "1" }],
    distributionTitle: "Distribution",
    distributionItems: [{ label: "Core", detail: "First", detailSecondary: "Second" }],
    navigationCards: [{ label: "Hotspots", description: "Find pressure", path: "/hotspots" }],
    tableTitle: "Candidates",
    tableRows: [{ name: "Core", context: "App", signal: "High", recommendedAction: "Review" }],
  })

describe("report A2UI compatibility", () => {
  test("adapts the real runtime surface to the installed renderer's strict catalog", () => {
    const messages = createReportA2uiMessages(fixture(), "report-example")
    const update = messages.find((message) => "updateComponents" in message)?.updateComponents
    expect(update).toBeDefined()
    for (const component of update!.components) {
      const { id, component: type, ...props } = component
      const definition = basicCatalog.components.get(type)
      expect(definition, `${id}: ${type}`).toBeDefined()
      expect(definition!.schema.safeParse(props).success, `${id}: ${JSON.stringify(props)}`).toBe(true)
    }
    expect(update!.components.find((component) => component.id === "controls-question")).toMatchObject({
      component: "TextField",
      value: { path: "/controls/analystQuestion" },
      variant: "longText",
    })
    expect(update!.components.find((component) => component.id === "controls-preview-button")).toMatchObject({
      action: {
        event: {
          name: "stage_followup",
          context: {
            question: { path: "/controls/analystQuestion" },
            sensitivity: { path: "/controls/sensitivity" },
            includeSecurity: { path: "/controls/includeSecurity" },
          },
        },
      },
    })
  })

  test("loads adapted data and components through the real provider and forwards action events", async () => {
    const received: unknown[] = []
    let actions: ReturnType<typeof useA2UIActions> | undefined
    renderToStaticMarkup(
      <A2UIProvider
        onAction={(message) => {
          received.push(normalizeReportA2uiAction(message))
        }}
      >
        <Probe
          capture={(value) => {
            actions = value
          }}
        />
      </A2UIProvider>,
    )
    expect(loadReportA2uiSurface(fixture(), "report-example", actions!)).toBeNull()
    const surface = actions!.getSurface("report-example")
    expect(surface).toBeDefined()
    expect(surface.componentsModel.get("root").type).toBe("Column")
    expect(surface.dataModel.get("/navigationCards/0/path")).toBe("/hotspots")
    await surface.dispatchAction(
      { event: { name: "navigate", context: { path: "/hotspots" } } },
      "navigation-item-button",
    )
    expect(received).toMatchObject([
      { actionName: "navigate", sourceComponentId: "navigation-item-button", context: { path: "/hotspots" } },
    ])
    actions!.clearSurfaces()
    expect(actions!.getSurface("report-example")).toBeUndefined()
  })

  test("preserves an explicit nonstandard root without rewriting child references", () => {
    const messages = createReportA2uiMessages(
      {
        root: "custom",
        components: [{ id: "custom", component: { Text: { text: { literalString: "Hello" } } } }],
        data: {},
      },
      "custom-report",
    )
    const update = messages.find((message) => "updateComponents" in message)!.updateComponents
    expect(update!.components).toContainEqual({ id: "root", component: "Column", children: ["custom"] })
  })

  test("contains malformed surface conversion errors instead of crashing the rendering effect", () => {
    const surface = { root: "root", components: [{ id: "broken", component: {} }], data: {} }
    expect(
      loadReportA2uiSurface(surface, "example", {
        clearSurfaces: () => {},
        processMessages: () => {
          throw new Error("Unreachable processor")
        },
      }),
    ).toBe("Invalid report A2UI component: broken")
  })

  test("contains an unexpected processor failure", () => {
    expect(
      loadReportA2uiSurface(fixture(), "example", {
        clearSurfaces: () => {},
        processMessages: () => {
          throw new Error("Renderer unavailable")
        },
      }),
    ).toBe("Renderer unavailable")
  })

  test("ignores empty event envelopes and retains staged-followup context values", () => {
    expect(normalizeReportA2uiAction({})).toBeNull()
    expect(
      normalizeReportA2uiAction({
        userAction: {
          name: "stage_followup",
          surfaceId: "report",
          context: { question: "Why?", sensitivity: 60, includeSecurity: false },
        },
      }),
    ).toMatchObject({
      actionName: "stage_followup",
      context: { question: "Why?", sensitivity: 60, includeSecurity: false },
    })
  })
})
