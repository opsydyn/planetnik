type A2UIUsageHint = "h1" | "h2" | "h3" | "h4" | "h5" | "caption" | "body"
type A2UIValueReference = ReturnType<typeof literalString> | ReturnType<typeof path>
type A2UIActionContextValue = A2UIValueReference | { literalNumber: number } | { literalBoolean: boolean }
type A2UITextFieldType = "shortText" | "number" | "date" | "longText"

export interface ReportGenUiBetaSurfaceContract {
  readonly root: string
  readonly components: ReadonlyArray<{
    readonly id: string
    readonly component: Record<string, unknown>
    readonly weight?: number
  }>
  readonly data: Record<string, unknown>
}

export interface BuildReportGenUiBetaSurfaceInput {
  readonly reportName: string
  readonly reportMode: "single_repository" | "landscape"
  readonly betaMessage: string
  readonly readinessTitle: string
  readonly readinessDetail: string
  readonly pressureSummary: {
    readonly title: string
    readonly metric: string
    readonly details: ReadonlyArray<string>
  }
  readonly rankingTitle: string
  readonly rankingItems: ReadonlyArray<{
    readonly label: string
    readonly metric: string
    readonly routeHint: string
  }>
  readonly severityTitle: string
  readonly severityItems: ReadonlyArray<{
    readonly label: string
    readonly metric: string
  }>
  readonly distributionTitle: string
  readonly distributionItems: ReadonlyArray<{
    readonly label: string
    readonly detail: string
    readonly detailSecondary: string
  }>
  readonly navigationCards: ReadonlyArray<{
    readonly label: string
    readonly description: string
    readonly path: string
  }>
  readonly tableTitle: string
  readonly tableRows: ReadonlyArray<{
    readonly name: string
    readonly context: string
    readonly signal: string
    readonly recommendedAction: string
  }>
}

function literalString(value: string) {
  return { literalString: value }
}

function path(pathValue: string) {
  return { path: pathValue }
}

function createComponent(id: string, component: Record<string, unknown>, weight?: number) {
  return weight === undefined ? { id, component } : { id, component, weight }
}

function textComponent(id: string, text: A2UIValueReference, usageHint: A2UIUsageHint = "body", weight?: number) {
  return createComponent(id, { Text: { text, usageHint } }, weight)
}

function cardComponent(id: string, child: string, weight?: number) {
  return createComponent(id, { Card: { child } }, weight)
}

function columnComponent(id: string, children: ReadonlyArray<string>, weight?: number) {
  return createComponent(id, { Column: { children: { explicitList: [...children] } } }, weight)
}

function rowComponent(id: string, children: ReadonlyArray<string>, weight?: number) {
  return createComponent(id, { Row: { children: { explicitList: [...children] } } }, weight)
}

function listTemplateComponent(
  id: string,
  componentId: string,
  dataBinding: string,
  direction: "vertical" | "horizontal" = "vertical",
  weight?: number,
) {
  return createComponent(
    id,
    {
      List: {
        direction,
        children: {
          template: {
            componentId,
            dataBinding,
          },
        },
      },
    },
    weight,
  )
}

function tabsComponent(
  id: string,
  items: ReadonlyArray<{
    readonly title: string
    readonly child: string
  }>,
) {
  return createComponent(id, {
    Tabs: {
      tabItems: items.map((item) => ({
        title: literalString(item.title),
        child: item.child,
      })),
    },
  })
}

function buttonComponent(
  id: string,
  child: string,
  action: {
    readonly name: string
    readonly context?: ReadonlyArray<{
      readonly key: string
      readonly value: A2UIActionContextValue
    }>
  },
  weight?: number,
) {
  return createComponent(
    id,
    {
      Button: {
        child,
        action: {
          name: action.name,
          context: action.context ? [...action.context] : undefined,
        },
      },
    },
    weight,
  )
}

function textFieldComponent(id: string, label: string, textPath: string, type: A2UITextFieldType) {
  return createComponent(id, {
    TextField: {
      label: literalString(label),
      text: path(textPath),
      type,
    },
  })
}

function sliderComponent(id: string, valuePath: string, minValue: number, maxValue: number, label: string) {
  return createComponent(id, {
    Slider: {
      label: literalString(label),
      value: path(valuePath),
      minValue,
      maxValue,
    },
  })
}

function checkboxComponent(id: string, label: string, valuePath: string) {
  return createComponent(id, {
    CheckBox: {
      label: literalString(label),
      value: path(valuePath),
    },
  })
}

export function buildReportGenUiBetaSurface(input: BuildReportGenUiBetaSurfaceInput): ReportGenUiBetaSurfaceContract {
  const reportModeLabel = input.reportMode === "landscape" ? "Landscape report" : "Single repository report"

  const data = {
    intro: {
      reportLabel: `${reportModeLabel} · ${input.reportName}`,
      readinessTitle: input.readinessTitle,
      readinessDetail: input.readinessDetail,
      betaMessage: input.betaMessage,
    },
    pressureSummary: {
      title: input.pressureSummary.title,
      metric: input.pressureSummary.metric,
      details: [...input.pressureSummary.details],
    },
    titles: {
      rankingTitle: input.rankingTitle,
      severityTitle: input.severityTitle,
      distributionTitle: input.distributionTitle,
      tableTitle: input.tableTitle,
    },
    rankingItems: input.rankingItems.map((item) => ({
      label: item.label,
      metric: item.metric,
      routeHint: item.routeHint,
    })),
    severityItems: input.severityItems.map((item) => ({
      label: item.label,
      metric: item.metric,
    })),
    distributionItems: input.distributionItems.map((item) => ({
      label: item.label,
      detail: item.detail,
      detailSecondary: item.detailSecondary,
    })),
    navigationCards: input.navigationCards.map((item) => ({
      label: item.label,
      description: item.description,
      path: item.path,
    })),
    tableRows: input.tableRows.map((item) => ({
      name: item.name,
      context: item.context,
      signal: item.signal,
      recommendedAction: item.recommendedAction,
    })),
    controls: {
      analystQuestion: `What would you inspect next around ${input.pressureSummary.title}?`,
      sensitivity: 68,
      includeSecurity:
        input.reportMode === "landscape" || input.severityItems.some((item) => item.label === "Critical"),
    },
  }

  const components = [
    columnComponent("root", ["hero-card", "surface-tabs", "navigation-card", "candidate-card"]),

    cardComponent("hero-card", "hero-body"),
    columnComponent("hero-body", [
      "hero-eyebrow",
      "hero-title",
      "hero-lede",
      "hero-mode",
      "hero-readiness",
      "hero-note",
    ]),
    textComponent("hero-eyebrow", literalString("Runtime-fetched A2UI beta"), "caption"),
    textComponent("hero-title", literalString("Planetnik report vocabulary, rendered live"), "h2"),
    textComponent(
      "hero-lede",
      literalString(
        "This surface is rendered through @copilotkit/a2ui-renderer from a small runtime contract, with Planetnik-shaped data, local controls, and beta-only actions.",
      ),
      "body",
    ),
    textComponent("hero-mode", path("/intro/reportLabel"), "body"),
    textComponent("hero-readiness", path("/intro/readinessTitle"), "h4"),
    textComponent("hero-note", path("/intro/betaMessage"), "body"),

    tabsComponent("surface-tabs", [
      { title: "Pressure", child: "pressure-tab" },
      { title: "Signals", child: "signals-tab" },
      { title: "Controls", child: "controls-tab" },
    ]),

    cardComponent("pressure-tab", "pressure-tab-body"),
    columnComponent("pressure-tab-body", [
      "pressure-heading",
      "pressure-metric",
      "pressure-eyebrow",
      "pressure-detail-list",
    ]),
    textComponent("pressure-heading", path("/pressureSummary/title"), "h3"),
    textComponent("pressure-metric", path("/pressureSummary/metric"), "h5"),
    textComponent("pressure-eyebrow", literalString("Leading pressure cues"), "caption"),
    listTemplateComponent("pressure-detail-list", "pressure-detail-item", "/pressureSummary/details"),
    textComponent("pressure-detail-item", path("."), "body"),

    cardComponent("signals-tab", "signals-tab-body"),
    columnComponent("signals-tab-body", [
      "ranking-heading",
      "ranking-list",
      "severity-heading",
      "severity-list",
      "opportunity-heading",
      "opportunity-list",
    ]),
    textComponent("ranking-heading", path("/titles/rankingTitle"), "h3"),
    listTemplateComponent("ranking-list", "ranking-item-card", "/rankingItems"),
    cardComponent("ranking-item-card", "ranking-item-body"),
    columnComponent("ranking-item-body", ["ranking-item-label", "ranking-item-metric", "ranking-item-route"]),
    textComponent("ranking-item-label", path("label"), "h4"),
    textComponent("ranking-item-metric", path("metric"), "body"),
    textComponent("ranking-item-route", path("routeHint"), "caption"),
    textComponent("severity-heading", path("/titles/severityTitle"), "h3"),
    listTemplateComponent("severity-list", "severity-item-row", "/severityItems"),
    rowComponent("severity-item-row", ["severity-item-label", "severity-item-metric"]),
    textComponent("severity-item-label", path("label"), "body", 2),
    textComponent("severity-item-metric", path("metric"), "body", 1),
    textComponent("opportunity-heading", path("/titles/distributionTitle"), "h3"),
    listTemplateComponent("opportunity-list", "opportunity-item-card", "/distributionItems"),
    cardComponent("opportunity-item-card", "opportunity-item-body"),
    columnComponent("opportunity-item-body", [
      "opportunity-item-label",
      "opportunity-item-detail",
      "opportunity-item-secondary",
    ]),
    textComponent("opportunity-item-label", path("label"), "h4"),
    textComponent("opportunity-item-detail", path("detail"), "body"),
    textComponent("opportunity-item-secondary", path("detailSecondary"), "caption"),

    cardComponent("controls-tab", "controls-tab-body"),
    columnComponent("controls-tab-body", [
      "controls-heading",
      "controls-subtitle",
      "controls-question",
      "controls-slider",
      "controls-checkbox",
      "controls-preview-button",
      "controls-current-question-label",
      "controls-current-question",
      "controls-current-sensitivity-label",
      "controls-current-sensitivity",
      "controls-current-security-label",
      "controls-current-security",
    ]),
    textComponent("controls-heading", literalString("Local beta controls"), "h3"),
    textComponent(
      "controls-subtitle",
      literalString(
        "These inputs stay entirely on the client, but they prove the renderer can handle Planetnik-flavoured stateful UI while the surface contract now comes from the runtime.",
      ),
      "body",
    ),
    textFieldComponent("controls-question", "Analyst follow-up prompt", "/controls/analystQuestion", "longText"),
    sliderComponent("controls-slider", "/controls/sensitivity", 0, 100, "Sensitivity"),
    checkboxComponent("controls-checkbox", "Keep severity signal in scope", "/controls/includeSecurity"),
    buttonComponent("controls-preview-button", "controls-preview-button-text", {
      name: "stage_followup",
      context: [
        { key: "question", value: path("/controls/analystQuestion") },
        { key: "sensitivity", value: path("/controls/sensitivity") },
        { key: "includeSecurity", value: path("/controls/includeSecurity") },
      ],
    }),
    textComponent("controls-preview-button-text", literalString("Stage follow-up context"), "body"),
    textComponent("controls-current-question-label", literalString("Current prompt"), "caption"),
    textComponent("controls-current-question", path("/controls/analystQuestion"), "body"),
    textComponent("controls-current-sensitivity-label", literalString("Current sensitivity"), "caption"),
    textComponent("controls-current-sensitivity", path("/controls/sensitivity"), "body"),
    textComponent("controls-current-security-label", literalString("Security scope"), "caption"),
    textComponent("controls-current-security", path("/controls/includeSecurity"), "body"),

    cardComponent("navigation-card", "navigation-body"),
    columnComponent("navigation-body", ["navigation-heading", "navigation-lede", "navigation-list"]),
    textComponent("navigation-heading", literalString("Suggested next moves"), "h3"),
    textComponent(
      "navigation-lede",
      literalString(
        "These buttons dispatch real A2UI actions and navigate through the hosted client router so the persistent panel can survive the trip.",
      ),
      "body",
    ),
    listTemplateComponent("navigation-list", "navigation-item-card", "/navigationCards"),
    cardComponent("navigation-item-card", "navigation-item-body"),
    columnComponent("navigation-item-body", [
      "navigation-item-label",
      "navigation-item-description",
      "navigation-item-button",
    ]),
    textComponent("navigation-item-label", path("label"), "h4"),
    textComponent("navigation-item-description", path("description"), "body"),
    buttonComponent("navigation-item-button", "navigation-item-button-text", {
      name: "navigate",
      context: [
        { key: "path", value: path("path") },
        { key: "label", value: path("label") },
      ],
    }),
    textComponent("navigation-item-button-text", literalString("Open current view"), "body"),

    cardComponent("candidate-card", "candidate-body"),
    columnComponent("candidate-body", ["candidate-heading", "candidate-lede", "candidate-list"]),
    textComponent("candidate-heading", path("/titles/tableTitle"), "h3"),
    textComponent(
      "candidate-lede",
      literalString(
        "A2UI does not have to end in charts. This turns report candidates into a conversational evidence stack for the next step.",
      ),
      "body",
    ),
    listTemplateComponent("candidate-list", "candidate-item-card", "/tableRows"),
    cardComponent("candidate-item-card", "candidate-item-body"),
    columnComponent("candidate-item-body", [
      "candidate-item-name",
      "candidate-item-context",
      "candidate-item-signal",
      "candidate-item-action",
    ]),
    textComponent("candidate-item-name", path("name"), "h4"),
    textComponent("candidate-item-context", path("context"), "body"),
    textComponent("candidate-item-signal", path("signal"), "body"),
    textComponent("candidate-item-action", path("recommendedAction"), "caption"),
  ]

  return {
    root: "root",
    components,
    data,
  }
}
