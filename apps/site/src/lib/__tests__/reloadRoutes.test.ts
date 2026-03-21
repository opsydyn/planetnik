import { describe, expect, test } from "bun:test"
import { shouldBypassClientRouter } from "../reloadRoutes"

describe("reload route helpers", () => {
  test("bypasses the client router for single-repo graph routes", () => {
    expect(shouldBypassClientRouter("/topology")).toBe(true)
    expect(shouldBypassClientRouter("/files/temporal")).toBe(true)
  })

  test("bypasses the client router for landscape graph routes", () => {
    expect(shouldBypassClientRouter("/landscape/topology")).toBe(true)
    expect(shouldBypassClientRouter("/landscape/repositories/Effect-TS$2Feffect/topology")).toBe(true)
    expect(shouldBypassClientRouter("/landscape/repositories/Effect-TS$2Feffect/files/temporal")).toBe(true)
  })

  test("ignores query strings when matching reload routes", () => {
    expect(shouldBypassClientRouter("/landscape/repositories/Effect-TS$2Feffect/files/temporal?from=search")).toBe(
      true,
    )
  })

  test("leaves normal routes on the client router", () => {
    expect(shouldBypassClientRouter("/components")).toBe(false)
    expect(shouldBypassClientRouter("/landscape/repositories/Effect-TS$2Feffect/files/churn")).toBe(false)
    expect(shouldBypassClientRouter("/landscape/repositories")).toBe(false)
  })
})
