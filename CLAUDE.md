# Planetnik

TypeScript port of [Sokrates](https://github.com/zeljkoobrenovic/sokrates) — a static code analysis tool for 50+ programming languages. The Java source lives at `/Users/alan/Projects/sokrates`.

## Goal

100% feature parity with Java Sokrates, **except** language analyzer implementations (using `DefaultLanguageAnalyzer` for now) and the JavaFX GUI (`codeexplorer` module, deferred to Phase 2 as a web UI).

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode, `exactOptionalPropertyTypes`)
- **Core framework:** Effect (services, layers, error handling, concurrency)
- **CLI:** `@effect/cli`
- **Schema/validation:** `@effect/schema` (replaces Jackson JSON mapping)
- **File I/O:** `@effect/platform` (FileSystem, Path)
- **Git:** `simple-git`
- **Linting/formatting:** Biome (2-space indent, double quotes, no semicolons, 120 line width)
- **Testing:** `bun:test`

## Monorepo Structure

```
planetnik/
├── packages/
│   ├── common/       # Shared types, JSON I/O, rendering utils, palettes
│   ├── analyzer/     # Core analysis engine, models, git history, duplication
│   └── reports/      # HTML report generation, chart utils, data exporters
├── apps/
│   ├── cli/          # Effect CLI application (sokrates commands)
│   ├── docs/         # Documentation site
│   └── site/         # Project website
```

### Java → TS Module Mapping

| Java Module | TS Package | Notes |
|---|---|---|
| `common/` | `packages/common/` | Palette, FormattingUtils, JSON I/O |
| `codeanalyzer/` | `packages/analyzer/` | Models, analysis pipeline, git history |
| `reports/` | `packages/reports/` | HTML reports, charts, utility renderers |
| `cli/` | `apps/cli/` | Effect CLI commands |
| `codeexplorer/` | _(Phase 2)_ | JavaFX GUI → future web UI |

## Commands

```bash
bun install          # Install all dependencies
bun run build        # Build all packages
bun test             # Run all tests (currently 439 tests, 1038 assertions)
bun run typecheck    # TypeScript type checking
bun run lint         # Biome lint check
bun run lint:fix     # Biome auto-fix
bun run knip         # Dead code detection
```

## Conventions

### Code Style
- **Biome** handles all formatting and linting — run `bunx biome check --write .` before committing
- Imports must be alphabetically ordered by source path (Biome enforces this)
- `noStaticOnlyClass` is disabled — many Java utility classes port as static-only classes
- `noNonNullAssertion` is disabled — used sparingly for Java parity
- All `.ts` imports use `.js` extensions (ESM convention)

### Development Approach
- **TDD** — write tests first, then implement, commit when green
- Port Java classes maintaining the same structure and behavior (1:1 parity)
- When a Java class references `LanguageAnalyzer`, use `DefaultLanguageAnalyzer` for now
- Keep Java class names and method signatures where possible for traceability

### Package Exports
Each package uses barrel exports (`index.ts`) at module and package level. When adding new files:
1. Export from the module's `index.ts` (e.g., `packages/analyzer/src/githistory/index.ts`)
2. Re-export from the package's root `index.ts` (e.g., `packages/analyzer/src/index.ts`)

### Testing
- Tests live in `src/__tests__/` within each package
- Test files are named `{Feature}.test.ts`
- Use `describe`/`test` from `bun:test`
- Aim for behavioral coverage matching Java test cases where they exist

## Key Reference Files in Java Sokrates

When porting, cross-reference these Java files at `/Users/alan/Projects/sokrates`:

- `cli/src/main/java/.../CommandLineInterface.java` — all CLI commands
- `codeanalyzer/src/main/java/.../analysis/CodeAnalyzer.java` — analysis pipeline
- `codeanalyzer/src/main/java/.../core/CodeConfiguration.java` — main config model
- `codeanalyzer/src/main/java/.../lang/LanguageAnalyzer.java` — language analyzer interface
- `codeanalyzer/src/main/java/.../lang/LanguageAnalyzerFactory.java` — 50+ language mappings
- `reports/src/main/java/.../generators/statichtml/BasicSourceCodeReportGenerator.java` — reports

## Parity Tracking

See [TODO.md](TODO.md) for the full prioritized checklist of remaining gaps.
