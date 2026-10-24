import { Schema } from "effect"
import { Elysia } from "elysia"
import { auth } from "../../lib/auth.js"

const MeResponseSchema = Schema.Struct({
  user: Schema.Struct({
    id: Schema.String,
    email: Schema.String,
    name: Schema.NullOr(Schema.String),
    image: Schema.NullOr(Schema.String),
    emailVerified: Schema.Boolean,
    role: Schema.NullOr(Schema.String),
  }),
  session: Schema.Struct({
    id: Schema.String,
    userId: Schema.String,
    expiresAt: Schema.String,
  }),
})

const UnauthorizedResponseSchema = Schema.Struct({
  error: Schema.Literal("unauthorized"),
})

const decodeMeResponse = Schema.decodeUnknownSync(MeResponseSchema)

export const meRoutes = new Elysia({ name: "me" }).get(
  "/api/me",
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

    const userRole = Reflect.get(session.user, "role")

    return decodeMeResponse({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        emailVerified: session.user.emailVerified,
        role: typeof userRole === "string" ? userRole : null,
      },
      session: {
        id: session.session.id,
        userId: session.session.userId,
        expiresAt: session.session.expiresAt.toISOString(),
      },
    })
  },
  {
    response: {
      200: Schema.toStandardSchemaV1(MeResponseSchema),
      401: Schema.toStandardSchemaV1(UnauthorizedResponseSchema),
    },
    detail: {
      summary: "Authenticated user and session summary",
      tags: ["Auth", "Users"],
    },
  },
)
