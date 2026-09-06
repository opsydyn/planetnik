import { describe, expect, test } from "bun:test"
import {
  parseActionQueueMaterializationMode,
  parseActionQueuePartitionCount,
} from "../datasets/actionQueueMaterializationMode.js"

describe("action queue materialization mode", () => {
  test("keeps the default bounded and opts into complete mode only explicitly", () => {
    expect(parseActionQueueMaterializationMode(undefined)).toBe("bounded")
    expect(parseActionQueueMaterializationMode("")).toBe("bounded")
    expect(parseActionQueueMaterializationMode("0")).toBe("bounded")
    expect(parseActionQueueMaterializationMode("false")).toBe("bounded")
    expect(parseActionQueueMaterializationMode("1")).toBe("complete")
  })

  test("rejects ambiguous complete-mode values", () => {
    expect(() => parseActionQueueMaterializationMode("true")).toThrow(
      "PLANETNIK_ACTION_QUEUE_COMPLETE must be unset, 0, false, or 1.",
    )
    expect(() => parseActionQueueMaterializationMode("yes")).toThrow(
      "PLANETNIK_ACTION_QUEUE_COMPLETE must be unset, 0, false, or 1.",
    )
  })

  test("uses a positive default and rejects invalid partition counts", () => {
    expect(parseActionQueuePartitionCount(undefined)).toBe(64)
    expect(parseActionQueuePartitionCount("128")).toBe(128)
    expect(() => parseActionQueuePartitionCount("0")).toThrow(
      "PLANETNIK_ACTION_QUEUE_PARTITIONS must be a positive integer.",
    )
    expect(() => parseActionQueuePartitionCount("1.5")).toThrow(
      "PLANETNIK_ACTION_QUEUE_PARTITIONS must be a positive integer.",
    )
    expect(() => parseActionQueuePartitionCount("nope")).toThrow(
      "PLANETNIK_ACTION_QUEUE_PARTITIONS must be a positive integer.",
    )
  })
})
