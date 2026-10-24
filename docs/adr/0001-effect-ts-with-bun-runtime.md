# ADR-0001: Effect TS with Bun Runtime

## Status

Accepted

## Context

Płanetnik is a 1:1 port of Sokrates (Java 17 / Maven) — a static code analysis tool supporting 50+ languages. We need to choose a TypeScript framework and runtime for the port.

The original Java codebase relies on:

- Multi-module Maven builds with clear dependency boundaries
- Jackson for JSON serialization/deserialization of config (`sokrates.json`)
- Apache Commons CLI for command-line interface
- JGit for git history extraction
- JavaFX for GUI (deferred to Phase 2 as Astro + visx web UI)

## Decision

We will use **Effect TS** as the core framework running on **Bun**.

### Stack choices

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Bun | Fast startup, native TS, built-in test runner, workspace monorepo support |
| Core framework | Effect | Structured errors, services/layers (replaces DI), composable pipelines |
| CLI | `@effect/cli` | Type-safe CLI with built-in help, completion, wizard mode |
| Schema/JSON | `@effect/schema` | Replaces Jackson — encode/decode with validation, default values, transformations |
| File I/O | `@effect/platform` | Cross-platform filesystem, path handling |
| Git | `simple-git` | Lightweight wrapper around git CLI (replaces JGit) |
| Frontend (Phase 2) | Astro + visx | Replaces JavaFX codeexplorer |

### Monorepo structure

- `packages/common` — shared types, utils, rendering (← Java `common/`)
- `packages/analyzer` — analysis engine, language analyzers (← Java `codeanalyzer/`)
- `packages/reports` — HTML report generation (← Java `reports/`)
- `apps/cli` — CLI application (← Java `cli/`)

## Consequences

- **Effect learning curve**: Contributors need familiarity with Effect's `Effect.gen`, services, layers, and schema patterns
- **Bun compatibility**: Some npm packages may not work under Bun; we use `@effect/platform-node` (which works under Bun) instead of `@effect/platform-bun` to avoid transitive dependency issues
- **Type safety**: Effect Schema gives us runtime validation that Jackson provided in Java, with compile-time type inference as a bonus
- **Testability**: Effect services/layers make dependency injection trivial for testing

## More Information

### 2026-10-24 — Effect 4 migration

The dependency upgrade explicitly requested by the user adopts Effect 4.0.6 and
matching platform integrations through the root workspace catalog. The original
package names above describe the initial decision: CLI now comes from
`effect/cli`, Schema and filesystem APIs from `effect`, and platform services
remain in `@effect/platform-node`. Import platform implementations by subpath so
the CLI does not load unrelated optional provider dependencies.

Services use `Context.Service`; typed outcomes use `Effect.result`; schema
defaults use `withDecodingDefaultType` with lazy effects. The existing defaults,
configuration contracts, logging, scoped cleanup and retry bounds remain the
migration's regression requirements. Property tests derived from Schema use
Effect's native `Arbitrary`; other property tests import `fast-check` directly.

See [the dependency upgrade record](../superpowers/plans/2026-10-24-dependency-upgrade.md).
