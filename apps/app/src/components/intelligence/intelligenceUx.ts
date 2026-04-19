import type { AnalysisContextProps } from "./useAnalysisContext"

function formatList(items: string[]) {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`
}

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

export function buildIntelligenceCapabilities(
  { analysisData, hotspotsData, impactData, contributorsData, controlsData, securityData }: AnalysisContextProps,
  isLandscape: boolean,
) {
  const capabilities: string[] = []

  if (analysisData) {
    capabilities.push(isLandscape ? "Landscape overview" : "Overview")
  }

  if (hotspotsData && hotspotsData.length > 0) {
    capabilities.push(isLandscape ? "Repository pressure" : "Hotspots")
  }

  if (impactData) {
    capabilities.push("Impact")
  }

  if (contributorsData && contributorsData.length > 0) {
    capabilities.push("Contributors")
  }

  if (controlsData && controlsData.length > 0) {
    capabilities.push("Controls")
  }

  if (securityData) {
    capabilities.push("Security")
  }

  return capabilities
}

export function buildIntelligenceHeaderHint(capabilities: string[]) {
  const visibleCapabilities = capabilities.slice(0, 3).map((capability) => capability.toLowerCase())

  if (visibleCapabilities.length === 0) {
    return "Grounded in live report data"
  }

  return `Grounded in ${formatList(visibleCapabilities)}`
}

export function buildIntelligencePromptPlaceholder(capabilities: string[]) {
  const visibleCapabilities = capabilities.slice(0, 3).map((capability) => capability.toLowerCase())

  if (visibleCapabilities.length === 0) {
    return "Ask about your codebase weather..."
  }

  return `Ask about ${formatList(visibleCapabilities)}, or where to look next...`
}

function buildStatusLine({ analysisData, hotspotsData, controlsData, securityData }: AnalysisContextProps) {
  const parts: string[] = []

  if (hotspotsData && hotspotsData.length > 0) {
    const topHotspot = hotspotsData[0]
    parts.push(`Current pressure peak: ${topHotspot.name} (${topHotspot.severity.toLowerCase()} severity).`)
  } else if (analysisData) {
    parts.push(`${analysisData.linesOfCode.toLocaleString()} lines of code currently under observation.`)
  }

  const failingControls = controlsData?.filter((control) => control.status !== "OK") ?? []
  if (failingControls.length > 0) {
    parts.push(`${failingControls.length} quality control${failingControls.length === 1 ? " is" : "s are"} failing.`)
  } else if (securityData && securityData.totalOpenAlerts > 0) {
    parts.push(
      `Security weather: ${securityData.totalOpenAlerts} open alerts, ${securityData.severityCounts.critical} critical.`,
    )
  }

  return parts.slice(0, 2).join(" ")
}

function buildExamplePrompts(
  { hotspotsData, impactData, contributorsData, controlsData, securityData }: AnalysisContextProps,
  isLandscape: boolean,
) {
  const prompts: string[] = []
  const navigationPrompt = isLandscape ? "Take me to the repositories page." : "Take me to hotspots."

  if (hotspotsData && hotspotsData.length > 0) {
    prompts.push(
      isLandscape
        ? "Which repository is under the most pressure right now?"
        : "Where is the worst pressure zone right now?",
    )
  }

  if (impactData) {
    prompts.push("What work would clear the skies fastest?")
  }

  if (contributorsData && contributorsData.length > 0) {
    prompts.push("Where do we have the thickest knowledge fog?")
  }

  const failingControls = controlsData?.filter((control) => control.status !== "OK") ?? []
  if (failingControls.length > 0) {
    prompts.push("Which controls are failing and why?")
  }

  if (securityData) {
    prompts.push("Show me the supply-chain storm front.")
  }

  prompts.push(navigationPrompt)

  const uniquePrompts = unique(prompts)

  if (uniquePrompts.length <= 3) {
    return uniquePrompts
  }

  if (!uniquePrompts.slice(0, 3).includes(navigationPrompt)) {
    return [...uniquePrompts.slice(0, 2), navigationPrompt]
  }

  return uniquePrompts.slice(0, 3)
}

export function buildIntelligenceWelcomeMessages(props: AnalysisContextProps, isLandscape: boolean) {
  const capabilities = buildIntelligenceCapabilities(props, isLandscape)
  const subject = props.analysisData?.name

  const intro = subject
    ? `I can read ${subject}'s structural weather through ${formatList(capabilities.map((capability) => capability.toLowerCase()))}.`
    : isLandscape
      ? "I can read the structural weather across this landscape."
      : "I can read the structural weather of this report."

  const status = buildStatusLine(props)
  const examplePrompts = buildExamplePrompts(props, isLandscape)

  return [
    intro,
    status,
    examplePrompts.length > 0 ? `Try asking: ${examplePrompts.map((prompt) => `“${prompt}”`).join(" · ")}` : null,
  ].filter((message): message is string => Boolean(message))
}
