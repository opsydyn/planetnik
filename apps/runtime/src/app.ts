import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { appConfig } from "./config.js";
import { authRoutes } from "./routes/auth/index.js";
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
		.use(authRoutes);
}

export type PlanetnikRuntimeApp = ReturnType<typeof createApp>;
