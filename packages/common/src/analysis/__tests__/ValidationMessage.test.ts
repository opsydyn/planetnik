import { describe, expect, test } from "bun:test"
import { ValidationMessage } from "../ValidationMessage"

describe("ValidationMessage", () => {
  test("defaults to empty strings", () => {
    const msg = new ValidationMessage()
    expect(msg.message).toBe("")
    expect(msg.searchPhrase).toBe("")
  })

  test("accepts message only", () => {
    const msg = new ValidationMessage("Something went wrong")
    expect(msg.message).toBe("Something went wrong")
    expect(msg.searchPhrase).toBe("")
  })

  test("accepts message and search phrase", () => {
    const msg = new ValidationMessage("Error found", "TODO")
    expect(msg.message).toBe("Error found")
    expect(msg.searchPhrase).toBe("TODO")
  })
})
