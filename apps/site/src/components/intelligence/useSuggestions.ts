import { useCopilotChatSuggestions } from "@copilotkit/react-core"
import type { AnalysisContextProps } from "./useAnalysisContext"

export function useSuggestions({
  analysisData,
  hotspotsData,
  impactData,
  contributorsData,
  controlsData,
}: AnalysisContextProps) {
  const hasHotspots = hotspotsData && hotspotsData.length > 0
  const hasImpact = impactData && impactData.opportunities.length > 0
  const hasContributors = contributorsData && contributorsData.length > 0
  const failingControls = controlsData?.filter((c) => c.status !== "OK") ?? []

  const parts: string[] = []

  if (analysisData) {
    parts.push(
      `The project is called "${analysisData.name}" with ${analysisData.linesOfCode.toLocaleString()} lines of code across ${analysisData.filesCount.toLocaleString()} files.`,
    )
  }

  if (hasHotspots) {
    const topHotspot = hotspotsData[0]
    parts.push(
      `The highest-risk hotspot is "${topHotspot.name}" (score: ${topHotspot.score}, severity: ${topHotspot.severity}).`,
    )
  }

  if (hasImpact) {
    parts.push(`The dominant impact dimension is "${impactData.dominant_dimension}".`)
  }

  if (failingControls.length > 0) {
    parts.push(`${failingControls.length} quality control(s) are currently failing.`)
  }

  if (hasContributors) {
    const active30d = contributorsData.filter((c) => c.commits30Days > 0).length
    parts.push(`${active30d} contributor(s) were active in the last 30 days.`)
  }

  const instructions = [
    "Suggest 2-3 follow-up questions the user might ask about their codebase analysis.",
    "Questions should be specific to the data available, not generic.",
    "Use the Płanetnik weather metaphor style (pressure zones, fog, turbulence).",
    parts.length > 0 ? `Context: ${parts.join(" ")}` : "",
  ]
    .filter(Boolean)
    .join(" ")

  useCopilotChatSuggestions(
    {
      instructions,
      minSuggestions: 2,
      maxSuggestions: 3,
      available: "always",
    },
    [analysisData, hotspotsData, impactData, contributorsData, controlsData],
  )
}
