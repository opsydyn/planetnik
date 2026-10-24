import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { Elysia } from "elysia"

type OpenApiPropertySchema = {
  readonly enum?: readonly string[]
}

type OpenApiMediaSchema = {
  readonly schema: {
    readonly properties: Record<string, OpenApiPropertySchema>
  }
}

type OpenApiOperation = {
  readonly responses: Record<
    string,
    {
      readonly content: Record<string, OpenApiMediaSchema>
    }
  >
}

process.env.NODE_ENV ??= "test"
process.env.PORT ??= "1337"
process.env.CORS_ORIGIN ??= "http://localhost:4321"
process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/planetnik?sslmode=disable"
process.env.BETTER_AUTH_SECRET ??= "test-secret-with-at-least-32-characters"
process.env.BETTER_AUTH_URL ??= "http://localhost:1337"
process.env.AUTH_COOKIE_SECURE ??= "false"
process.env.AUTH_COOKIE_SAME_SITE ??= "lax"

describe("runtime OpenAPI", () => {
  test("documents optional fields without accepting null while preserving explicit nullable fields", async () => {
    const { createApp } = await import("../app.js")
    const responseSchema = Schema.Struct({
      optionalName: Schema.optional(Schema.String),
      nullableName: Schema.NullOr(Schema.String),
      optionalNullableName: Schema.optional(Schema.NullOr(Schema.String)),
      nested: Schema.Array(Schema.Struct({ label: Schema.optional(Schema.String) })),
    })
    expect(() =>
      Schema.decodeUnknownSync(responseSchema)({ optionalName: null, nullableName: null, nested: [] }),
    ).toThrow()
    const app = new Elysia()
      .use(await createApp())
      .get("/schema-optionals", () => ({ nullableName: null, nested: [] }), {
        response: { 200: Schema.toStandardSchemaV1(responseSchema) },
      })
    const response = await app.handle(new Request("http://localhost:1337/openapi/json"))
    const spec = (await response.json()) as {
      readonly paths: Record<string, { readonly get: OpenApiOperation }>
    }
    const schema = spec.paths["/schema-optionals"]?.get.responses["200"]?.content["application/json"]?.schema
    expect(schema).toMatchObject({
      additionalProperties: false,
      properties: {
        optionalName: { type: "string" },
        nullableName: { type: ["string", "null"] },
        optionalNullableName: { type: ["string", "null"] },
        nested: { items: { properties: { label: { type: "string" } } } },
      },
      required: ["nullableName", "nested"],
    })
  })

  test("keeps named Effect schema definitions available to generated references", async () => {
    const { createApp } = await import("../app.js")
    const namedSchema = Schema.Struct({ name: Schema.String }).annotate({ identifier: "OpenApiContractUser" })
    const app = new Elysia().use(await createApp()).get("/schema-contract", () => ({ name: "Example" }), {
      response: { 200: Schema.toStandardSchemaV1(namedSchema) },
    })
    const response = await app.handle(new Request("http://localhost:1337/openapi/json"))
    expect(response.status).toBe(200)
    const spec = (await response.json()) as {
      readonly paths: Record<string, { readonly get: OpenApiOperation }>
    }
    const schema = spec.paths["/schema-contract"]?.get.responses["200"]?.content["application/json"]?.schema
    expect(schema).toMatchObject({
      $ref: "#/$defs/OpenApiContractUser",
      $defs: { OpenApiContractUser: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    })
  })

  test("serves an OpenAPI spec that includes stable first-party routes", async () => {
    const { createApp } = await import("../app.js")
    const app = await createApp()

    const response = await app.handle(new Request("http://localhost:1337/openapi/json"))

    expect(response.status).toBe(200)

    const spec = (await response.json()) as {
      readonly openapi: string
      readonly paths: Record<string, unknown>
    }
    const healthGet = (
      spec.paths["/health"] as {
        readonly get: OpenApiOperation
      }
    ).get
    const meGet = (
      spec.paths["/api/me"] as {
        readonly get: OpenApiOperation
      }
    ).get
    const healthStatusEnum = healthGet.responses["200"]?.content["application/json"]?.schema.properties.status?.enum
    const unauthorizedErrorEnum = meGet.responses["401"]?.content["application/json"]?.schema.properties.error?.enum

    expect(spec.openapi).toStartWith("3.")
    expect(spec.paths).toHaveProperty("/health")
    expect(spec.paths).toHaveProperty("/api/me")
    expect(spec.paths).toHaveProperty("/api/workspaces")
    expect(healthStatusEnum).toEqual(["ok"])
    expect(unauthorizedErrorEnum).toEqual(["unauthorized"])
  }, 15000)
})
