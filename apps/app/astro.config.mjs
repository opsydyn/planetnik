// @ts-check
import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig, envField, fontProviders, memoryCache } from "astro/config";

export default defineConfig({
	output: "server",
	adapter: node({
		mode: "standalone",
	}),
	env: {
		schema: {
			SHOW_INTELLIGENCE: envField.string({
				context: "server",
				access: "secret",
				optional: true,
				default: "false",
			}),
			PUBLIC_SERVER_URL: envField.string({
				context: "client",
				access: "public",
				optional: true,
				default: "http://localhost:1337",
			}),
		},
	},
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Atkinson Hyperlegible Mono",
			cssVariable: "--font-body",
			weights: [400, 500, 600, 700],
			styles: ["normal"],
			subsets: ["latin"],
			fallbacks: ["monospace"],
		},
		{
			provider: fontProviders.google(),
			name: "Space Grotesk",
			cssVariable: "--font-heading",
			weights: [500, 600, 700],
			styles: ["normal"],
			subsets: ["latin"],
			fallbacks: ["sans-serif"],
		},
	],
	cache: { provider: memoryCache() },
	integrations: [react()],
});
