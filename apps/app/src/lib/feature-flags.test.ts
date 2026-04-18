import { afterEach, describe, expect, test } from "bun:test"
import { isHostedIntelligenceEnabled } from "./feature-flags"

const ORIGINAL_SHOW_INTELLIGENCE = process.env.SHOW_INTELLIGENCE

afterEach(() => {
  if (typeof ORIGINAL_SHOW_INTELLIGENCE === "string") {
    process.env.SHOW_INTELLIGENCE = ORIGINAL_SHOW_INTELLIGENCE
    return
  }

  delete process.env.SHOW_INTELLIGENCE
})

describe("isHostedIntelligenceEnabled", () => {
  test("uses the runtime env when Azure sets the flag to true", () => {
    process.env.SHOW_INTELLIGENCE = "true"

    expect(isHostedIntelligenceEnabled()).toBe(true)
  })

  test("treats runtime false values as disabled", () => {
    process.env.SHOW_INTELLIGENCE = "false"

    expect(isHostedIntelligenceEnabled()).toBe(false)
  })

  test("accepts numeric runtime truthy values", () => {
    process.env.SHOW_INTELLIGENCE = "1"

    expect(isHostedIntelligenceEnabled()).toBe(true)
  })
})
