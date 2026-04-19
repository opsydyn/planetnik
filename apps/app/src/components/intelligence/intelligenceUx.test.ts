import { describe, expect, test } from "bun:test"
import {
  buildIntelligenceCapabilities,
  buildIntelligenceHeaderHint,
  buildIntelligencePromptPlaceholder,
  buildIntelligenceWelcomeMessages,
} from "./intelligenceUx"
import type { AnalysisContextProps } from "./useAnalysisContext"

const baseContext: AnalysisContextProps = {
  analysisData: {
    name: "Stormwatch",
    description: "Single repo analysis",
    filesCount: 120,
    linesOfCode: 42137,
  },
  hotspotsData: [
    {
      name: "src/pressure-zone.ts",
      kind: "file",
      score: 92,
      severity: "High",
      dominantDimension: "structuralRisk",
      suggestedAction: "Break this file apart",
      reasons: ["Large file", "High churn"],
    },
  ],
  impactData: {
    overall_score: 0.74,
    dominant_dimension: "change_enablement",
    dimensions: {
      change_enablement: 0.74,
    },
    opportunities: [
      {
        name: "src/pressure-zone.ts",
        kind: "file",
        impact_score: 0.88,
        dominant_dimension: "change_enablement",
        suggested_action: "Untangle boundaries",
      },
    ],
  },
  contributorsData: [
    {
      email: "alan@example.com",
      commitsAllTime: 240,
      commits30Days: 18,
      commits90Days: 44,
    },
  ],
  controlsData: [
    {
      goal: "Keep complexity down",
      metricId: "complexity",
      metricValue: 18,
      desiredRange: "< 10",
      status: "WARN",
    },
  ],
  securityData: {
    totalAlerts: 8,
    totalOpenAlerts: 3,
    reposWithAlerts: 1,
    totalRepos: 1,
    severityCounts: {
      critical: 1,
      high: 1,
      medium: 1,
      low: 0,
    },
    meanTimeToResolveDays: 7,
    supplyChainExposureScore: 0.42,
    sharedVulnerablePackages: [],
    repoHealth: [],
  },
}

describe("intelligence UX helpers", () => {
  test("builds single-repo capabilities and prompts", () => {
    const capabilities = buildIntelligenceCapabilities(baseContext, false)

    expect(capabilities).toEqual(["Overview", "Hotspots", "Impact", "Contributors", "Controls", "Security"])
    expect(buildIntelligenceHeaderHint(capabilities)).toBe("Grounded in overview, hotspots, and impact")
    expect(buildIntelligencePromptPlaceholder(capabilities)).toBe(
      "Ask about overview, hotspots, and impact, or where to look next...",
    )

    const messages = buildIntelligenceWelcomeMessages(baseContext, false)

    expect(messages[0]).toContain("Stormwatch")
    expect(messages[1]).toContain("Current pressure peak: src/pressure-zone.ts")
    expect(messages[1]).toContain("1 quality control is failing")
    expect(messages[2]).toContain("Where is the worst pressure zone right now?")
  })

  test("builds landscape-specific capabilities and navigation nudges", () => {
    const landscapeContext: AnalysisContextProps = {
      ...baseContext,
      analysisData: {
        name: "Platform landscape",
        description: "Landscape analysis",
        filesCount: 0,
        linesOfCode: 900000,
      },
      impactData: null,
      controlsData: null,
    }

    const capabilities = buildIntelligenceCapabilities(landscapeContext, true)
    const messages = buildIntelligenceWelcomeMessages(landscapeContext, true)

    expect(capabilities).toEqual(["Landscape overview", "Repository pressure", "Contributors", "Security"])
    expect(messages[0]).toContain("Platform landscape")
    expect(messages[2]).toContain("Which repository is under the most pressure right now?")
    expect(messages[2]).toContain("Take me to the repositories page.")
  })
})
