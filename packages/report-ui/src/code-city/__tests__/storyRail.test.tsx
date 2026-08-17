import { describe, expect, test } from "bun:test"
import type { ReactElement, ReactNode } from "react"
import { CodeCityStoryRail } from "../CodeCityStoryRail.js"
import {
  reduceCodeCityStoryViewState,
  resolveCodeCityStoryCompletionAction,
  resolveCodeCityStoryFocusAction,
} from "../CodeCityView.js"
import type { CodeCityStory, CodeCityStoryEvent } from "../story.js"

type ButtonProps = {
  readonly children?: ReactNode
  readonly disabled?: boolean
  readonly onClick?: () => void
}

const storyFixture = (): CodeCityStory => ({
  audience: "onboarding",
  steps: [
    {
      id: "orient",
      title: "Orient the city",
      body: "Districts are bounded contexts.",
      target: null,
      relatedDistrictId: null,
      evidence: [],
      availability: "available",
      unavailableReason: null,
    },
    {
      id: "name",
      title: "Name a district",
      body: "The application district is canonical.",
      target: { kind: "district", id: "district:app" },
      relatedDistrictId: null,
      evidence: [],
      availability: "available",
      unavailableReason: null,
    },
    {
      id: "connect",
      title: "Connect the city",
      body: "No supported relationship is present.",
      target: null,
      relatedDistrictId: null,
      evidence: [],
      availability: "unavailable",
      unavailableReason: "No resolved district relationship is available in the canonical model.",
    },
    {
      id: "prove",
      title: "Prove the explanation",
      body: "Follow the canonical evidence.",
      target: { kind: "district", id: "district:app" },
      relatedDistrictId: null,
      evidence: [{ label: "District: district:app", href: "/topology#app" }],
      availability: "available",
      unavailableReason: null,
    },
  ],
})

const textContent = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (Array.isArray(node)) return node.map(textContent).join("")
  const element = node as ReactElement<{ readonly children?: ReactNode }>
  return textContent(element.props.children)
}

const findButton = (node: ReactNode, label: string): ReactElement<ButtonProps> => {
  if (node === null || node === undefined || typeof node !== "object") {
    throw new Error(`Could not find ${label} button`)
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      try {
        return findButton(child, label)
      } catch {
        // Continue searching sibling elements.
      }
    }
    throw new Error(`Could not find ${label} button`)
  }

  const element = node as ReactElement<ButtonProps>
  if (element.type === "button" && textContent(element.props.children) === label) return element
  return findButton(element.props.children, label)
}

describe("CodeCityStoryRail", () => {
  test("idle rail offers an explicit explain action", () => {
    const events: CodeCityStoryEvent[] = []
    const rendered = CodeCityStoryRail({
      story: storyFixture(),
      state: { tag: "idle" },
      onEvent: (event) => events.push(event),
      onFocusStep: () => undefined,
    })

    expect(textContent(rendered)).toContain("Explain this city")
    findButton(rendered, "Explain this city").props.onClick?.()
    expect(events).toEqual([{ type: "start" }])
  })

  test("active rail exposes progress and reversible focus", () => {
    const rendered = CodeCityStoryRail({
      story: storyFixture(),
      state: { tag: "active", stepIndex: 1, focused: true },
      onEvent: () => undefined,
      onFocusStep: () => undefined,
    })

    expect(textContent(rendered)).toContain("Step 2 of 4")
    expect(textContent(rendered)).toContain("Return to overview")
  })

  test("unavailable steps explain the canonical gap and offer skip", () => {
    const events: CodeCityStoryEvent[] = []
    const rendered = CodeCityStoryRail({
      story: storyFixture(),
      state: { tag: "active", stepIndex: 2, focused: false },
      onEvent: (event) => events.push(event),
      onFocusStep: () => undefined,
    })

    expect(textContent(rendered)).toContain(
      "No resolved district relationship is available in the canonical model.",
    )
    expect(findButton(rendered, "Focus this step").props.disabled).toBe(true)
    findButton(rendered, "Skip").props.onClick?.()
    expect(events).toEqual([{ type: "skip" }])
  })

  test("focused navigation retains an explicit return action that clears the camera", () => {
    const story = storyFixture()
    const navigation = [
      { event: { type: "next" } as const, stepIndex: 2 },
      { event: { type: "back" } as const, stepIndex: 0 },
      { event: { type: "skip" } as const, stepIndex: 2 },
    ]

    for (const { event, stepIndex } of navigation) {
      const state = reduceCodeCityStoryViewState(
        { tag: "active", stepIndex: 1, focused: true },
        event,
        story.steps.length,
      )
      const rendered = CodeCityStoryRail({
        story,
        state,
        onEvent: () => undefined,
        onFocusStep: () => undefined,
      })

      expect(state).toEqual({ tag: "active", stepIndex, focused: true })
      expect(resolveCodeCityStoryFocusAction(story, state)).toEqual({
        type: "return-to-overview",
        entityId: null,
      })
      expect(textContent(rendered)).toContain("Return to overview")
    }
  })

  test("focused final navigation restores the overview before story completion", () => {
    const story = storyFixture()
    const navigation = [{ type: "next" } as const, { type: "skip" } as const]

    for (const event of navigation) {
      const previousState = { tag: "active" as const, stepIndex: 3, focused: true }
      const nextState = reduceCodeCityStoryViewState(previousState, event, story.steps.length)

      expect(nextState).toEqual({ tag: "completed" })
      expect(resolveCodeCityStoryCompletionAction(previousState, event, nextState)).toEqual({
        type: "return-to-overview",
        entityId: null,
      })
    }
  })
})
