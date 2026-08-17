import { describe, expect, test } from "bun:test"
import type { ReactElement, ReactNode } from "react"
import { formatCodeCityFallbackInspectLabel } from "../CodeCityFallback.js"
import { CodeCityInspector } from "../CodeCityInspector.js"
import type { CodeCityFallbackRow } from "../CodeCityFallback.js"
import type { CodeCityInspectorModel } from "../viewModel.js"

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

describe("CodeCityInspector", () => {
  test("renders a selected building's unit identity, range, LOC, complexity, and evidence", () => {
    const inspector: CodeCityInspectorModel = {
      title: "src/runtime.ts",
      path: "src/runtime.ts",
      districtLabel: "Runtime",
      sourceSets: ["main"],
      metrics: [],
      evidence: [],
		visualFacts: [
			{ label: "Material", value: "Brick" },
			{ label: "Archetype", value: "Tower" },
			{ label: "Roof", value: "Capped" },
			{ label: "Texture", value: "Banded" },
			{ label: "Active lens", value: "Health uses impact markers." },
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
		expect(text).toContain("Health uses impact markers.")
    expect(links.map((link) => link.props.href)).toContain("/units/complexity#start")
  })
})
