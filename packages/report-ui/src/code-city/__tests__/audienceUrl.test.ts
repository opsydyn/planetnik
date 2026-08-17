import { describe, expect, test } from "bun:test"
import {
  buildCodeCityUrl,
  parseCodeCityUrlState,
  resolveCodeCityInitialUrlState,
} from "../audienceUrl.js"

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

  test("uses the browser query when static route props are build-time defaults", () => {
    expect(
      resolveCodeCityInitialUrlState(
        { audience: "onboarding", story: null },
        new URL("https://example.test/code-city?audience=architecture-review&story=connect"),
      ),
    ).toEqual({ audience: "architecture-review", story: "connect" })
  })

  test("retains serialised route props when no browser URL exists during SSR", () => {
    expect(
      resolveCodeCityInitialUrlState(
        { audience: "stakeholder", story: "prove" },
        null,
      ),
    ).toEqual({ audience: "stakeholder", story: "prove" })
  })
})
