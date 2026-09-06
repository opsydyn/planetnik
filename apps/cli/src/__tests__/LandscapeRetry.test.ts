import { describe, expect, test } from "bun:test"
import { Effect, Schedule } from "effect"
import { isRetryableLandscapeExternalError, retryLandscapeExternal } from "../commands/analyzeLandscape.js"

describe("landscape external retry policy", () => {
  test("recognises transient network and service failures", () => {
    expect(isRetryableLandscapeExternalError(Object.assign(new Error("socket reset"), { code: "ECONNRESET" }))).toBe(
      true,
    )
    expect(isRetryableLandscapeExternalError(new Error("GitHub API error: 503 Service Unavailable"))).toBe(true)
    expect(isRetryableLandscapeExternalError(new Error("GitHub API error: 429 Too Many Requests"))).toBe(true)
    expect(isRetryableLandscapeExternalError(new Error("GitHub API error: 403 rate limit exceeded"))).toBe(true)
  })

  test("does not retry deterministic authentication, permission, or not-found failures", () => {
    expect(isRetryableLandscapeExternalError(new Error("repository not found"))).toBe(false)
    expect(isRetryableLandscapeExternalError(new Error("authentication failed"))).toBe(false)
    expect(isRetryableLandscapeExternalError(new Error("GitHub API error: 403 Forbidden"))).toBe(false)
    expect(isRetryableLandscapeExternalError({ status: 404, message: "Not Found" })).toBe(false)
  })

  test("retries a transient operation up to the bounded policy", async () => {
    let attempts = 0

    const result = await Effect.runPromise(
      retryLandscapeExternal(
        Effect.gen(function* () {
          attempts += 1
          if (attempts < 3) return yield* Effect.fail(new Error("ETIMEDOUT"))
          return "ok"
        }),
        Schedule.recurs(3),
      ),
    )

    expect(result).toBe("ok")
    expect(attempts).toBe(3)
  })

  test("leaves a permanent operation at its first failure", async () => {
    let attempts = 0

    const result = await Effect.runPromise(
      retryLandscapeExternal(
        Effect.gen(function* () {
          attempts += 1
          return yield* Effect.fail(new Error("repository not found"))
        }),
        Schedule.recurs(3),
      ).pipe(Effect.either),
    )

    expect(result._tag).toBe("Left")
    expect(attempts).toBe(1)
  })

  test("exhausts transient failures after the bounded schedule", async () => {
    let attempts = 0

    const result = await Effect.runPromise(
      retryLandscapeExternal(
        Effect.gen(function* () {
          attempts += 1
          return yield* Effect.fail(new Error("ETIMEDOUT"))
        }),
        Schedule.recurs(3),
      ).pipe(Effect.either),
    )

    expect(result._tag).toBe("Left")
    expect(attempts).toBe(4)
  })
})
