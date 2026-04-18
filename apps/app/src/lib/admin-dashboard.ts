export const ADMIN_PASSWORD_MIN_LENGTH = 8

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AdminEditableRole = "user" | "admin"
export type AdminUserRole = string | string[] | null | undefined
export type AdminUserStatusFilter = "all" | "active" | "banned"

export type AdminUserRecord = {
  id: string
  name: string
  email: string
  role: AdminUserRole
  emailVerified: boolean
  banned: boolean
  createdAt: string
  updatedAt: string
}

export type AdminUserDraft = {
  name: string
  email: string
  role: AdminEditableRole
  password: string
}

export type AdminPasswordDraft = {
  userId: string | null
  userLabel: string
  password: string
  confirmPassword: string
}

export function createEmptyAdminUserDraft(): AdminUserDraft {
  return {
    name: "",
    email: "",
    role: "user",
    password: "",
  }
}

export function createAdminUserDraftFromUser(user: Pick<AdminUserRecord, "name" | "email" | "role">): AdminUserDraft {
  return {
    name: user.name,
    email: user.email,
    role: toAdminEditableRole(user.role),
    password: "",
  }
}

export function createEmptyAdminPasswordDraft(): AdminPasswordDraft {
  return {
    userId: null,
    userLabel: "",
    password: "",
    confirmPassword: "",
  }
}

export function createAdminPasswordDraft(user: Pick<AdminUserRecord, "id" | "name" | "email">): AdminPasswordDraft {
  return {
    userId: user.id,
    userLabel: user.name || user.email,
    password: "",
    confirmPassword: "",
  }
}

export function formatAdminUserRole(role: AdminUserRole): string {
  if (Array.isArray(role)) {
    return role.filter((value) => value.trim().length > 0).join(", ") || "user"
  }

  if (typeof role === "string" && role.trim().length > 0) {
    return role.trim()
  }

  return "user"
}

export function normalizeAdminUser(input: {
  id: string
  name?: string | null
  email: string
  role?: AdminUserRole
  emailVerified?: boolean | null
  banned?: boolean | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}): AdminUserRecord {
  return {
    id: input.id,
    name: input.name?.trim() || "Unnamed user",
    email: input.email.trim().toLowerCase(),
    role: input.role,
    emailVerified: Boolean(input.emailVerified),
    banned: Boolean(input.banned),
    createdAt: normalizeDateLike(input.createdAt),
    updatedAt: normalizeDateLike(input.updatedAt),
  }
}

export function validateAdminUserDraft(draft: AdminUserDraft, mode: "create" | "edit"): string | null {
  if (!draft.name.trim()) {
    return "User name is required."
  }

  if (!EMAIL_PATTERN.test(draft.email.trim().toLowerCase())) {
    return "A valid email address is required."
  }

  if (!draft.role.trim()) {
    return "A role is required."
  }

  if (mode === "create" && draft.password.trim().length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`
  }

  return null
}

export function validateAdminPasswordDraft(draft: AdminPasswordDraft): string | null {
  if (!draft.userId) {
    return "Choose a user before changing a password."
  }

  if (draft.password.trim().length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`
  }

  if (draft.password !== draft.confirmPassword) {
    return "Password confirmation does not match."
  }

  return null
}

export function buildCreateUserPayload(draft: AdminUserDraft): {
  email: string
  name: string
  role: AdminEditableRole
  password?: string
} {
  const password = draft.password.trim()
  return {
    email: draft.email.trim().toLowerCase(),
    name: draft.name.trim(),
    role: draft.role,
    ...(password ? { password } : {}),
  }
}

export function buildUpdateUserData(
  user: Pick<AdminUserRecord, "name" | "email" | "role">,
  draft: AdminUserDraft,
): Partial<{
  name: string
  email: string
  role: AdminEditableRole
}> {
  const data: Partial<{
    name: string
    email: string
    role: AdminEditableRole
  }> = {}
  const trimmedName = draft.name.trim()
  const trimmedEmail = draft.email.trim().toLowerCase()
  const trimmedRole = draft.role

  if (trimmedName !== user.name.trim()) {
    data.name = trimmedName
  }

  if (trimmedEmail !== user.email.trim().toLowerCase()) {
    data.email = trimmedEmail
  }

  if (trimmedRole !== formatAdminUserRole(user.role)) {
    data.role = trimmedRole
  }

  return data
}

export function matchesAdminUserSearch(user: Pick<AdminUserRecord, "name" | "email" | "role">, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  const searchable = [user.name, user.email, formatAdminUserRole(user.role)].join(" ").toLowerCase()

  return searchable.includes(normalizedQuery)
}

export function matchesAdminUserFilters(
  user: Pick<AdminUserRecord, "name" | "email" | "role" | "banned">,
  query: string,
  statusFilter: AdminUserStatusFilter,
): boolean {
  if (!matchesAdminUserSearch(user, query)) {
    return false
  }

  if (statusFilter === "active") {
    return !user.banned
  }

  if (statusFilter === "banned") {
    return user.banned
  }

  return true
}

export function formatAdminDate(value: string): string {
  if (!value) {
    return "Unavailable"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable"
  }

  return parsed.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function getAdminErrorMessage(
  error: { message?: string | null; statusText?: string | null } | null | undefined,
  fallback: string,
): string {
  return error?.message || error?.statusText || fallback
}

function normalizeDateLike(value: string | Date | null | undefined): string {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string") {
    return value
  }

  return ""
}

function toAdminEditableRole(role: AdminUserRole): AdminEditableRole {
  return formatAdminUserRole(role) === "admin" ? "admin" : "user"
}
