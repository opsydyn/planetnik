import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { JSONSchema } from "effect";
import { Elysia } from "elysia";
import { appConfig } from "./config.js";
import { authRoutes } from "./routes/auth/index.js";
import { copilotRoutes } from "./routes/copilot/index.js";
import { healthRoutes } from "./routes/health/index.js";
import { meRoutes } from "./routes/me/index.js";
import { reportRoutes } from "./routes/reports/index.js";
import { workspaceRoutes } from "./routes/workspaces/index.js";

export function createApp() {
	return new Elysia({ name: "planetnik-runtime" })
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
						description:
							"Authenticated runtime APIs for the hosted Planetnik application.",
					},
				},
				mapJsonSchema: {
					effect: JSONSchema.make,
				},
			}),
		);
}

export type PlanetnikRuntimeApp = ReturnType<typeof createApp>;
