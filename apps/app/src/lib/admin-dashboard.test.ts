import { describe, expect, test } from "bun:test"
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  buildCreateUserPayload,
  buildUpdateUserData,
  createAdminPasswordDraft,
  createAdminUserDraftFromUser,
  createEmptyAdminPasswordDraft,
  createEmptyAdminUserDraft,
  formatAdminUserRole,
  matchesAdminUserFilters,
  matchesAdminUserSearch,
  validateAdminPasswordDraft,
  validateAdminUserDraft,
} from "./admin-dashboard.js"

describe("admin dashboard helpers", () => {
  test("creates empty user and password drafts", () => {
    expect(createEmptyAdminUserDraft()).toEqual({
      name: "",
      email: "",
      role: "user",
      password: "",
    })

    expect(createEmptyAdminPasswordDraft()).toEqual({
      userId: null,
      userLabel: "",
      password: "",
      confirmPassword: "",
    })
  })

  test("creates user drafts from existing users", () => {
    expect(
      createAdminUserDraftFromUser({
        name: "Ada Lovelace",
        email: "ADA@example.com",
        role: ["admin"],
      }),
    ).toEqual({
      name: "Ada Lovelace",
      email: "ADA@example.com",
      role: "admin",
      password: "",
    })

    expect(
      createAdminPasswordDraft({
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    ).toEqual({
      userId: "user-1",
      userLabel: "Ada Lovelace",
      password: "",
      confirmPassword: "",
    })
  })

  test("formats user roles safely", () => {
    expect(formatAdminUserRole(undefined)).toBe("user")
    expect(formatAdminUserRole(" admin ")).toBe("admin")
    expect(formatAdminUserRole(["admin", "user"])).toBe("admin, user")
  })

  test("validates create and edit drafts", () => {
    expect(
      validateAdminUserDraft(
        {
          name: "",
          email: "test@example.com",
          role: "user",
          password: "password123",
        },
        "create",
      ),
    ).toBe("User name is required.")

    expect(
      validateAdminUserDraft(
        {
          name: "Ada",
          email: "not-an-email",
          role: "user",
          password: "password123",
        },
        "create",
      ),
    ).toBe("A valid email address is required.")

    expect(
      validateAdminUserDraft(
        {
          name: "Ada",
          email: "ada@example.com",
          role: "user",
          password: "short",
        },
        "create",
      ),
    ).toBe(`Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`)

    expect(
      validateAdminUserDraft(
        {
          name: "Ada",
          email: "ada@example.com",
          role: "admin",
          password: "",
        },
        "edit",
      ),
    ).toBeNull()
  })

  test("validates password changes", () => {
    expect(
      validateAdminPasswordDraft({
        userId: null,
        userLabel: "",
        password: "password123",
        confirmPassword: "password123",
      }),
    ).toBe("Choose a user before changing a password.")

    expect(
      validateAdminPasswordDraft({
        userId: "user-1",
        userLabel: "Ada",
        password: "short",
        confirmPassword: "short",
      }),
    ).toBe(`Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`)

    expect(
      validateAdminPasswordDraft({
        userId: "user-1",
        userLabel: "Ada",
        password: "password123",
        confirmPassword: "different123",
      }),
    ).toBe("Password confirmation does not match.")
  })

  test("builds create payloads and trims input", () => {
    expect(
      buildCreateUserPayload({
        name: " Ada Lovelace ",
        email: " ADA@Example.com ",
        role: "admin",
        password: " password123 ",
      }),
    ).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "admin",
      password: "password123",
    })
  })

  test("builds update payloads with only changed fields", () => {
    expect(
      buildUpdateUserData(
        {
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: ["admin"],
        },
        {
          name: "Ada Lovelace",
          email: "ADA@example.com",
          role: "admin",
          password: "",
        },
      ),
    ).toEqual({})

    expect(
      buildUpdateUserData(
        {
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "user",
        },
        {
          name: "Ada King",
          email: "ada+admin@example.com",
          role: "admin",
          password: "",
        },
      ),
    ).toEqual({
      name: "Ada King",
      email: "ada+admin@example.com",
      role: "admin",
    })
  })

  test("matches search terms across user fields", () => {
    const user = {
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "admin",
    }

    expect(matchesAdminUserSearch(user, "ada")).toBe(true)
    expect(matchesAdminUserSearch(user, "example.com")).toBe(true)
    expect(matchesAdminUserSearch(user, "admin")).toBe(true)
    expect(matchesAdminUserSearch(user, "grace")).toBe(false)
  })

  test("applies status filters on top of search", () => {
    const activeUser = {
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "admin",
      banned: false,
    }
    const bannedUser = {
      ...activeUser,
      banned: true,
    }

    expect(matchesAdminUserFilters(activeUser, "ada", "all")).toBe(true)
    expect(matchesAdminUserFilters(activeUser, "ada", "active")).toBe(true)
    expect(matchesAdminUserFilters(activeUser, "ada", "banned")).toBe(false)
    expect(matchesAdminUserFilters(bannedUser, "ada", "banned")).toBe(true)
    expect(matchesAdminUserFilters(bannedUser, "grace", "banned")).toBe(false)
  })
})
