// @ts-check
import react from "@astrojs/react";
import { defineConfig, envField, fontProviders } from "astro/config";
import icon from "astro-icon";
import tunnel from "astro-tunnel";

// https://astro.build/config
export default defineConfig({
	base: "/planetnik",
	env: {
		schema: {
			PLANETNIK_DATA_DIR: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			PLANETNIK_LANDSCAPE_DATA_DIR: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			PLANETNIK_DATASETS_ROOT: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			PLANETNIK_DATASET: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			PUBLIC_COPILOT_RUNTIME_URL: envField.string({
				context: "client",
				access: "public",
				optional: true,
				default: "http://localhost:4111/api/copilotkit",
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
	security: {
		csp: false,
	},
	experimental: {
		incrementalBuild: true,
	},
	build: {
		concurrency: 1,
	},
	vite: {
		optimizeDeps: {
			include: [
				"@visx/axis",
				"@visx/grid",
				"@visx/group",
				"@visx/heatmap",
				"@visx/hierarchy",
				"@visx/legend",
				"@visx/responsive",
				"@visx/scale",
				"@visx/shape",
				"@visx/text",
				"@visx/tooltip",
				"@copilotkit/react-core",
				"@copilotkit/react-ui",
			],
		},
		resolve: {
			dedupe: [
				"react",
				"react-dom",
				"react/jsx-runtime",
				"react/jsx-dev-runtime",
			],
		},
	},
	integrations: [react(), icon(), tunnel()],
});
