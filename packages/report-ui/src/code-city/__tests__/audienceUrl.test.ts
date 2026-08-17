import { describe, expect, test } from "bun:test"
import { buildCodeCityUrl, parseCodeCityUrlState } from "../audienceUrl.js"

describe("Code City audience URL state", () => {
  test("ignores unsupported audience and story values", () => {
    const state = parseCodeCityUrlState(
      new URL("https://example.test/code-city?audience=bad&story=bad"),
    )

    expect(state).toEqual({ audience: "onboarding", story: null })
  })

  test("omits defaults and preserves supported state", () => {
    expect(buildCodeCityUrl("/code-city", { audience: "onboarding", story: null })).toBe(
      "/code-city",
    )
    expect(
      buildCodeCityUrl("/code-city", {
        audience: "architecture-review",
        story: "connect",
      }),
    ).toBe("/code-city?audience=architecture-review&story=connect")
  })
})
