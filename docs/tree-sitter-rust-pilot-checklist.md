# Tree-sitter Rust Pilot Checklist

## Goal

Improve Rust parsing quality in `packages/analyzer` without forcing a whole-repo parser migration.

## Slice 1: Spike (`S`)

- add Tree-sitter runtime and Rust grammar dependencies to `packages/analyzer`
- create a tiny parser wrapper that can parse one Rust file into a syntax tree
- add one smoke test proving the wrapper can parse a representative Rust source snippet
- confirm the runtime works in the current Bun/TypeScript environment

## Slice 2: Units and Complexity (`M`)

- replace heuristic Rust unit extraction with Tree-sitter-backed extraction
- map syntax-tree nodes into existing `UnitInfo`
- support:
  - top-level functions
  - methods inside `impl`
  - `async fn`
  - multiline parameter lists
  - generic signatures
- calculate complexity from syntax nodes rather than regex-only scanning
- add red/green tests for tricky Rust constructs

## Slice 3: Dependencies (`L`)

- extract Rust `use` declarations into `DependenciesAnalysis`
- support:
  - simple imports
  - grouped imports
  - nested paths
  - aliased imports where the original path is still known
- keep the output conservative when syntax does not give deterministic meaning
- add tests for explicit dependency fixtures

## Slice 4: Adapter Hardening (`L`)

- move Rust parsing helpers into a reusable internal adapter module
- isolate syntax traversal helpers so future languages can reuse the same pattern
- document the boundary between parser syntax extraction and later semantic heuristics
- benchmark the parser on a small Rust fixture set and record basic runtime expectations

## Slice 5: Expansion Decision (`XL`)

- review whether the Rust pilot produced meaningfully better:
  - unit extraction
  - complexity accuracy
  - dependency coverage
- if yes, decide whether to:
  - extend Tree-sitter to another high-value language
  - generalize the adapter API
  - leave Tree-sitter limited to Rust for now

## Tests

- add analyzer tests before implementation changes where practical
- keep the assertions focused on:
  - unit names
  - line ranges
  - parameter counts
  - complexity counts
  - dependency paths
- run at minimum:
  - `bun test packages/analyzer/src`
  - `bun run typecheck`

## Definition of Done for the Pilot

- Rust parsing is syntax-tree-backed for units
- Rust dependency extraction is no longer always empty for explicit imports
- no report or CLI contract breaks are introduced
- the pilot defines a reusable integration pattern rather than a one-off hack
