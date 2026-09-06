# Tree-sitter runtime contract

This document is the operational contract for the shared Tree-sitter runtime in
`packages/analyzer`. It is intentionally syntax-first: the runtime supplies
parse trees and lifecycle guarantees, while each language adapter decides which
syntax facts are safe to expose through Planetnik's existing analyzer shapes.

## Lifecycle

- `Parser.init` runs once when `TreeSitterRuntime` is evaluated and resolves the
  embedded `web-tree-sitter.wasm` asset through Bun's file-asset import.
- `loadTreeSitterLanguage` caches one `Language` promise per adapter `id`.
  Grammar bytes are read from the adapter's `grammarWasmPath`.
- A rejected grammar load is removed from the cache before the error is
  rethrown. A transient or corrected asset therefore cannot leave a poisoned
  adapter identity behind.
- `parseTreeSitterSource` creates a parser per source. Callers own the returned
  parser/tree pair and must call `dispose()` in a `finally` block.
- `dispose()` is idempotent, so cleanup can safely be shared across success and
  failure paths.

## Parse outcomes

- A non-null tree is returned even when `tree.rootNode.hasError` is true. The
  syntax error is a fact that adapters may report or use for conservative
  extraction; it is not silently converted into a heuristic result.
- A parser exception or null tree is a hard parse failure. The parser is
  deleted before the error escapes.
- Rust and Python adapters currently have no heuristic fallback after
  Tree-sitter parsing. They emit only syntax-backed facts and return the
  existing empty result for sources with no supported nodes.
- Macro token trees, declaration-only signatures, unresolved imports, and
  language semantics outside the grammar are not inferred as facts.

## Verification baseline

The runtime fixture suite covers language caching, syntax-error preservation,
idempotent disposal, and recovery after a failed grammar load. Rust coverage
fixtures additionally cover cfg-gated functions, nested module and trait/impl
qualification, branch and match-arm complexity, and the conservative
boundaries above.

The Phase 2 public-corpus baseline remains the repeatable performance reference
for this repository; it is a local engineering bound, not a cross-machine
service-level objective. New adapters should record elapsed time, peak memory,
parse failures, syntax-error files, emitted units, and dependency evidence on a
representative corpus before adoption.

## Repeatable benchmark command

The analyzer package exposes a Bun-first benchmark command for the current
adapters:

```sh
bun run --cwd packages/analyzer benchmark:tree-sitter \
  --language <rust|python> \
  --root <source-root>
```

The command reports adapter-load time, parse preflight outcomes, unit and
dependency extraction outcomes, elapsed timings, and sampled RSS. Timings cover
the adapter load, source read, syntax preflight, and extraction passes; they are
engineering evidence rather than a performance SLA.

The Rust reference run on a shallow Tokio checkout at commit
`060cc4e46aedc40b0a44dcbc31deb0df39abdb4e` (2026-09-05, Bun 1.3.11, macOS
arm64) recorded:

| Signal | Result |
| --- | ---: |
| Source files / bytes / lines | 796 / 5,712,860 / 181,783 |
| Adapter load | 10.85 ms |
| Parse preflight | 0 syntax-error files, 0 failures |
| Emitted units / dependency links | 7,274 / 1,663 |
| Unit / dependency extraction | 786.75 ms / 838.54 ms |
| Total measured run | 2,148.18 ms |
| Peak RSS | 585,973,760 bytes (~559 MiB) |

The run is intentionally recorded as a local baseline: the source checkout,
machine, Bun version, and benchmark implementation must remain visible when
comparing future adapters or revisions.

The corresponding Python run on `psf/requests` at commit
`dae7ef63b4df6eded86637f251fc4e3a06c3b479` (the same date and runtime) recorded
37 source files, 407,127 bytes, and 12,068 lines; zero syntax-error files or
parse failures; 807 units and 102 dependency links; 230.77 ms total measured
time (20.21 ms adapter load, 50.85 ms parse preflight, 98.22 ms units, and
53.09 ms dependencies); and 396,181,504 bytes (~378 MiB) peak RSS.
