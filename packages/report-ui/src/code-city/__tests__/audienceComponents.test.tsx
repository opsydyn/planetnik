import { describe, expect, test } from "bun:test"
import type { ReactElement } from "react"
import type { CodeCityAudienceId } from "../audience.js"
import { CodeCityAudienceSwitch } from "../CodeCityAudienceSwitch.js"

type AudienceButton = ReactElement<{
  readonly children?: string
  readonly onClick?: () => void
  readonly "aria-pressed"?: boolean
}>

describe("CodeCityAudienceSwitch", () => {
  test("exposes all modes with an active state", () => {
    const changes: CodeCityAudienceId[] = []
    const rendered = CodeCityAudienceSwitch({
      audience: "onboarding",
      onChange: (next) => changes.push(next),
    })
    const buttons = rendered.props.children as AudienceButton[]

    expect(buttons).toHaveLength(3)
    expect(buttons[0]?.props).toMatchObject({ children: "Onboarding", "aria-pressed": true })
    buttons[1]?.props.onClick?.()
    expect(changes).toEqual(["architecture-review"])
  })
})
