import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { JsonMapper } from "../JsonMapper"

describe("JsonMapper", () => {
  test("generate produces pretty-printed JSON", () => {
    const result = JsonMapper.generate({ name: "test", value: 42 })
    expect(result).toContain("\n")
    expect(JSON.parse(result)).toEqual({ name: "test", value: 42 })
  })

  test("generateCompressed produces compact JSON", () => {
    const result = JsonMapper.generateCompressed({ name: "test" })
    expect(result).not.toContain("\n")
    expect(result).toBe('{"name":"test"}')
  })

  test("parse returns parsed object on valid JSON", () => {
    const result = Effect.runSync(JsonMapper.parse('{"a":1}'))
    expect(result).toEqual({ a: 1 })
  })

  test("parse returns error on invalid JSON", () => {
    const result = Effect.runSyncExit(JsonMapper.parse("not json"))
    expect(result._tag).toBe("Failure")
  })
})
