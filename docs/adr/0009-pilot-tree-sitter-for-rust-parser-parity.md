# ADR-0009: Pilot Tree-sitter for Rust Parser Parity

## Status

Accepted

## Context

Planetnik currently analyzes Rust with a generic heuristic path rather than a language-aware parser.

- [RustAnalyzer.ts](/Users/alan/Projects/planetnik/packages/analyzer/src/lang/RustAnalyzer.ts) only extends [CStyleAnalyzer.ts](/Users/alan/Projects/planetnik/packages/analyzer/src/lang/CStyleAnalyzer.ts)
- unit extraction comes from [CStyleHeuristicUnitsExtractor.ts](/Users/alan/Projects/planetnik/packages/analyzer/src/units/CStyleHeuristicUnitsExtractor.ts), which uses regular expressions and brace counting
- Rust dependencies are effectively unsupported because `extractDependencies()` is inherited from `CStyleAnalyzer` and returns an empty `DependenciesAnalysis`

That is acceptable for basic line counting and duplication cleanup, but it is weak for real Rust syntax:

- multiline function signatures
- generics and lifetimes
- `impl` blocks and trait methods
- `async fn`
- `match`-heavy complexity
- `use` trees and module paths

This is now worth capturing as an ADR because:

- it introduces a new parser dependency stack
- it creates a new analyzer implementation pattern that could expand to other languages later
- it affects the correctness of unit size, complexity, and dependency analysis
- it is the kind of foundational technical-debt decision that future agents need to understand before extending language support

This ADR is deliberately narrow. It is not a commitment to replace all analyzers with Tree-sitter immediately.

## Decision

We will pilot Tree-sitter as the parsing strategy for Rust analysis in `packages/analyzer`.

### Core policy

- Adopt Tree-sitter for Rust syntax parsing first.
- Keep the pilot analyzer-focused. No Astro or report contract changes are required to start the pilot.
- Replace Rust unit extraction with Tree-sitter-based extraction.
- Add Rust dependency extraction based on Tree-sitter syntax where it is practical and deterministic.
- Keep existing LOC and duplication-cleaning behavior unless the pilot proves that parser-aware cleanup is clearly better.

### Pilot scope

The first pilot must improve these analyzer capabilities for Rust:

- unit discovery
- unit naming and ranges
- parameter counting
- conditional complexity calculation
- dependency extraction from `use` and module references where the syntax is explicit

### Data model policy

- The pilot must continue to emit the existing `UnitInfo` and `DependenciesAnalysis` shapes so the rest of the pipeline does not need a schema rewrite.
- Tree-sitter is a syntax engine, not a semantic resolver. The pilot must not pretend to perform Cargo-aware name resolution, macro expansion, or full type resolution.
- If a Rust construct cannot be resolved deterministically from syntax alone, the analyzer should prefer partial but correct output over guessed output.

## Why this option

- Tree-sitter is explicitly designed to build concrete syntax trees, update them incrementally, and remain useful in the presence of syntax errors.
- The official Rust grammar already exists upstream.
- Rust is a good pilot language because the current implementation is weak, the language syntax is rich, and the improvement can be measured clearly against the heuristic extractor.
- A Rust-first pilot creates a reusable adapter pattern without forcing a whole-repo parser migration.

## Alternatives Considered

### Keep the current heuristic Rust analyzer

This avoids new dependencies.

We are not choosing it because the current implementation is only a C-style approximation and leaves real Rust parsing quality on the table. The gap is especially visible for unit extraction and dependencies.

### Build a custom Rust-specific regex and brace parser

This would avoid adopting Tree-sitter while still improving the current extractor.

We are not choosing it because Rust syntax is rich enough that the custom-parser path would become an unbounded maintenance problem. It would likely reimplement an inferior parser over time.

### Replace all language analyzers with Tree-sitter immediately

This could create a unified parser architecture.

We are not choosing it because it is too large and too risky for one step. Planetnik should prove the adapter pattern on Rust first, then expand deliberately.

## Consequences

- `packages/analyzer` will gain a parser dependency on Tree-sitter plus the Rust grammar package.
- Rust unit extraction and dependency extraction will become more syntax-aware.
- Analyzer tests will need a stronger fixture set for Rust language features.
- The pilot will likely define an internal adapter seam that later languages can reuse.
- Some Rust behavior may initially become more conservative if the parser now rejects heuristic guesses that were previously emitted.

## Non-goals

- No immediate migration of Java, TypeScript, Python, or other analyzers
- No promise of semantic resolution, macro expansion, or Cargo graph analysis
- No immediate exporter or Astro UI changes
- No attempt to replace the existing duplication-cleaning pipeline during the first pilot

## Related ADRs

- ADR-0002: TDD Approach
- ADR-0003: Backend-Only Parity — Astro Frontend Replaces Java HTML Reports

## Implementation Plan

- **Affected paths**: `packages/analyzer/package.json`, `packages/analyzer/src/lang/`, `packages/analyzer/src/units/`, `packages/analyzer/src/dependencies/`, `packages/analyzer/src/__tests__/`, and any supporting utility files for parser integration
- Add the official Node binding and Rust grammar packages required for a TypeScript runtime integration.
- Create a small Tree-sitter adapter layer under `packages/analyzer/src/lang/` so Rust parsing logic is isolated from the rest of the analyzer.
- Update [RustAnalyzer.ts](/Users/alan/Projects/planetnik/packages/analyzer/src/lang/RustAnalyzer.ts) to use Tree-sitter-backed extraction for units.
- Keep the existing `UnitInfo` shape, but populate it from syntax-tree nodes rather than regex matches.
- Implement Rust-aware complexity counting from syntax-tree constructs such as conditionals, loops, `match`, boolean operators, and error-handling branches where appropriate.
- Implement first-pass Rust dependency extraction from explicit `use` declarations and directly queryable module paths.
- Add focused analyzer tests for:
  - multiline `fn` signatures
  - `impl` methods
  - generic and lifetime-heavy signatures
  - `async fn`
  - `match`-driven complexity
  - `use` declarations and grouped imports
- Compare the new Rust analyzer output against the current heuristic output on representative fixtures and preserve only the changes that are objectively better.
- Keep the pilot self-contained enough that future language expansion can copy the same adapter pattern rather than inventing a second integration style.

## Verification

- [ ] `packages/analyzer` includes the Tree-sitter runtime and Rust grammar needed for the pilot
- [ ] `RustAnalyzer` no longer relies on the generic C-style heuristic extractor for unit extraction
- [ ] Rust unit tests cover multiline signatures, `impl`, generics, lifetimes, and `async fn`
- [ ] Rust complexity extraction reflects syntax-tree constructs rather than regex-only counting
- [ ] Rust dependency extraction produces non-empty results for explicit `use` and module-path fixtures
- [ ] Existing analyzer, reports, and CLI typechecks still pass after the pilot
- [ ] Existing report/export contracts do not require a breaking schema change for the pilot

## References

- Tree-sitter introduction: https://tree-sitter.github.io/tree-sitter/
- Tree-sitter query syntax: https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html
- Official Node bindings: https://github.com/tree-sitter/node-tree-sitter
- Official Rust grammar: https://github.com/tree-sitter/tree-sitter-rust
