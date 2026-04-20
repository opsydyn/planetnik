import { and, asc, eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { report, workspace } from "../db/schema/app.js"
import type { auth } from "./auth.js"
import { resolveReportDataSource } from "./report-datasets.js"

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
const UNIQUE_VIOLATION_CODE = "23505"

type DatabaseConstraintError = {
  readonly code?: string
  readonly constraint?: string
  readonly message?: string
}

function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

function buildWorkspaceName(session: NonNullable<AuthSession>): string {
  const preferredName = session.user.name?.trim()
  if (preferredName) {
    return `${preferredName}'s Workspace`
  }
  return `${session.user.email} Workspace`
}

function buildWorkspaceSlug(session: NonNullable<AuthSession>): string {
  const preferredName = session.user.name?.trim()
  const base = preferredName || session.user.email.split("@")[0] || session.user.id
  const normalized = slugifySegment(base)
  return normalized ? `workspace-${normalized}` : `workspace-${session.user.id.slice(0, 12)}`
}

function buildIndexedSlug(baseSlug: string, index: number): string {
  return index === 0 ? baseSlug : `${baseSlug}-${index + 1}`
}

function isUniqueConstraintError(error: unknown, constraintName: string): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const candidate = error as DatabaseConstraintError
  if (candidate.code !== UNIQUE_VIOLATION_CODE) {
    return false
  }

  return candidate.constraint === constraintName || candidate.message?.includes(constraintName) === true
}

async function findWorkspaceByOwnerUserId(ownerUserId: string) {
  return db.query.workspace.findFirst({
    where: eq(workspace.ownerUserId, ownerUserId),
  })
}

export async function ensurePersonalWorkspace(session: NonNullable<AuthSession>) {
  const existing = await findWorkspaceByOwnerUserId(session.user.id)

  if (existing) {
    return existing
  }

  const now = new Date()
  const baseSlug = buildWorkspaceSlug(session)

  for (let index = 0; index < 100; index += 1) {
    try {
      await db
        .insert(workspace)
        .values({
          id: crypto.randomUUID(),
          slug: buildIndexedSlug(baseSlug, index),
          name: buildWorkspaceName(session),
          ownerUserId: session.user.id,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: workspace.ownerUserId,
        })
    } catch (error) {
      if (isUniqueConstraintError(error, "workspace_slug_unique")) {
        continue
      }

      throw error
    }

    const created = await findWorkspaceByOwnerUserId(session.user.id)

    if (created) {
      return created
    }
  }

  throw new Error("Failed to resolve personal workspace after creation")
}

export async function listWorkspaceReports(workspaceId: string) {
  const reports = await db.query.report.findMany({
    where: and(eq(report.workspaceId, workspaceId)),
    orderBy: [asc(report.createdAt)],
  })

  return reports.map((entry) => ({
    ...entry,
    analysisRoot: entry.analysisRoot
      ? (resolveReportDataSource({ analysisRoot: entry.analysisRoot })?.dataDir ?? null)
      : null,
  }))
}

export async function findWorkspaceReportBySlug(workspaceId: string, slug: string) {
  const found = await db.query.report.findFirst({
    where: and(eq(report.workspaceId, workspaceId), eq(report.slug, slug)),
  })

  if (!found) {
    return null
  }

  return {
    ...found,
    analysisRoot: found.analysisRoot
      ? (resolveReportDataSource({ analysisRoot: found.analysisRoot })?.dataDir ?? null)
      : null,
  }
}

function buildReportSlug(name: string): string {
  const normalized = slugifySegment(name)
  return normalized || "report"
}

async function ensureUniqueReportSlug(
  workspaceId: string,
  baseSlug: string,
  startIndex = 0,
): Promise<{ readonly slug: string; readonly nextIndex: number }> {
  for (let index = startIndex; index < 100; index += 1) {
    const candidate = buildIndexedSlug(baseSlug, index)
    const existing = await db.query.report.findFirst({
      where: and(eq(report.workspaceId, workspaceId), eq(report.slug, candidate)),
    })

    if (!existing) {
      return {
        slug: candidate,
        nextIndex: index + 1,
      }
    }
  }

  throw new Error("Failed to generate a unique report slug")
}

export async function createWorkspaceReport(input: {
  readonly workspaceId: string
  readonly name: string
  readonly datasetName?: string | null
  readonly analysisRoot?: string | null
}) {
  const now = new Date()
  const baseSlug = buildReportSlug(input.name)
  let nextIndex = 0

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { slug, nextIndex: followingIndex } = await ensureUniqueReportSlug(input.workspaceId, baseSlug, nextIndex)
    const values = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      slug,
      name: input.name,
      kind: "planetnik-report",
      status: input.analysisRoot ? "connected" : "draft",
      analysisRoot: input.analysisRoot ?? null,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: input.analysisRoot ? now : null,
    } as const

    try {
      await db.insert(report).values(values)
      return values
    } catch (error) {
      if (isUniqueConstraintError(error, "report_workspace_slug_unique")) {
        nextIndex = followingIndex
        continue
      }

      throw error
    }
  }

  throw new Error("Failed to generate a unique report slug")
}
