import { CopilotRuntime, copilotRuntimeNodeHttpEndpoint, OpenAIAdapter } from "@copilotkit/runtime"
import { createAnalysisActions } from "./actions"

const PORT = Number(process.env.COPILOT_PORT ?? 4111)
const CORS_ORIGIN = process.env.COPILOT_CORS_ORIGIN ?? "http://localhost:4321"
const MODEL = process.env.COPILOT_MODEL ?? "gpt-4o"
const DATA_DIR = process.env.PLANETNIK_DATA_DIR ?? ""

const serviceAdapter = new OpenAIAdapter({ model: MODEL })
const actions = DATA_DIR ? createAnalysisActions() : []
const runtime = new CopilotRuntime({ actions })

const handler = copilotRuntimeNodeHttpEndpoint({
  runtime,
  serviceAdapter,
  endpoint: "/api/copilotkit",
  cors: {
    origin: [CORS_ORIGIN],
  },
})

const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (url.pathname === "/api/copilotkit" && req.method === "POST") {
      const response = await handler(req)
      if (response instanceof Response) {
        for (const [key, value] of Object.entries(corsHeaders)) {
          response.headers.set(key, value)
        }
        return response
      }
      return new Response("Internal error", { status: 500, headers: corsHeaders })
    }

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", model: MODEL, dataDir: DATA_DIR || null, actions: actions.length }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      )
    }

    return new Response("Not found", { status: 404, headers: corsHeaders })
  },
})

console.log(`Copilot Runtime listening on http://localhost:${server.port}`)
console.log(`Model: ${MODEL}`)
console.log(`CORS origin: ${CORS_ORIGIN}`)
console.log(`Data dir: ${DATA_DIR || "(not set — server-side tools disabled)"}`)
console.log(`Server-side actions: ${actions.length}`)
