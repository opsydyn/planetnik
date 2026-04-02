import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { appConfig } from "./config.js";
import { authRoutes } from "./routes/auth/index.js";
import { healthRoutes } from "./routes/health/index.js";

export function createApp() {
	return new Elysia({ name: "planetnik-runtime" })
		.use(
			cors({
				origin: appConfig.corsOrigins,
				credentials: true,
			}),
		)
		.use(healthRoutes)
		.use(authRoutes);
}
