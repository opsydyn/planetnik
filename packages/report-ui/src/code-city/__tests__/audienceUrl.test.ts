import { describe, expect, test } from "bun:test"
import {
  buildCodeCityUrl,
  parseCodeCityUrlState,
  resolveCodeCityInitialUrlState,
  resolveCodeCityPostHydrationUrlState,
} from "../audienceUrl.js"

describe("Code City audience URL state", () => {
  test("ignores unsupported audience and story values", () => {
    const state = parseCodeCityUrlState(new URL("https://example.test/code-city?audience=bad&story=bad"))

    expect(state).toEqual({ audience: "onboarding", story: null })
  })

  test("omits defaults and preserves supported state", () => {
    expect(buildCodeCityUrl("/code-city", { audience: "onboarding", story: null })).toBe("/code-city")
    expect(
      buildCodeCityUrl("/code-city", {
        audience: "architecture-review",
        story: "connect",
      }),
    ).toBe("/code-city?audience=architecture-review&story=connect")
  })

  test("keeps serialised props for the hydration render before applying the browser query", () => {
    const serialisedProps = { audience: "onboarding" as const, story: null }

    expect(resolveCodeCityInitialUrlState(serialisedProps)).toEqual(serialisedProps)
    expect(
      resolveCodeCityPostHydrationUrlState(
        new URL("https://example.test/code-city?audience=architecture-review&story=connect"),
      ),
    ).toEqual({ audience: "architecture-review", story: "connect" })
  })
})
