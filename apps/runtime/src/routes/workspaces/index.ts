import { Schema } from "effect"
import { Elysia } from "elysia"
import { auth } from "../../lib/auth.js"
import { ensurePersonalWorkspace } from "../../lib/personal-workspace.js"

const WorkspaceSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  ownerUserId: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

const WorkspacesResponseSchema = Schema.Struct({
  workspaces: Schema.Array(WorkspaceSchema),
})

const UnauthorizedResponseSchema = Schema.Struct({
  error: Schema.Literal("unauthorized"),
})

const decodeWorkspacesResponse = Schema.decodeUnknownSync(WorkspacesResponseSchema)

export const workspaceRoutes = new Elysia({ name: "workspaces" }).get(
  "/api/workspaces",
  async ({ request, set }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.session || !session.user) {
      set.status = 401

      return {
        error: "unauthorized" as const,
      }
    }

    const personalWorkspace = await ensurePersonalWorkspace(session)

    return decodeWorkspacesResponse({
      workspaces: [
        {
          id: personalWorkspace.id,
          slug: personalWorkspace.slug,
          name: personalWorkspace.name,
          ownerUserId: personalWorkspace.ownerUserId,
          createdAt: personalWorkspace.createdAt.toISOString(),
          updatedAt: personalWorkspace.updatedAt.toISOString(),
        },
      ],
    })
  },
  {
    response: {
      200: Schema.toStandardSchemaV1(WorkspacesResponseSchema),
      401: Schema.toStandardSchemaV1(UnauthorizedResponseSchema),
    },
    detail: {
      summary: "List workspaces for the authenticated user",
      tags: ["Workspaces"],
    },
  },
)
