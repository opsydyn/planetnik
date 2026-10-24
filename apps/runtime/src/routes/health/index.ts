import { Schema } from "effect"
import { Elysia } from "elysia"
import { appConfig } from "../../config.js"

const NodeEnvironmentSchema = Schema.Literals(["development", "test", "production"])
const HealthResponseSchema = Schema.Struct({
  status: Schema.Literal("ok"),
  service: Schema.Literal("planetnik-runtime"),
  nodeEnv: NodeEnvironmentSchema,
})

type HealthResponse = typeof HealthResponseSchema.Type

const decodeHealthResponse = Schema.decodeUnknownSync(HealthResponseSchema)

export const healthRoutes = new Elysia({ name: "health" }).get(
  "/health",
  () => {
    const response: HealthResponse = {
      status: "ok",
      service: "planetnik-runtime",
      nodeEnv: appConfig.nodeEnv,
    }

    return decodeHealthResponse(response)
  },
  {
    response: {
      200: Schema.toStandardSchemaV1(HealthResponseSchema),
    },
    detail: {
      summary: "Runtime health check",
      tags: ["Health"],
    },
  },
)
