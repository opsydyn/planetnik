// @ts-check
import react from "@astrojs/react"
import { defineConfig, envField, fontProviders } from "astro/config"
import icon from "astro-icon"
import tunnel from "astro-tunnel"

// https://astro.build/config
export default defineConfig({
  env: {
    schema: {
      PLANETNIK_DATA_DIR: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Roboto",
      cssVariable: "--font-ui",
      weights: [400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["system-ui", "sans-serif"],
    },
  ],
  security: {
    csp: {
      directives: ["font-src 'self' data:"],
    },
  },
  experimental: {
    rustCompiler: true,
    queuedRendering: {
      enabled: true,
      contentCache: true,
    },
  },
  vite: {
    resolve: {
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  },
  integrations: [react(), icon(), tunnel()],
})
