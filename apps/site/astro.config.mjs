// @ts-check
import react from "@astrojs/react"
import { defineConfig } from "astro/config"
import tunnel from "astro-tunnel"

// https://astro.build/config
export default defineConfig({
	integrations: [react(), tunnel()],
})
