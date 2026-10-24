import { describe, expect, test } from "bun:test"
import type { DatasetDescriptor } from "@planetnik/common"
import {
  formatExploreMetric,
  getDatasetInitials,
  getDatasetModeLabel,
  getDatasetRecommendedView,
  getDatasetSearchText,
  getDatasetStatusLabel,
} from "../datasets/explore"

const readyRepository: DatasetDescriptor = {
  id: "openai-openai-python",
  slug: "openai-openai-python",
  title: "OpenAI Python SDK",
  mode: "single_repository",
  snapshot: {
    snapshotId: "8d2d9f6f-2246-4c4d-a89a-4ca3cbbce4c3",
    dataVersion: 2,
    generatedAt: "2026-09-03T10:00:00.000Z",
  },
  provenance: {
    sourceUrl: "https://github.com/openai/openai-python",
    sourceRef: "v1.0.0",
    license: "Apache-2.0",
  },
  description: "A focused production Python SDK.",
  stats: { repositories: 1, files: 1200, loc: 14500, contributors: 42, commits: 360 },
  languages: [{ key: "py", label: "Python", loc: 14500, share: 100 }],
  capabilities: ["overview", "code-city", "impact"],
  tags: ["python", "sdk", "ai"],
  curation: { featured: true, shelf: "Repository pilots", order: 10 },
  availability: "ready",
}

describe("Explore presentation helpers", () => {
  test("formats exact values and compact display metrics", () => {
    expect(formatExploreMetric(undefined)).toBe("—")
    expect(formatExploreMetric(0)).toBe("0")
    expect(formatExploreMetric(14500)).toBe("14.5k")
    expect(formatExploreMetric(1_250_000)).toBe("1.3m")
  })

  test("uses readable mode and availability labels", () => {
    expect(getDatasetModeLabel("single_repository")).toBe("Repository")
    expect(getDatasetModeLabel("landscape")).toBe("Landscape")
    expect(getDatasetStatusLabel("ready")).toBe("Ready")
    expect(getDatasetStatusLabel("partial")).toBe("Partial")
    expect(getDatasetStatusLabel("planned")).toBe("Planned")
  })

  test("creates deterministic initials without relying on a logo asset", () => {
    expect(getDatasetInitials("OpenAI Python SDK", "openai-openai-python")).toBe("OP")
    expect(getDatasetInitials("tokio", "tokio-tokio")).toBe("TO")
    expect(getDatasetInitials("", "code-city-task9")).toBe("CC")
  })

  test("indexes the fields people use to find a dataset", () => {
    const searchText = getDatasetSearchText(readyRepository)
    expect(searchText).toContain("openai python sdk")
    expect(searchText).toContain("python")
    expect(searchText).toContain("sdk")
    expect(searchText).toContain("single repository")
    expect(searchText).toContain("openai")
  })

  test("recommends an available view for each audience", () => {
    expect(getDatasetRecommendedView(readyRepository, "onboarding")).toBe("overview")
    expect(getDatasetRecommendedView(readyRepository, "architecture-review")).toBe("code-city")
    expect(getDatasetRecommendedView(readyRepository, "stakeholder")).toBe("overview")
    expect(getDatasetRecommendedView({ ...readyRepository, capabilities: ["overview"] }, "architecture-review")).toBe(
      "overview",
    )
    expect(
      getDatasetRecommendedView({ ...readyRepository, capabilities: ["summary", "filesMain"] }, "architecture-review"),
    ).toBe("code-city")
    expect(getDatasetRecommendedView({ ...readyRepository, capabilities: ["summary"] }, "stakeholder")).toBe("overview")
  })
})
