import { describe, expect, test } from "bun:test"
import { getLandscapeRepositoryCodeCityHref, mapLandscapeRepositoryRoute } from "../landscapeRoutes.js"

describe("landscape repository Code City routes", () => {
  test("encodes the repository key in the Code City href", () => {
    expect(getLandscapeRepositoryCodeCityHref("alan/xmas-advent")).toBe(
      "/landscape/repositories/alan$2Fxmas-advent/code-city",
    )
  })

  test("maps the report Code City route into the repository shell", () => {
    expect(mapLandscapeRepositoryRoute("alan/xmas-advent", "/code-city")).toBe(
      "/landscape/repositories/alan$2Fxmas-advent/code-city",
    )
  })
})
