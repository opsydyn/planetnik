import type { A2UIClientEventMessage } from "@copilotkit/a2ui-renderer"
import type { RuntimeReportGenUiBetaSurface } from "../../lib/runtime-client.js"

export interface ReportA2uiAction {
  readonly actionName: string
  readonly sourceComponentId: string
  readonly surfaceId: string
  readonly context: Record<string, unknown>
}

type ReportA2uiComponent = { id: string; component: string; [key: string]: unknown }
type ReportA2uiMessage = {
  version: "v0.9"
  createSurface?: { surfaceId: string; catalogId: string }
  updateComponents?: { surfaceId: string; components: ReportA2uiComponent[] }
  updateDataModel?: { surfaceId: string; path: string; value: Record<string, unknown> }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

// The runtime contract remains v0.8; only the renderer boundary speaks v0.9.
function convertValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convertValue)
  const record = asRecord(value)
  if (!record) return value
  for (const key of ["literalString", "literalNumber", "literalBoolean"]) {
    if (key in record) return record[key]
  }
  if ("explicitList" in record) return record.explicitList
  const template = asRecord(record.template)
  if (template) return { componentId: template.componentId, path: template.dataBinding }
  return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, convertValue(entry)]))
}

function convertComponent(entry: RuntimeReportGenUiBetaSurface["components"][number]): ReportA2uiComponent {
  const [type, value] = Object.entries(entry.component)[0] ?? []
  const originalProps = asRecord(value)
  if (!type || !originalProps) throw new Error(`Invalid report A2UI component: ${entry.id}`)
  const props = asRecord(convertValue(originalProps))!
  if (type === "Text") {
    props.variant = props.usageHint
    delete props.usageHint
  } else if (type === "TextField") {
    props.value = props.text
    props.variant = props.type
    delete props.text
    delete props.type
  } else if (type === "Slider") {
    props.min = props.minValue
    props.max = props.maxValue
    delete props.minValue
    delete props.maxValue
  } else if (type === "Tabs") {
    props.tabs = props.tabItems
    delete props.tabItems
  } else if (type === "Button") {
    const action = asRecord(originalProps.action)
    const context = Array.isArray(action?.context) ? action.context : []
    props.action = {
      event: {
        name: action?.name,
        context: Object.fromEntries(
          context.map((entry) => {
            const item = asRecord(entry)
            return [String(item?.key), convertValue(item?.value)]
          }),
        ),
      },
    }
  }
  return {
    id: entry.id,
    component: type,
    ...props,
    ...(entry.weight === undefined ? {} : { weight: entry.weight }),
  }
}

export function createReportA2uiMessages(
  surface: RuntimeReportGenUiBetaSurface,
  surfaceId: string,
): ReportA2uiMessage[] {
  const components = surface.components.map(convertComponent)
  if (surface.root !== "root") components.push({ id: "root", component: "Column", children: [surface.root] })
  return [
    {
      version: "v0.9",
      createSurface: { surfaceId, catalogId: "https://a2ui.org/specification/v0_9/basic_catalog.json" },
    },
    { version: "v0.9", updateComponents: { surfaceId, components } },
    { version: "v0.9", updateDataModel: { surfaceId, path: "/", value: surface.data } },
  ]
}

export function loadReportA2uiSurface(
  surface: RuntimeReportGenUiBetaSurface,
  surfaceId: string,
  actions: {
    readonly clearSurfaces: () => void
    readonly processMessages: (messages: Record<string, unknown>[]) => void
  },
): string | null {
  try {
    actions.clearSurfaces()
    actions.processMessages(createReportA2uiMessages(surface, surfaceId))
    return null
  } catch (error) {
    return error instanceof Error ? error.message : "Unknown surface rendering error"
  }
}

export function normalizeReportA2uiAction(message: A2UIClientEventMessage): ReportA2uiAction | null {
  const action = message.userAction
  if (!action?.name) return null
  return {
    actionName: action.name,
    sourceComponentId: action.sourceComponentId ?? "",
    surfaceId: action.surfaceId,
    context: action.context ?? {},
  }
}
