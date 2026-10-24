import { describe, expect, test } from "bun:test"
import { resolveRouteAccess } from "./access-control"

describe("resolveRouteAccess", () => {
  test("redirects unauthenticated users to sign-in for /admin", () => {
    const decision = resolveRouteAccess({
      pathname: "/admin",
      user: null,
    })

    expect(decision).toEqual({
      kind: "redirect",
      location: "/sign-in",
    })
  })

  test("redirects authenticated non-admin users away from /admin", () => {
    const decision = resolveRouteAccess({
      pathname: "/admin",
      user: {
        id: "user-1",
        email: "alan@example.com",
        role: "user",
      },
    })

    expect(decision).toEqual({
      kind: "redirect",
      location: "/",
    })
  })

  test("allows admin users to access /admin", () => {
    const decision = resolveRouteAccess({
      pathname: "/admin",
      user: {
        id: "admin-1",
        email: "admin@example.com",
        role: "admin",
      },
    })

    expect(decision).toEqual({
      kind: "allow",
    })
  })
})
