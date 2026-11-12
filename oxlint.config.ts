import { defineConfig } from "oxlint"

/**
 * Lint configuration, migrated from biome.json (Biome 2.6.2, `recommended`).
 *
 * The rule set is scoped to behavioural parity with the preset it replaces, so
 * the switch is a tool change and not a new backlog. Every rule turned off or
 * downgraded below carries the reason, and the downgraded React rules carry
 * their finding count on the day they were added (2026-11-11) so the backlog
 * can be burned down and the line removed.
 */
export default defineConfig({
  plugins: ["typescript", "react", "jsx-a11y"],
  jsPlugins: [{ name: "foldkit", specifier: "@foldkit/oxlint-plugin" }],
  categories: {
    correctness: "error",
    suspicious: "error",
  },
  rules: {
    // --- Rules Biome's `recommended` preset did not enforce ---

    // False positive under the automatic JSX runtime, which every app here uses
    // (`jsx: "react-jsx"`). 1886 findings, none of them real.
    "react/react-in-jsx-scope": "off",
    // Ambient declarations cannot be expressed as ECMAScript imports: Astro's
    // generated env types and the tree-sitter wasm asset types need the
    // directive.
    "typescript/triple-slash-reference": "off",
    // Pure naming style, and `_name` is the repo's convention for an
    // intentionally unused binding. 99 findings.
    "eslint/no-underscore-dangle": "off",
    // Shadowing is idiomatic in the pipe/callback style used throughout, and
    // Biome shipped this rule in nursery only. 64 findings.
    "eslint/no-shadow": "off",

    // --- Exemptions carried over verbatim from biome.json ---

    // Many Java Sokrates utility classes port as static-only classes.
    "typescript/no-extraneous-class": "off",
    // Used sparingly for Java parity.
    "typescript/no-non-null-assertion": "off",
    // Biome had `noExplicitAny` off.
    "typescript/no-explicit-any": "off",

    // --- Backlog: findings in the React islands the FoldKit port replaces ---
    // Downgraded rather than fixed, because fixing them means changing effect,
    // ref and accessibility behaviour in code that ships today, which is a
    // separate change from swapping the linter. Counts are as at 2026-11-11.

    // 42 findings, of which 30 are `<svg role="img">`. That is the recommended
    // pattern for an accessible inline graphic and cannot be rewritten as an
    // `<img>` tag, so most of this rule's output here is not actionable. Biome's
    // equivalent (`useSemanticElements`) flagged only 3 of the 42; those 3 keep
    // their inline reason, which no longer binds because this rule reports at
    // the `role` attribute rather than at the element.
    "jsx-a11y/prefer-tag-over-role": "warn",
    "jsx-a11y/control-has-associated-label": "warn", // 5
    "jsx-a11y/no-noninteractive-element-interactions": "warn", // 2

    "react/set-state-in-effect": "warn", // 24
    "react/refs": "warn", // 10
    "react/no-unstable-nested-components": "warn", // 8
    "react/exhaustive-effect-dependencies": "warn", // 2
    "react/preserve-manual-memoization": "warn", // 1
    "react-hooks/exhaustive-deps": "warn", // 1
  },
  overrides: [
    {
      // FoldKit application conventions, for the islands replacing React.
      files: ["packages/report-view-foldkit/**/*.ts", "apps/foldkit-site/src/**/*.ts"],
      rules: {
        "foldkit/no-noop-message": "error",
        "foldkit/got-submodel-message-name": "error",
        "foldkit/got-prefix-requires-submodel-payload": "error",
        "foldkit/no-empty-object-tagged-call": "error",
        "foldkit/prefer-callable-message-constructor": "error",
        "foldkit/command-binding-matches-name": "error",
        "foldkit/no-module-level-mutable-state": "error",
        "foldkit/mount-factory-must-use-element": "error",
      },
    },
    {
      // Carried over from biome.json: charts attach pointer handlers to SVG
      // shapes, which have no interactive role to assign.
      files: ["apps/site/src/components/charts/**/*.tsx", "packages/report-ui/src/charts/**/*.tsx"],
      rules: { "jsx-a11y/no-static-element-interactions": "off" },
    },
  ],
  ignorePatterns: [
    "**/dist/**",
    "**/node_modules/**",
    "**/.astro/**",
    "apps/**/*.open-api.json",
    "apps/site/public/**",
    "apps/app/public/**",
  ],
})
