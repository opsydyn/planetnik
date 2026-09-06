# Rust Tree-sitter Migration Discovery

> **Status: Completed evidence — 2026-07-19**
>
> This document records the Rust pilot outcome and remains valid evidence. It is
> not an active roadmap. Use the
> [canonical product roadmap](./product-roadmap.md) for current sequencing.

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
- The remaining work is not “match the old heuristic behavior line for line.” The adapter now has a repeatable benchmark baseline and a checked-in Rust coverage matrix; the remaining parity work is a runtime-executed Java capture when the toolchain is available.

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

### First hardening slice (2026-09-05)

Rust unit extraction now carries syntax scope through nested modules and
trait/impl bodies. This keeps names such as `transport::Service::default`,
`transport::Worker::default`, and `transport::private::run` distinct without
changing the public `UnitInfo` contract. The fixture also protects the
conservative boundary: declaration-only trait/foreign signatures and functions
inside macro token trees are not reported as executable units.

The remaining hardening work is intentionally separate: a runtime-executed
reference refresh. The shared adapter lifecycle contract, repeatable benchmark
command, and broader Rust syntax fixture matrix are now documented and
exercised.

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

### 1. Continue the adapter-hardening slice from the pilot checklist

The shared runtime contract is now documented in
[`docs/tree-sitter-runtime-contract.md`](./tree-sitter-runtime-contract.md), and
its fixtures cover initialization through the embedded WASM asset, language
caching, idempotent disposal, syntax-error preservation, and recovery after a
failed grammar load. The Rust fixture slice also records scope-aware traversal
and the no-inference boundary.

The repeatable benchmark command now records adapter load, parse outcomes,
timings, sampled RSS, emitted units, and dependency evidence for a chosen
language/corpus. A Tokio reference run is recorded in the shared runtime
contract. Remaining work is to extract more shared traversal utilities only
where a second language proves the abstraction is real. This is the work that
turns “working Rust pilot” into “repeatable parser integration pattern.”

### 2. Expand verified Rust syntax coverage beyond the currently tested node set

Current unit extraction is centered on `function_item` and `impl_item` paths.
That is already much better than heuristics, but it is not the same as saying
the Rust surface is comprehensively covered. The checked-in
`rust-tree-sitter-coverage-v1` fixture now protects the highest-value syntax
edges without widening the semantic claim.

The verified matrix now includes:

- trait methods and declaration-only signatures
- foreign functions / extern blocks (explicitly excluded as units)
- nested modules and qualified trait/inherent impl methods
- cfg-gated items where syntax still exists but inclusion can vary
- `if let`, `while let`, boolean operators, and nested match-arm complexity
- macro-heavy files where token-tree functions remain excluded

The fixture records exact zero-based ranges, parameter counts, and McCabe
values. A three-arm match now contributes three branch points through its
`match_block`; the focused regression test prevents it from collapsing to one.
Remaining candidates should be added only when a concrete Rust report gap is
identified.

### 3. Extend the legacy-comparison harness instead of relying on memory

The first local harness slice is now in
`packages/analyzer/src/lang/rust/RustParity.ts`. It compares unit-name and
dependency-path multisets, classifies every difference as an explicitly
accepted improvement, neutral difference, or fail-closed regression, and is
wired to a live `RustAnalyzer` fixture against the historical
`CStyleHeuristicUnitsExtractor` baseline. The latter is a local proxy for the
old Planetnik/Sokrates-style heuristic path; it is not a claim that the Java
runtime has been executed in CI.

The runtime-capture lane is now implemented as a Bun command plus a disposable
Java probe. It builds the pinned Sokrates CLI, invokes
`nl.obren.sokrates.sourcecode.lang.rust.RustAnalyzer` directly, and emits a
normalized JSON fixture without scraping HTML or copying test logs. The command
verifies the checkout commit and fails closed when Java 17+, `javac`, or Maven
is unavailable. It also has an explicit `--docker` mode using the digest-pinned
`maven:3.9.9-eclipse-temurin-17` image, so a host without a JDK can still run
the same probe.

When the toolchain is available, run:

```sh
bun run --cwd packages/analyzer capture:sokrates:rust \
  --sokrates-root /path/to/pinned/sokrates/checkout \
  --docker \
  --output /path/to/sokrates-rust-fragment-1.runtime.json
```

The checkout must be at commit
`f400eb7235a755146e854a1bf4bd90cbe1ee5086`; the command verifies that before
building.

The first Docker-backed runtime capture completed on 2026-09-05 with Temurin
17.0.15: 3 units and 0 dependencies. It is retained as
`sokrates-rust-fragment-1-runtime-v1.json`. The capture reports `main` as 3 LOC
when loaded from the `.rs` source path, while the upstream JUnit assertion says
4 because its `SourceFile` is extensionless and therefore selects a different
cleaner. The Docker image is pinned by digest in
`SOKRATES_CAPTURE_DOCKER_IMAGE`.

ADR-0021 now defines `real-file-extension` as the authoritative report
semantics and records the extensionless JUnit setup as historical evidence.
`SokratesRustMetricPolicy.ts` classifies this exact `main` 4 → 3 LOC change as
an explicit `neutral-difference`; any other metric change remains a
fail-closed regression until evidence and policy are added. The runtime fixture
records the same policy metadata, while the original source/test-derived
fixture remains unchanged and labelled `runtimeExecuted: false`.

The parity boundary therefore keeps both references visible:

- Java Sokrates Rust output
- Planetnik Rust output

on a shared fixture set and at least one representative real corpus, with the
runtime `.rs` capture authoritative for report-path metrics.

The goal is not bug-for-bug matching.
The goal is to classify diffs into:

- intended improvements
- neutral implementation differences
- regressions

That gives us a defensible parity story instead of a vibes-based one. Charming, but not enough.

#### Captured upstream fixture (2026-09-05)

The first provenance-backed fixture is now checked in at
`packages/analyzer/src/lang/rust/__tests__/fixtures/sokrates-rust-fragment-1.json`.
It pins the source sample and the Rust `extractUnits` expectations from the
upstream Sokrates test suite to commit
`f400eb7235a755146e854a1bf4bd90cbe1ee5086`.

The parity test runs the fixture through the current `RustAnalyzer` and the
same fail-closed classifier used by the local proxy comparison. The fixture
keeps the raw Java display names, one-based line numbers, and expected metric
values, alongside the normalized identity snapshot used for cross-implementation
comparison.

This checked-in capture remains deliberately marked `runtimeExecuted: false`:
its reference values are copied from upstream test assertions rather than
produced by a fresh Java execution trace. Its
`sourcePathSemantics` is `extensionless-test-helper`; it remains useful
historical evidence, but it is not the report-metric authority.

#### Runtime capture fixture (2026-09-05)

The Docker-backed execution is checked in at
`packages/analyzer/src/lang/rust/__tests__/fixtures/sokrates-rust-fragment-1-runtime-v1.json`.
It is marked `runtimeExecuted: true`, records
`sourcePathSemantics: real-file-extension`, and embeds the accepted metric
policy. The capture runner emits this metadata on every future recapture so a
new runtime reference cannot silently lose its provenance.

### 4. Report-contract path for Rust-produced outputs

The hosted overview gap showed that analyzer improvement is not the same thing as report-contract completeness. The exporter boundary is now closed for Rust output.

The exporter boundary is now covered by a Rust-specific integration fixture in
`apps/cli/src/__tests__/GenerateReports.test.ts`. It runs a small multi-file
Rust workspace through `runAnalysis` and asserts the v2 context, stable
snapshot identity, `units.json`, `dependencies.json`, and the absence of
compatibility projections. The static-site and hosted suites continue to
exercise the same canonical v2 reader contract with language-neutral fixtures;
the Rust check therefore stays at the shared exporter boundary rather than
duplicating every consumer test.

The remaining guard is maintenance rather than a new implementation slice:

- keep the Rust-generated exporter fixture green as the canonical shard map evolves
- retain the language-neutral static-site and hosted-runtime reader gates for the shared v2 shape

### 5. Decide and document the phase boundary explicitly

If we stop here, we should say clearly:

- Tree-sitter Rust is syntax-backed and conservative
- Cargo-aware semantics are out of scope for this phase
- macro expansion is out of scope for this phase
- type resolution is out of scope for this phase

If we do not state that explicitly, future work risks drifting into accidental scope creep.

## Recommended next steps

If the goal is to call this feature complete with respect to legacy behavior **and** safe for future expansion, the best sequence is:

1. **Extend adapter hardening beyond the baseline**
   - extract reusable parser helpers where they are genuinely shared
   - keep the documented WASM initialization and failure behavior green
   - rerun the benchmark command when adapter or grammar revisions change

2. **Expand Rust coverage tests deliberately**
   - the current matrix is delivered for the identified high-value constructs
   - add another fixture only for a demonstrated report gap
   - keep the extractor conservative where syntax does not justify certainty

3. **Keep the product contract green**
   - retain the language-neutral static-site and hosted-runtime v2 reader gates
   - keep the Rust exporter fixture aligned with any canonical shard-map changes

4. **Declare the semantic ceiling for this phase**
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

This discovery supplied the measured parser evidence now incorporated into
`docs/product-roadmap.md`. The earlier coverage proposal remains archived in
`docs/parser-coverage-roadmap.md` for historical context.

The Rust pilot is now strong enough to support the following conclusion:

- the parser-backed pattern is viable in this repo
- it should be hardened before broad rollout
- future expansion should prioritize reuse and measured value, not Tree-sitter everywhere by reflex

That makes Rust the proof point, not the finish line.
