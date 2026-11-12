// @ts-check
import react from "@astrojs/react"
import foldkit from "@opsydyn/astro-foldkit"
import { defineConfig, envField } from "astro/config"

// Strangler target for apps/site. React stays registered so unported islands
// can be retained rather than blocking a page: astro-foldkit claims a component
// only when it carries the __foldkit marker, so the two renderers coexist.
export default defineConfig({
  base: "/planetnik",
  env: {
    schema: {
      PLANETNIK_DATA_DIR: envField.string({ context: "server", access: "secret", optional: true }),
      PLANETNIK_LANDSCAPE_DATA_DIR: envField.string({ context: "server", access: "secret", optional: true }),
      PLANETNIK_DATASETS_ROOT: envField.string({ context: "server", access: "secret", optional: true }),
      PLANETNIK_DATASET: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
  build: { concurrency: 1 },
  integrations: [foldkit(), react()],
})
