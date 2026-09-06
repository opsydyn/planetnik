# Sokrates Java Rust Capture Lane

**Goal:** make the remaining Rust Tree-sitter parity reference reproducible with a
runtime-executed Java capture when the pinned Sokrates toolchain is available.

**Scope:** capture the existing `sokrates-rust-fragment-1.json` source through the
pinned upstream `RustAnalyzer`, emit a small JSON reference, and fail closed when
Java, Maven, the checkout, or the pinned commit is unavailable. Do not change the
runtime analyzer or overwrite the historical fixture automatically.

## Plan

- [x] Add a pure capture-plan/preflight contract and a failing test first.
- [x] Add a Bun script that builds the pinned Sokrates CLI and runs a disposable
      Java harness against the fixture source.
- [x] Add a package command and documentation for local/CI execution, including
      the explicit unavailable-toolchain outcome.
- [x] Run focused tests, typecheck, and repository verification; update the
      canonical roadmap with the evidence boundary.

## Evidence boundary

The direct host toolchain is still absent, but the Docker-backed lane was run
successfully against the pinned checkout with Temurin 17.0.15. It produced the
checked-in runtime evidence fixture. That run exposed an upstream
extension-sensitive LOC difference (`main` is 3 LOC for a `.rs` source path and
4 LOC for the extensionless test `SourceFile`). ADR-0021 now defines the real
`.rs` path as authoritative and classifies this exact difference as neutral;
the historical fixture remains unchanged as source/test-derived evidence.

## Contract

- The Sokrates checkout must resolve to commit
  `f400eb7235a755146e854a1bf4bd90cbe1ee5086`.
- The harness runs `nl.obren.sokrates.sourcecode.lang.rust.RustAnalyzer` against
  the fixture source, never a copied expectation or rendered report.
- `--docker` runs the same harness in `maven:3.9.9-eclipse-temurin-17` when a
  host JDK/Maven installation is unavailable.
- Output records `runtimeExecuted: true`, Java/runtime metadata, raw unit fields,
  and the normalized unit/dependency snapshot.
- Output records `sourcePathSemantics: real-file-extension` and the shared
  path-sensitive metric policy; the extensionless upstream expectation remains
  historical evidence rather than an implicit overwrite target.
- Missing prerequisites produce a non-zero exit with an actionable message;
  there is no silent fallback to the historical fixture.
