import { CopilotRuntime, copilotRuntimeNodeHttpEndpoint, OpenAIAdapter } from "@copilotkit/runtime"
import Elysia from "elysia"

const model = process.env.COPILOT_MODEL ?? "gpt-4o"
const serviceAdapter = new OpenAIAdapter({ model })
const runtime = new CopilotRuntime()

const copilotHandler = copilotRuntimeNodeHttpEndpoint({
	runtime,
	serviceAdapter,
	endpoint: "/api/copilotkit",
})

export const copilotRoutes = new Elysia().post("/api/copilotkit", ({ request }) =>
	copilotHandler(request),
)
