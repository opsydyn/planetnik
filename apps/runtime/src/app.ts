import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import { Elysia } from "elysia"
import { appConfig } from "./config.js"
import { toOpenApiJsonSchema } from "./lib/openapi-schema.js"
import { authRoutes } from "./routes/auth/index.js"
import { copilotRoutes } from "./routes/copilot/index.js"
import { healthRoutes } from "./routes/health/index.js"
import { meRoutes } from "./routes/me/index.js"
import { reportRoutes } from "./routes/reports/index.js"
import { workspaceRoutes } from "./routes/workspaces/index.js"

const runtimeRoot = fileURLToPath(new URL("../", import.meta.url))
const shouldEnableOpenApiLint = appConfig.nodeEnv === "development"
const openApiLintModuleName = ["@opsydyn", "elysia-spectral"].join("/")
const openApiLintJsonReportPath = join(runtimeRoot, "artifacts", "openapi-lint.json")
const openApiLintSpecSnapshotPath = join(runtimeRoot, "planetnik-runtime.open-api.json")

type SpectralModule = typeof import("@opsydyn/elysia-spectral")

function logOpenApiLintUnavailable(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error)
  console.warn(`OpenAPI linting unavailable; continuing without Spectral. ${detail}`)
}

export async function createApp() {
  const app = new Elysia({ name: "planetnik-runtime" })
    .onError(({ code, error, request, path, set }) => {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      console.error(`[runtime] unhandled error code=${code} ${request.method} ${path}: ${message}`, stack ?? error)
      if (code === "NOT_FOUND" || code === "VALIDATION") {
        return
      }
      set.status = 500
      return {
        error: "internal_error",
        code,
        ...(appConfig.nodeEnv === "production" ? {} : { detail: message }),
      }
    })
    .use(
      cors({
        origin: appConfig.corsOrigins,
        credentials: true,
      }),
    )
    .use(healthRoutes)
    .use(meRoutes)
    .use(workspaceRoutes)
    .use(reportRoutes)
    .use(authRoutes)
    .use(copilotRoutes)
    .use(
      openapi({
        path: "/openapi",
        specPath: "/openapi/json",
        documentation: {
          info: {
            title: "Planetnik Runtime API",
            version: "0.1.0",
            description: "Authenticated runtime APIs for the hosted Planetnik application.",
          },
        },
        mapJsonSchema: {
          effect: toOpenApiJsonSchema,
        },
      }),
    )

  if (!shouldEnableOpenApiLint) {
    return app
  }

  try {
    const { spectralPlugin } = (await import(openApiLintModuleName)) as SpectralModule

    return app.use(
      spectralPlugin({
        preset: "recommended",
        startup: {
          mode: "report",
        },
        output: {
          console: true,
          jsonReportPath: openApiLintJsonReportPath,
          specSnapshotPath: openApiLintSpecSnapshotPath,
          artifactWriteFailures: process.env.CI ? "error" : "warn",
        },
        source: {
          specPath: "/openapi/json",
        },
      }),
    )
  } catch (error) {
    logOpenApiLintUnavailable(error)
    return app
  }
}

export type PlanetnikRuntimeApp = Awaited<ReturnType<typeof createApp>>
