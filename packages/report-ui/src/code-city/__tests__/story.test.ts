import { describe, expect, test } from "bun:test"
import type { CodeCityModel, CodeCitySignals } from "@planetnik/common"
import type { CodeCityStoryState } from "../story.js"
import { buildCodeCityStory, reduceCodeCityStoryState } from "../story.js"

const signals: CodeCitySignals = {
  footprint: { loc: 1, buildingCount: 1 },
  complexity: { maxMcCabe: null, unitCount: 0 },
  health: { score: null, severity: null, dominantDimension: null },
  change: { commits: null, temporalLinks: null },
  ownership: { contributorIds: [], contributorCount: 0 },
  impact: { score: null, dimension: null, sourceId: null },
}

const modelFixture = (): CodeCityModel => ({
  contractVersion: 1,
  snapshot: { repositoryId: "repo:fixture", title: "Fixture" },
  districts: [
    {
      id: "district:app",
      kind: "component",
      label: "App",
      decompositionKey: "primary",
      pathPrefix: "apps/app",
      buildingIds: ["file:app"],
      metrics: signals,
      evidence: [{ kind: "component", id: "app", route: "/topology#app" }],
      derived: false,
    },
    {
      id: "district:shared",
      kind: "component",
      label: "Shared",
      decompositionKey: "primary",
      pathPrefix: "packages/shared",
      buildingIds: ["file:shared"],
      metrics: signals,
      evidence: [{ kind: "component", id: "shared", route: "/topology#shared" }],
      derived: false,
    },
    {
      id: "district:web",
      kind: "component",
      label: "Web",
      decompositionKey: "primary",
      pathPrefix: "apps/web",
      buildingIds: ["file:web"],
      metrics: signals,
      evidence: [],
      derived: false,
    },
  ],
  buildings: [
    {
      id: "file:app",
      relativePath: "apps/app/src/main.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["app"],
      districtIds: ["district:app"],
      primaryDistrictId: "district:app",
      metrics: signals,
      evidence: [],
    },
    {
      id: "file:shared",
      relativePath: "packages/shared/src/index.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["shared"],
      districtIds: ["district:shared"],
      primaryDistrictId: "district:shared",
      metrics: signals,
      evidence: [],
    },
    {
      id: "file:web",
      relativePath: "apps/web/src/main.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["web"],
      districtIds: ["district:web"],
      primaryDistrictId: "district:web",
      metrics: signals,
      evidence: [],
    },
  ],
  units: [],
  edges: [
    {
      id: "edge:app-shared",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:app",
      targetDistrictId: "district:shared",
      count: 8,
      locFrom: 25,
      evidenceCount: 1,
      resolution: "both",
      evidence: [{ kind: "component", id: "app-shared", route: "/topology#app-shared" }],
    },
    {
      id: "edge:app-web",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:app",
      targetDistrictId: "district:web",
      count: 8,
      locFrom: 10,
      evidenceCount: 1,
      resolution: "both",
      evidence: [{ kind: "component", id: "app-web", route: "/topology#app-web" }],
    },
  ],
  coverage: {
    presentShards: ["files_main.json", "component_dependencies.json"],
    missingOptionalShards: [],
    diagnostics: [],
    derivedDistrictIds: [],
    counts: { files: 3, districts: 3, units: 0, edges: 2, diagnostics: 0 },
  },
  layout: {
    contractVersion: 1,
    seed: "code-city-v1:fixture",
    districtOrder: ["district:app", "district:shared", "district:web"],
    buildingOrder: ["file:app", "file:shared", "file:web"],
    unitOrder: [],
  },
  legend: { channels: [] },
})

const permutedModelFixture = (): CodeCityModel => {
  const model = modelFixture()
  return {
    ...model,
    districts: [...model.districts].reverse(),
    buildings: [...model.buildings].reverse(),
    edges: [...model.edges].reverse(),
  }
}

describe("buildCodeCityStory", () => {
  test("story steps are stable when source arrays are permuted", () => {
    const first = buildCodeCityStory(modelFixture(), "architecture-review", "/repo")
    const second = buildCodeCityStory(permutedModelFixture(), "architecture-review", "/repo")

    expect(second).toEqual(first)
  })

  test("connect selects the highest-count resolved edge with an ID tie-break", () => {
    const story = buildCodeCityStory(modelFixture(), "architecture-review", "/repo")

    expect(story.steps.find(({ id }) => id === "connect")).toMatchObject({
      target: { kind: "district", id: "district:app" },
      relatedDistrictId: "district:shared",
      availability: "available",
    })
  })

  test("story evidence uses only canonical evidence routes", () => {
    const story = buildCodeCityStory(modelFixture(), "architecture-review", "/repo")

    expect(story.steps.find(({ id }) => id === "connect")?.evidence).toEqual([
      { label: "Component: app-shared", href: "/repo/topology#app-shared" },
    ])
  })

  test("missing districts and resolved edges remain explicit unavailable steps", () => {
    const model = modelFixture()
    const noTargets: CodeCityModel = {
      ...model,
      districts: [],
      edges: [
        {
          ...model.edges[0]!,
          sourceDistrictId: null,
          targetDistrictId: null,
          resolution: "none",
        },
      ],
      layout: { ...model.layout, districtOrder: [] },
    }

    const story = buildCodeCityStory(noTargets, "onboarding", "/repo")

    expect(story.steps.map(({ id, availability }) => [id, availability])).toEqual([
      ["orient", "available"],
      ["name", "unavailable"],
      ["connect", "unavailable"],
      ["prove", "unavailable"],
    ])
    expect(story.steps.find(({ id }) => id === "connect")?.unavailableReason).toContain(
      "No resolved district relationship",
    )
  })
})

describe("reduceCodeCityStoryState", () => {
  test("supports start, back, skip, focus, exit, and completion", () => {
    let state: CodeCityStoryState = { tag: "idle" }
    state = reduceCodeCityStoryState(state, { type: "start" }, 4)
    state = reduceCodeCityStoryState(state, { type: "focus" }, 4)
    expect(state).toEqual({ tag: "active", stepIndex: 0, focused: true })

    state = reduceCodeCityStoryState(state, { type: "next" }, 4)
    expect(state).toEqual({ tag: "active", stepIndex: 1, focused: false })
    state = reduceCodeCityStoryState(state, { type: "back" }, 4)
    expect(state).toEqual({ tag: "active", stepIndex: 0, focused: false })
    state = reduceCodeCityStoryState(state, { type: "skip" }, 4)
    expect(state).toEqual({ tag: "active", stepIndex: 1, focused: false })
    expect(reduceCodeCityStoryState(state, { type: "exit" }, 4)).toEqual({ tag: "idle" })
    expect(reduceCodeCityStoryState(state, { type: "complete" }, 4)).toEqual({ tag: "completed" })
  })

  test("clamps malformed active indices and completes from the final step", () => {
    const highIndex: CodeCityStoryState = { tag: "active", stepIndex: 99, focused: true }
    const lowIndex: CodeCityStoryState = { tag: "active", stepIndex: -4, focused: true }

    expect(reduceCodeCityStoryState(highIndex, { type: "back" }, 4)).toEqual({
      tag: "active",
      stepIndex: 2,
      focused: false,
    })
    expect(reduceCodeCityStoryState(lowIndex, { type: "next" }, 4)).toEqual({
      tag: "active",
      stepIndex: 1,
      focused: false,
    })
    expect(reduceCodeCityStoryState({ tag: "active", stepIndex: 3, focused: true }, { type: "next" }, 4)).toEqual({
      tag: "completed",
    })
  })

  test("normalises non-finite active indices before applying focus", () => {
    expect(
      reduceCodeCityStoryState({ tag: "active", stepIndex: Number.NaN, focused: false }, { type: "focus" }, 4),
    ).toEqual({ tag: "active", stepIndex: 0, focused: true })
  })
})
