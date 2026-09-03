import { describe, expect, test } from "bun:test"
import type { ReactElement, ReactNode } from "react"
import { CodeCityArchitectureBrief } from "../CodeCityArchitectureBrief.js"
import { CodeCityAudienceSwitch } from "../CodeCityAudienceSwitch.js"
import { formatCodeCityFallbackInspectLabel } from "../CodeCityFallback.js"
import { CodeCityInspector } from "../CodeCityInspector.js"
import { CodeCityStoryRail } from "../CodeCityStoryRail.js"
import type { CodeCityStory } from "../story.js"
import type { CodeCityFallbackRow } from "../CodeCityFallback.js"
import type { CodeCityInspectorModel } from "../viewModel.js"

const viewSource = await Bun.file(new URL("../CodeCityView.tsx", import.meta.url)).text()

const textContent = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (Array.isArray(node)) return node.map(textContent).join("")
  const element = node as ReactElement<{ readonly children?: ReactNode }>
  return textContent(element.props?.children)
}

const findElements = (
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>>[] => {
  if (node === null || node === undefined || typeof node !== "object") return []
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate))
  const element = node as ReactElement<Record<string, unknown> & { readonly children?: ReactNode }>
  return [
    ...(predicate(element) ? [element] : []),
    ...findElements(element.props?.children, predicate),
  ]
}

describe("CodeCityFallback", () => {
  test("names district and building inspection controls by entity kind", () => {
    const district = {
      kind: "district",
      id: "district:runtime",
      entity: "Runtime",
      district: "Runtime",
      path: "Component district",
      loc: "240",
      health: "87",
      impact: "73",
      form: "Civic parcel",
      landmark: "Hub",
      href: "/topology#runtime",
    } as CodeCityFallbackRow
    const building = {
      kind: "building",
      id: "file:runtime",
      entity: "src/runtime.ts",
      district: "Runtime",
      path: "src/runtime.ts",
      loc: "240",
      health: "87",
      impact: "73",
      form: "Tower · capped roof",
      landmark: "Hub",
      href: "/files/size#runtime",
    } as CodeCityFallbackRow

    expect(formatCodeCityFallbackInspectLabel(district)).toBe("Inspect district Runtime")
    expect(formatCodeCityFallbackInspectLabel(building)).toBe("Inspect file src/runtime.ts")
  })

})

describe("Code City audience experience", () => {
  test("keeps audience explanation, architecture brief, and table fallback wired into the view", () => {
    expect(viewSource).toContain("What you’re seeing")
    expect(viewSource).toContain("<CodeCityArchitectureBrief")
    expect(viewSource).toContain("<CodeCityFallback")
  })

  test("exposes a labelled audience group and the guided explanation entry point", () => {
    const audience = CodeCityAudienceSwitch({
      audience: "onboarding",
      onChange: () => undefined,
    })
    const story: CodeCityStory = {
      audience: "onboarding",
      steps: [],
    }
    const rail = CodeCityStoryRail({
      story,
      state: { tag: "idle" },
      onEvent: () => undefined,
      onFocusStep: () => undefined,
    })
    const audienceButtons = findElements(audience, (element) => element.type === "button")
    const storyButtons = findElements(rail, (element) => element.type === "button")

    expect(audience.props).toMatchObject({
      role: "group",
      "aria-label": "Code City audience",
    })
    expect(audienceButtons.map((button) => textContent(button))).toEqual([
      "Onboarding",
      "Architecture Review",
      "Stakeholder",
    ])
    expect(textContent(rail)).toContain("Explain this city")
    expect(storyButtons.map((button) => textContent(button))).toContain("Explain this city")
  })

  test("keeps architecture brief facts and their evidence visible outside the map", () => {
    const rendered = CodeCityArchitectureBrief({
      brief: {
        title: "Architecture Review brief",
        lead: "Where are the boundaries and pressures?",
        facts: [
          {
            label: "Largest context",
            value: "Runtime · 240 LOC",
            evidence: [{ label: "Runtime component", href: "/components#runtime" }],
          },
          {
            label: "Evidence",
            value: "1 canonical route",
            evidence: [{ label: "Runtime topology", href: "/topology#runtime" }],
          },
        ],
        nextAction: "Inspect a hub or boundary crossing",
      },
      copyStatus: "idle",
      onCopy: () => undefined,
    })
    const links = findElements(rendered, (element) => element.type === "a")

    expect(rendered.props).toMatchObject({
      className: "code-city__brief",
      "aria-label": "Architecture brief",
    })
    expect(textContent(rendered)).toContain("Largest context")
    expect(textContent(rendered)).toContain("Runtime · 240 LOC")
    expect(textContent(rendered)).toContain("Inspect a hub or boundary crossing")
    expect(links.map((link) => link.props.href)).toEqual([
      "/components#runtime",
      "/topology#runtime",
    ])
  })
})

describe("CodeCityInspector", () => {
  test("renders a selected building's unit identity, range, LOC, complexity, and evidence", () => {
    const inspector: CodeCityInspectorModel = {
      title: "src/runtime.ts",
      path: "src/runtime.ts",
      districtLabel: "Runtime",
      sourceSets: ["main"],
      metrics: [],
		evidence: [],
		relationships: [
			{
				id: "edge:runtime-web",
				label: "Dependency route",
				summary: "Runtime → Web · 2 dependencies",
				href: "/topology#runtime-web",
			},
		],
		visualFacts: [
			{ label: "Material", value: "Brick" },
			{ label: "Archetype", value: "Tower" },
			{ label: "Roof", value: "Capped" },
			{ label: "Texture", value: "Banded" },
			{
				label: "Active lens",
				value: "Health has no separate geometry cue; it uses a restrained emissive surface tint.",
			},
		],
      units: [
        {
          id: "unit:runtime-start",
          label: "Runtime.start",
          range: "Lines 10–31",
          loc: "22",
          complexity: "McCabe 11",
          evidence: [{ label: "Unit: unit:runtime-start", href: "/units/complexity#start" }],
        },
      ],
    }

    const rendered = CodeCityInspector({
      inspector,
      canFocus: true,
      onFocus: () => undefined,
      onClear: () => undefined,
    })
    const text = textContent(rendered)
    const links = findElements(rendered, (element) => element.type === "a")

    expect(text).toContain("Units")
    expect(text).toContain("Runtime.start")
    expect(text).toContain("unit:runtime-start")
    expect(text).toContain("Lines 10–31")
    expect(text).toContain("22 LOC")
    expect(text).toContain("McCabe 11")
		expect(text).toContain("Visual encoding")
		expect(text).toContain("Material")
		expect(text).toContain("Health has no separate geometry cue; it uses a restrained emissive surface tint.")
		expect(text).toContain("Architecture tethers")
		expect(text).toContain("Runtime → Web · 2 dependencies")
    expect(links.map((link) => link.props.href)).toContain("/units/complexity#start")
		expect(links.map((link) => link.props["aria-label"])).toContain(
			"Dependency route: Runtime → Web · 2 dependencies",
		)
		expect(links.map((link) => link.props.href)).toContain("/topology#runtime-web")
  })
})
