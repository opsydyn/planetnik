import { describe, expect, test } from "bun:test"
import type { ReactElement } from "react"
import {
  CodeCityArchitectureBrief,
  type CodeCityArchitectureBrief as CodeCityArchitectureBriefModel,
} from "../CodeCityArchitectureBrief.js"
import {
  beginCodeCityBriefCopy,
  resetCodeCityBriefCopy,
  settleCodeCityBriefCopy,
} from "../CodeCityView.js"

type BriefElement = ReactElement<{
  readonly children?: unknown
  readonly href?: string
  readonly onClick?: () => void
  readonly "aria-label"?: string
}>

const elementsIn = (value: unknown): BriefElement[] => {
  if (Array.isArray(value)) return value.flatMap(elementsIn)
  if (!value || typeof value !== "object" || !("props" in value)) return []
  const element = value as BriefElement
  return [element, ...elementsIn(element.props.children)]
}

const brief: CodeCityArchitectureBriefModel = {
  title: "Architecture brief",
  lead: "A concise, evidence-backed summary.",
  facts: [
    {
      label: "Evidence",
      value: "2 report links",
      evidence: [{ label: "Components", href: "/components#app" }],
    },
  ],
  nextAction: "Inspect the available evidence.",
}

describe("CodeCityArchitectureBrief", () => {
  test("renders copyable text and visible evidence links", () => {
    let copied = 0
    const rendered = CodeCityArchitectureBrief({
      brief,
      copyStatus: "idle",
      onCopy: () => copied++,
    })
    const elements = elementsIn(rendered)
    const copyButton = elements.find((child) => child.type === "button")
    const evidenceLink = elements.find(
      (child) => child.type === "a" && child.props.href === "/components#app",
    )

    expect(rendered.props["aria-label"]).toBe("Architecture brief")
    expect(copyButton?.props.children).toBe("Copy brief")
    copyButton?.props.onClick?.()
    expect(copied).toBe(1)
    expect(evidenceLink?.props).toMatchObject({
      href: "/components#app",
      children: "Components",
    })
  })

  test("does not announce a copy failure before a copy is attempted", () => {
    const rendered = CodeCityArchitectureBrief({
      brief,
      copyStatus: "idle",
      onCopy: () => {},
    })

    expect(elementsIn(rendered).map((child) => child.props.children).flat()).not.toContain(
      "Copy failed. Select the brief text to copy it manually.",
    )
  })

  test("announces manual copying after a rejected clipboard write", () => {
    const rendered = CodeCityArchitectureBrief({
      brief,
      copyStatus: "failure",
      onCopy: () => {},
    })

    expect(elementsIn(rendered).map((child) => child.props.children).flat()).toContain(
      "Copy failed. Select the brief text to copy it manually.",
    )
  })

  test("ignores a late copy completion after the brief changes", () => {
    const firstCopy = beginCodeCityBriefCopy("brief:onboarding")
    const changedBrief = resetCodeCityBriefCopy("brief:architecture-review")
    const lateCompletion = settleCodeCityBriefCopy(
      changedBrief,
      firstCopy.briefIdentity,
      "success",
    )

    expect(lateCompletion).toEqual({
      briefIdentity: "brief:architecture-review",
      status: "idle",
    })
  })
})
