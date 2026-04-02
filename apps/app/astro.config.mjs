// @ts-check
import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
	output: "server",
	adapter: node({
		mode: "standalone",
	}),
	env: {
		schema: {
			PUBLIC_SERVER_URL: envField.string({
				context: "client",
				access: "public",
				optional: true,
				default: "http://localhost:1337",
			}),
		},
	},
	experimental: {
		rustCompiler: true,
		queuedRendering: {
			enabled: true,
		},
	},
	integrations: [react()],
});
