import { useCopilotAction } from "@copilotkit/react-core"
import { lazy, Suspense } from "react"

const HorizontalBarChart = lazy(() => import("../charts/HorizontalBarChart"))
const DonutChart = lazy(() => import("../charts/DonutChart"))
const DistributionChart = lazy(() => import("../charts/DistributionChart"))

const chartItemAttributes = [
  { name: "label", type: "string" as const, description: "Display label for this item", required: true },
  { name: "value", type: "number" as const, description: "Numeric value for this item", required: true },
]

const distributionItemAttributes = [
  ...chartItemAttributes,
  { name: "detail", type: "string" as const, description: "Detail annotation for this item", required: true },
]

function isCompleteItem(item: Record<string, unknown>): item is { label: string; value: number } {
  return typeof item.label === "string" && typeof item.value === "number"
}

function isCompleteDistItem(item: Record<string, unknown>): item is { label: string; value: number; detail: string } {
  return typeof item.label === "string" && typeof item.value === "number" && typeof item.detail === "string"
}

export function useChartActions() {
  useCopilotAction({
    name: "renderBarChart",
    description:
      "Render a horizontal bar chart to visualize ranked data. Use when comparing items by a single numeric value, such as top hotspots by score, repositories by lines of code, or contributors by commit count.",
    parameters: [
      {
        name: "items",
        type: "object[]" as const,
        description: "Items to chart",
        attributes: chartItemAttributes,
        required: true,
      },
      {
        name: "valueLabel",
        type: "string" as const,
        description: "Label for the value axis, e.g. 'score', 'lines of code', 'commits'",
        required: false,
      },
    ],
    handler: () => {},
    render: ({ args, status }) => {
      const data = (args.items ?? []).filter(isCompleteItem)
      if (data.length === 0) {
        return <div className="copilot-chart-status">Gathering data for bar chart...</div>
      }
      return (
        <Suspense fallback={<div className="copilot-chart-status">Loading chart...</div>}>
          <div className="copilot-chart">
            <HorizontalBarChart data={data} valueLabel={args.valueLabel} />
            {status === "executing" && <div className="copilot-chart-streaming">Refining...</div>}
          </div>
        </Suspense>
      )
    },
  })

  useCopilotAction({
    name: "renderDonutChart",
    description:
      "Render a donut/pie chart to visualize proportional data. Use when showing how a whole breaks down into parts, such as severity distribution, language breakdown, or status counts.",
    parameters: [
      {
        name: "items",
        type: "object[]" as const,
        description: "Items to chart",
        attributes: chartItemAttributes,
        required: true,
      },
      {
        name: "valueLabel",
        type: "string" as const,
        description: "Label for the values, e.g. 'files', 'hotspots', 'repositories'",
        required: false,
      },
    ],
    handler: () => {},
    render: ({ args, status }) => {
      const data = (args.items ?? []).filter(isCompleteItem)
      if (data.length === 0) {
        return <div className="copilot-chart-status">Gathering data for donut chart...</div>
      }
      return (
        <Suspense fallback={<div className="copilot-chart-status">Loading chart...</div>}>
          <div className="copilot-chart">
            <DonutChart data={data} valueLabel={args.valueLabel} />
            {status === "executing" && <div className="copilot-chart-streaming">Refining...</div>}
          </div>
        </Suspense>
      )
    },
  })

  useCopilotAction({
    name: "renderDistributionChart",
    description:
      "Render a distribution chart with detail annotations. Use when each item has a primary value plus additional context, such as activity vs impact scores, or metrics with thresholds.",
    parameters: [
      {
        name: "items",
        type: "object[]" as const,
        description: "Items to chart",
        attributes: distributionItemAttributes,
        required: true,
      },
    ],
    handler: () => {},
    render: ({ args, status }) => {
      const data = (args.items ?? []).filter(isCompleteDistItem)
      if (data.length === 0) {
        return <div className="copilot-chart-status">Gathering data for distribution chart...</div>
      }
      return (
        <Suspense fallback={<div className="copilot-chart-status">Loading chart...</div>}>
          <div className="copilot-chart">
            <DistributionChart data={data} />
            {status === "executing" && <div className="copilot-chart-streaming">Refining...</div>}
          </div>
        </Suspense>
      )
    },
  })
}
