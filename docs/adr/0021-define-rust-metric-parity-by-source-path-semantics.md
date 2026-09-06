# ADR-0021: Define Rust Metric Parity by Source-Path Semantics

## Status

Accepted — approved and implemented 2026-09-05

## Date

2026-09-05

## Decision-makers

Planetnik maintainers

## Context and Problem Statement

The Rust Tree-sitter parity track now has two provenance-backed Sokrates
references for the same source sample:

- the historical upstream JUnit expectation, where the test constructs a
  `SourceFile` with an empty path; and
- a runtime-executed Java capture that loads the source as
  `RustCodeSamples.rs`, the path a report actually receives.

At the pinned Sokrates commit
`f400eb7235a755146e854a1bf4bd90cbe1ee5086`, both captures agree on unit
identity, ranges, complexity, and parameters. They differ only for `main`
lines of code: the extensionless test helper reports `4`, while the real `.rs`
path reports `3` because Sokrates selects a Rust-specific cleaner and removes
the comment line.

Treating those values as an unexplained regression would make the report
contract follow a test helper rather than a source file. Silently overwriting
the historical fixture would discard useful upstream provenance. The parity
workflow therefore needs a durable path-sensitive metric policy and an
executable classification rule.

## Decision

Planetnik defines Rust report-metric parity using the semantics of the actual
source path supplied to the analyzer. A `.rs` path is authoritative for a Rust
report; an extensionless `SourceFile` created by an upstream unit test is
retained as historical evidence only.

The known `main` LOC difference (`4` extensionless-test-helper → `3`
real-file-extension) is classified as an explicit `neutral-difference`, not a
regression. The classification is value-, unit-, metric-, and path-specific.
All other metric differences fail closed as regressions until they are added
to the policy with an evidence-backed reason. Structural unit/dependency
changes continue to use the existing `RustParity` classifier.

The runtime-executed fixture is therefore promoted as the authoritative
runtime reference for this sample, while the original source/test-derived
fixture remains unchanged and clearly labelled.

## Decision Details

The policy is represented by
`packages/analyzer/src/lang/rust/SokratesRustMetricPolicy.ts`:

- `real-file-extension` is the authoritative report semantics;
- `extensionless-test-helper` identifies the historical upstream setup;
- only explicitly listed neutral differences pass the metric comparison; and
- missing or unlisted values are regressions.

The runtime fixture records the same policy metadata so the checked-in
evidence cannot silently drift from the executable comparator.

## Consequences

### Positive

- LOC parity now describes the production report input rather than an
  extensionless test convenience.
- Both upstream provenance and runtime evidence remain reviewable.
- A future metric or fixture difference cannot be hidden by a broad
  “different cleaner” exception; it must be classified explicitly.
- The policy is reusable for later Sokrates captures without changing the
  canonical report schema.

### Costs and risks

- The parity suite carries two references for the same sample and must keep
  their path semantics visible.
- Adding a legitimate path-sensitive difference requires updating code,
  fixture metadata, tests, and this decision's evidence trail.
- The policy does not prove that every Sokrates metric is semantically
  identical across language versions; it only defines this bounded Rust
  comparison boundary.

## Non-goals

- Do not rewrite the historical upstream fixture to match the runtime value.
- Do not treat extensionless test-helper semantics as a valid report input.
- Do not broaden the neutral rule to every LOC difference or every metric.
- Do not change Tree-sitter extraction, canonical JSON shapes, or exporter
  behavior as part of this policy.
- Do not infer Cargo semantics, macro expansion, or type resolution.

## Alternatives Considered

### Promote the historical JUnit value as canonical

This would preserve the existing fixture with no policy code, but it would make
production parity depend on an extensionless test path that selects the wrong
cleaner for a Rust report. Rejected.

### Overwrite the historical fixture with the runtime value

This would make one fixture look simple, but it would erase the distinction
between copied upstream expectations and a fresh Java execution trace. Rejected
because provenance matters for future reviews.

### Ignore all metric differences when source paths differ

This would avoid the immediate conflict, but could hide a genuine analyzer
regression behind a path label. Rejected in favour of a small, value-specific,
fail-closed allowlist.

## Implementation Plan

- **Affected paths**:
  `packages/analyzer/src/lang/rust/SokratesRustMetricPolicy.ts`,
  `packages/analyzer/src/lang/rust/__tests__/SokratesRustMetricPolicy.test.ts`,
  `packages/analyzer/src/lang/index.ts`,
  `packages/analyzer/src/lang/rust/__tests__/fixtures/sokrates-rust-fragment-1.json`,
  `packages/analyzer/src/lang/rust/__tests__/fixtures/sokrates-rust-fragment-1-runtime-v1.json`.
- **Documentation**: update
  `docs/rust-tree-sitter-migration-discovery.md`,
  `docs/product-roadmap.md`, and the runtime-capture plan so the open metric
  review becomes a resolved policy and the runtime fixture is authoritative.
- **Dependencies**: none. Reuse Bun, TypeScript, and the existing fixture
  harness.
- **Pattern**: keep structural unit/dependency comparisons in
  `RustParity.ts`; keep metric comparison path-aware and serialisable; require
  explicit neutral expectations; preserve fail-closed regressions.
- **Pattern to avoid**: do not parse HTML/TXT reports or infer path semantics
  from a filename after capture; the capture metadata must state the semantics
  directly.

## Verification

- [x] A focused test proves `real-file-extension` is authoritative and the
      known `main` 4 → 3 difference is classified as neutral.
- [x] A focused test proves an unlisted LOC difference with the same path
      semantics is a regression.
- [x] The runtime fixture records `sourcePathSemantics` and policy metadata that
      exactly match the executable policy.
- [x] The historical fixture remains source/test-derived and records
      `extensionless-test-helper` semantics.
- [x] Rust parity, analyzer typecheck/build, full repository tests, and
      `git diff --check` pass after the policy slice.

## More Information

- [ADR-0009: Pilot Tree-sitter for Rust parser parity](./0009-pilot-tree-sitter-for-rust-parser-parity.md)
- [ADR-0018: Versioned canonical analysis snapshots](./0018-adopt-versioned-canonical-analysis-snapshots.md)
- [Rust Tree-sitter migration discovery](../rust-tree-sitter-migration-discovery.md)
- [Runtime capture plan](../superpowers/plans/2026-09-05-sokrates-java-rust-capture.md)
- [Historical Sokrates fixture](../../packages/analyzer/src/lang/rust/__tests__/fixtures/sokrates-rust-fragment-1.json)
- [Runtime Sokrates fixture](../../packages/analyzer/src/lang/rust/__tests__/fixtures/sokrates-rust-fragment-1-runtime-v1.json)
