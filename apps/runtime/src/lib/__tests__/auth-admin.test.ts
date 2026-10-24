import { describe, expect, test } from "bun:test"

process.env.NODE_ENV ??= "test"
process.env.PORT ??= "1337"
process.env.CORS_ORIGIN ??= "http://localhost:4321"
process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/planetnik?sslmode=disable"
process.env.BETTER_AUTH_SECRET ??= "test-secret-with-at-least-32-characters"
process.env.BETTER_AUTH_URL ??= "http://localhost:1337"
process.env.AUTH_COOKIE_SECURE ??= "false"
process.env.AUTH_COOKIE_SAME_SITE ??= "lax"

async function waitForFunction(getValue: () => unknown, timeoutMs: number, pollMs = 50): Promise<unknown> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const value = getValue()
    if (typeof value === "function") {
      return value
    }

    await Bun.sleep(pollMs)
  }

  return getValue()
}

describe("runtime auth admin support", () => {
  test("adds admin-compatible auth fields to the Better Auth schema", async () => {
    const { session, user } = await import("../../db/schema/auth.js")

    expect(user.role).toBeDefined()
    expect(user.banned).toBeDefined()
    expect(user.banReason).toBeDefined()
    expect(user.banExpires).toBeDefined()
    expect(session.impersonatedBy).toBeDefined()
  })

  test("enables Better Auth admin API methods", async () => {
    const { auth } = await import("../auth.js")
    const api = auth.api as Record<string, unknown>
    const listUsers = await waitForFunction(() => api.listUsers, 15_000)

    expect(typeof listUsers).toBe("function")
  }, 20_000)
})
