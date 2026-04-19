# Rust Tree-sitter Migration Discovery

## Why this discovery exists

`docs/adr/0009-pilot-tree-sitter-for-rust-parser-parity.md` captured the decision to pilot Tree-sitter for Rust.
`docs/tree-sitter-rust-pilot-checklist.md` captured the intended execution slices.

This discovery records what actually happened after implementation, targeted TDD, Tokio corpus validation, and local hosted-app validation.
It also defines what “feature complete with the legacy implementation” should mean now that the pilot is no longer hypothetical.

## Executive summary

- Planetnik now uses `web-tree-sitter` + `tree-sitter-rust` in `packages/analyzer` for Rust parsing.
- `RustAnalyzer` kept its existing public analyzer contract while switching internals to syntax-tree-backed unit extraction and conservative `use`-based dependency extraction.
- The migration materially improved correctness on a real Rust corpus.
- The current implementation already exceeds the Java Sokrates Rust baseline in several important areas, especially dependency extraction and false-positive reduction.
- The remaining work is not “match the old heuristic behavior line for line.” It is to harden coverage, benchmark the adapter, add parity-diff automation, and close the remaining report-contract gap discovered in the hosted product flow.

## Legacy baseline versus Planetnik now

The Java Sokrates Rust analyzer is a useful baseline, but it is a modest one.

| Capability | Java Sokrates legacy | Planetnik before pilot | Planetnik now | Status |
| --- | --- | --- | --- | --- |
| Parsing strategy | No parser; heuristic `fn` detection via `RustHeuristicUnitsExtractor` | No parser; generic C-style heuristic path | Tree-sitter-backed Rust parser via WASM | Exceeds legacy |
| Unit discovery | Heuristic lines starting with `fn ` | Heuristic C-style extraction | Syntax-tree-backed `function_item` and `impl_item` extraction | Exceeds legacy |
| Complexity counting | Literal-based heuristic (`if`, `loop`, `while`, `for`, `&&`, `||`, etc.) | Generic C-style complexity heuristics | Syntax-node-driven counting for loops, `if`, `match`, and boolean operators | Exceeds legacy |
| Dependency extraction | Always empty | Always empty | Conservative `use`-based dependency extraction | Exceeds legacy |
| LOC / duplication cleaning | Rust-specific class, but duplication filtering still includes Java-like `import` / `package` cleanup | Generic C-style cleaner | Rust-aware cleaning with `use` / `mod` duplication filtering | Intentionally diverges for correctness |
| Public analyzer contract | Synchronous analyzer methods | Synchronous analyzer methods | Same external analyzer shape retained | Matches legacy |

### Important interpretation

“Feature complete with legacy” should **not** mean reproducing legacy bugs or Java-isms.

Examples of intentional divergence we should keep:

- do **not** reintroduce false-positive units such as `UnsafeCell::new`, `Mutex::new`, `Ok`, or `Ready`
- do **not** regress Rust dependency extraction back to an always-empty result just because legacy had no dependencies support
- do **not** preserve Java-flavored duplication filters like `import .*;` and `package .*` in Rust logic

The right goal is: preserve or exceed the intended Rust analysis capability of the legacy implementation, while documenting where the TypeScript port is intentionally more correct.

## What landed in the pilot

### Analyzer implementation

The pilot introduced these main implementation pieces:

- `packages/analyzer/src/lang/RustAnalyzer.ts`
- `packages/analyzer/src/lang/rust/TreeSitterRustParser.ts`
- `packages/analyzer/src/lang/rust/RustTreeSitterUnitsExtractor.ts`
- `packages/analyzer/src/lang/rust/RustTreeSitterDependenciesExtractor.ts`

The current integration pattern is:

1. initialize the Rust grammar once through `web-tree-sitter`
2. keep `RustAnalyzer` as the stable entrypoint
3. route units and dependencies through Rust-specific Tree-sitter extractors
4. preserve the existing `UnitInfo` and `DependenciesAnalysis` shapes

### Verification that already passed

Focused verification during the pilot included:

- `packages/analyzer/src/lang/rust/__tests__/TreeSitterRustParser.test.ts`
- `packages/analyzer/src/lang/rust/__tests__/RustAnalyzer.test.ts`
- `packages/analyzer/src/lang/rust/__tests__/RustDependencies.test.ts`
- `bun run --cwd packages/analyzer typecheck`
- targeted `bun x biome check` on the Rust analyzer files
- root `bun run typecheck`

## Evidence from the Tokio corpus

Tokio was used as the real-world benchmark corpus because it is large, idiomatic Rust, multi-crate, and immediately exposes heuristic mistakes.

### Quality deltas observed on Tokio

- total units changed from `5577` to `4615`
- false-positive units dropped to `0` for:
  - `UnsafeCell::new` (`31 -> 0`)
  - `Mutex::new` (`25 -> 0`)
  - `Ok` (`26 -> 0`)
  - `Ready` (`10 -> 0`)
- dependency extraction produced:
  - `913` source-file dependency links
  - `9` component-level edges
- false internal links created from external imports such as `std`, `core`, or `alloc` dropped to `0`

### What that means

The migration did not merely preserve existing output with a different implementation.
It removed a substantial amount of invented structure from the report while adding genuinely useful Rust dependency coverage.

## Product-level validation outcome

The pilot was also validated through the local hosted app/runtime flow using a Tokio analysis root.

### What worked end to end

The hosted product rendered real Tokio data successfully on:

- metrics
- dependencies
- units
- contributors

Representative values observed in the hosted flow:

- main LOC: `112,551`
- test LOC: `39,470`
- duplicated lines: `4,880`
- contributors: `1,056`
- units: `4,615`

### What did not fully land yet

The hosted overview page still lacked a fully populated validated artifact summary for the imported Tokio report.

That is not a Rust parser failure.
It is a downstream contract/completeness gap between analyzer output, exported snapshot shape, and overview consumption.

## What we learned

### 1. WASM-first is the practical runtime strategy here

The native `tree-sitter` path was brittle in the current Bun / macOS x64 / Node 23 environment.

The robust path was:

- `web-tree-sitter`
- `tree-sitter-rust`
- explicit WASM resolution via `require.resolve(...)`
- top-level parser initialization

For this repo, that means Bun-first parser integrations should default to a WASM-first evaluation unless native bindings clearly justify the extra operational risk.

### 2. The strangler pattern worked

Keeping `RustAnalyzer` stable while replacing its internals incrementally was the right migration shape.

That gave us:

- low interface churn
- separate unit and dependency slices
- reversible implementation steps
- focused testability

### 3. TDD was necessary but not sufficient

The targeted tests gave us confidence in local behavior.
Tokio gave us confidence in real behavior.

The strongest pattern from this pilot was:

- red/green unit tests for the specific slice
- then validate against a large, real Rust corpus

Without Tokio, the pilot would have looked green while still hiding real-world quality issues.

### 4. Conservative dependency resolution matters more than aggressive guessing

The sharpest bug in the pilot was not parser initialization.
It was path resolution inventing internal dependencies from external imports.

The fix was to:

- prefer direct matches first
- only apply crate-prefixed fallback when the first segment is not a known crate
- exclude the current crate root from fallback matching when necessary

That lesson should carry forward to every future parser-backed dependency extractor.

### 5. Tree-sitter gives us better structure, not full Rust semantics

The pilot proved that Tree-sitter is a strong foundation for:

- units
- spans
- parameter counts
- complexity signals
- explicit import-based dependency evidence

It did **not** prove whole-program semantic analysis, Cargo-aware resolution, macro expansion, or type-aware symbol resolution.

That boundary should stay explicit.

### 6. Analyzer wins surface downstream contract gaps faster

Once the analyzer became trustworthy enough to run through the product, the remaining weakness shifted downstream.

The hosted overview summary gap showed that parser correctness, export completeness, and product consumption are separate layers.
Future parser migrations should expect the same pattern.

## What is still not feature complete

From a strict Java-legacy baseline, the Rust feature is already at or above parity.

From a production-complete parity-and-hardening baseline, there is still meaningful work left.

### 1. Close the adapter-hardening slice from the pilot checklist

Still missing from the original checklist shape:

- extract any shared parser adapter utilities worth reusing
- document parser initialization and fallback behavior explicitly
- benchmark parser overhead and record expected bounds on representative corpora

This is the work that turns “working Rust pilot” into “repeatable parser integration pattern.”

### 2. Expand verified Rust syntax coverage beyond the currently tested node set

Current unit extraction is centered on `function_item` and `impl_item` paths.
That is already much better than heuristics, but it is not the same as saying the Rust surface is comprehensively covered.

Next fixture candidates should include:

- trait methods and trait signatures
- foreign functions / extern blocks
- nested modules and more `mod` layouts
- cfg-gated items where syntax still exists but inclusion can vary
- more complexity-heavy control-flow variants where we care about stable counts
- macro-heavy files where we should prove conservative behavior rather than overclaim support

### 3. Add a legacy-comparison harness instead of relying on memory

We should automate the comparison between:

- Java Sokrates Rust output
- Planetnik Rust output

on a shared fixture set and at least one representative real corpus.

The goal is not bug-for-bug matching.
The goal is to classify diffs into:

- intended improvements
- neutral implementation differences
- regressions

That gives us a defensible parity story instead of a vibes-based one. Charming, but not enough.

### 4. Finish the report-contract path for Rust-produced outputs

The hosted overview gap showed that analyzer improvement is not the same thing as report-contract completeness.

To close that gap, we should:

- ensure Rust analysis exports populate the canonical summary/context expected by the overview layer
- add contract tests around Rust-generated report snapshots
- verify the same output shape works in CLI, static-site, and hosted-runtime consumers

### 5. Decide and document the phase boundary explicitly

If we stop here, we should say clearly:

- Tree-sitter Rust is syntax-backed and conservative
- Cargo-aware semantics are out of scope for this phase
- macro expansion is out of scope for this phase
- type resolution is out of scope for this phase

If we do not state that explicitly, future work risks drifting into accidental scope creep.

## Recommended next steps

If the goal is to call this feature complete with respect to legacy behavior **and** safe for future expansion, the best sequence is:

1. **Create a Rust parity fixture suite**
   - compare Java Sokrates and Planetnik outputs on shared fixtures
   - snapshot accepted diffs as intentional improvements

2. **Finish adapter hardening**
   - extract reusable parser helpers where they are genuinely shared
   - document WASM initialization and failure behavior
   - record Tokio benchmark expectations

3. **Expand Rust coverage tests deliberately**
   - add fixtures for still-uncovered Rust constructs
   - keep the extractor conservative where syntax does not justify certainty

4. **Close the product contract gap**
   - make the hosted overview summary populate from canonical artifacts
   - add regression tests for the overview-facing contract

5. **Declare the semantic ceiling for this phase**
   - ship the parser-backed Rust analyzer as syntax-accurate, not semantically omniscient

## Suggested definition of done for “feature complete with legacy”

The Rust feature should be considered complete when all of the following are true:

- Planetnik matches or exceeds Java Sokrates Rust behavior on a shared fixture suite
- intentional divergences from legacy are documented and test-protected
- Tokio-style corpus validation remains green and keeps the known false positives at zero
- parser runtime expectations are documented and acceptable
- Rust-generated report artifacts populate the expected summary/context for downstream consumers
- the remaining non-goals are explicit rather than implied

## Relationship to the broader parser roadmap

This discovery strengthens the direction in `docs/parser-coverage-roadmap.md`.

The Rust pilot is now strong enough to support the following conclusion:

- the parser-backed pattern is viable in this repo
- it should be hardened before broad rollout
- future expansion should prioritize reuse and measured value, not Tree-sitter everywhere by reflex

That makes Rust the proof point, not the finish line.