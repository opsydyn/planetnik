import { CopilotRuntime, copilotRuntimeNodeHttpEndpoint, OpenAIAdapter } from "@copilotkit/runtime"
import Elysia from "elysia"

const model = process.env.COPILOT_MODEL ?? "gpt-4o"

function makeCopilotHandler() {
	const serviceAdapter = new OpenAIAdapter({ model })
	const runtime = new CopilotRuntime()
	return copilotRuntimeNodeHttpEndpoint({
		runtime,
		serviceAdapter,
		endpoint: "/api/copilotkit",
	})
}

let copilotHandler: ReturnType<typeof copilotRuntimeNodeHttpEndpoint> | null = null

export const copilotRoutes = new Elysia().post("/api/copilotkit", ({ request }) => {
	if (!process.env.OPENAI_API_KEY) {
		return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
			status: 503,
			headers: { "Content-Type": "application/json" },
		})
	}
	copilotHandler ??= makeCopilotHandler()
	return copilotHandler(request)
})
