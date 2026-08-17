# Parser Coverage Roadmap

> **Status: Archived — 2026-07-19**
>
> This document preserves the pre-Rust-pilot coverage proposal and contains a
> stale implementation matrix. It must not drive current sequencing. Use the
> [canonical product roadmap](./product-roadmap.md) for current parser work and
> [Rust migration discovery](./rust-tree-sitter-migration-discovery.md) for the
> measured pilot outcome.

## Purpose

Define a concrete plan to:

- assess the Tree-sitter Rust pilot in `packages/analyzer`
- compare Planetnik analyzer language support with the broader Sokrates language catalog
- identify missing modern FP languages and other notable gaps
- stage a phased rollout toward feature-complete analyzer coverage without forcing a whole-repo parser rewrite

This document complements:

- `docs/tree-sitter-rust-pilot-checklist.md`
- `docs/adr/0009-pilot-tree-sitter-for-rust-parser-parity.md`
- `docs/rust-tree-sitter-migration-discovery.md`

## Scope

This roadmap focuses on `packages/analyzer/src/lang` and language-routing behavior in:

- `packages/analyzer/src/lang/LanguageAnalyzerFactory.ts`
- `/Users/alan/Projects/sokrates/codeanalyzer/src/main/java/nl/obren/sokrates/sourcecode/lang/LanguageAnalyzerFactory.java`

## Support-level model

To avoid treating extension coverage as success, use explicit support levels.

| Level | Meaning | Typical implementation shape |
| --- | --- | --- |
| L0 | Recognized only | default cleaning, no units, no dependencies |
| L1 | Syntax-aware cleaning | comments/strings handled, duplication cleanup improved |
| L2 | Units + complexity | functions/types/methods extracted, complexity better than plain regex |
| L3 | Dependencies | explicit import/use/open/require extraction |
| L4 | Strong support | syntax-backed extraction, hardening tests, benchmarked limits |

## Current Planetnik support snapshot

### Current analyzer families

Planetnik currently has explicit analyzer classes for:

- Java
- JavaScript
- TypeScript
- Go
- C#
- Python
- Kotlin
- Rust
- Ruby
- generic `CStyleAnalyzer`
- generic `DefaultLanguageAnalyzer`

### Observed support tiers in Planetnik

| Tier | Languages | Current state |
| --- | --- | --- |
| Strongest current support | Java | C-style unit extraction + Java heuristic dependency extraction |
| Explicit but still heuristic | JavaScript, TypeScript, Go, C#, Kotlin, Rust | language-specific cleaning, mostly heuristic units, no strong dependency extraction |
| Explicit but shallow | Python, Ruby | custom cleaning, but units/dependencies still mostly absent |
| Routed through `CStyleAnalyzer` | C, C++, Objective-C family, Dart, Scala, Swift, PHP, Groovy | generic brace-language behavior |
| Routed through `DefaultLanguageAnalyzer` | everything else not mapped | basic LOC/duplication cleaning only |

## Coverage matrix

### Matrix legend

- **Planetnik status** describes the current effective implementation level, not just extension recognition.
- **Sokrates parity** indicates whether the language appears in the Sokrates language catalog reviewed here.
- **Tree-sitter candidate** is a recommendation, not a commitment.

| Language / family | Planetnik current path | Planetnik level | Sokrates parity | Gap type | Tree-sitter candidate | Suggested priority |
| --- | --- | --- | --- | --- | --- | --- |
| Java | `JavaAnalyzer` | L3 | Yes | depth improvement optional | Maybe later | Low |
| JavaScript | `JavaScriptAnalyzer` | L2 | Yes | dependency depth gap | Maybe | Medium |
| TypeScript | `TypeScriptAnalyzer` | L2 | Yes | dependency depth gap | Maybe | Medium |
| Go | `GoLangAnalyzer` | L2 | Yes | dependency depth gap | Maybe | Medium |
| C# | `CSharpAnalyzer` | L2 | Yes | dependency depth gap | Maybe | Medium |
| Kotlin | `KotlinAnalyzer` | L2 | Yes | dependency depth gap | Maybe | Medium |
| Rust | `RustAnalyzer` via `CStyleAnalyzer` | L2 | Yes | core pilot target | Yes | Critical |
| Python | `PythonAnalyzer` | L1-L2 | Yes | missing units/dependencies | Maybe | Medium |
| Ruby | `RubyAnalyzer` | L1 | Yes | missing units/dependencies | Maybe | Medium |
| C / C++ / Obj-C family | `CStyleAnalyzer` | L2 | Yes | language-specific depth gap | Maybe | Medium |
| Scala | `CStyleAnalyzer` | L2 | Yes | missing dedicated support | Yes | High |
| Swift | `CStyleAnalyzer` | L2 | Yes | missing dedicated support | Yes | High |
| PHP | `CStyleAnalyzer` | L2 | Yes | missing dedicated support | Yes | High |
| Groovy | `CStyleAnalyzer` | L2 | Yes | missing dedicated support | Yes | Medium |
| Lua | missing | L0 | Yes | missing language | Yes | Medium |
| Clojure | missing | L0 | Yes | missing FP language | Yes | High |
| Julia | missing | L0 | Yes | missing language | Yes | Medium |
| Shell | missing | L0 | Yes | missing language | Usually no first | Medium |
| SQL | missing | L0 | Yes | missing language | Maybe not first | Medium |
| PL/SQL | missing | L0 | Yes | missing language | Maybe not first | Low-Med |
| R | missing | L0 | Yes | missing language | Maybe | Medium |
| Perl | missing | L0 | Yes | missing language | Maybe | Low-Med |
| Visual Basic | missing | L0 | Yes | missing language | Maybe not first | Low |
| Object Pascal | missing | L0 | Yes | missing language | Maybe | Low |
| ABAP | missing | L0 | Yes | missing language | Probably no first | Low |
| D | missing | L0 | Yes | missing language | Maybe | Low |
| Hack | missing | L0 | Yes | missing language | Maybe | Low |
| Thrift | missing | L0 | Yes | missing language | Likely no first | Low |
| HTML | missing | L0 | Yes | markup gap | Usually no first | Low |
| JSP | missing | L0 | Yes | markup gap | Usually no first | Low |
| XML | missing | L0 | Yes | markup/config gap | Usually no first | Low |
| JSON | missing | L0 | Yes | config/data gap | No | Low |
| YAML | missing | L0 | Yes | config/data gap | No | Low |
| CSS / Less / Sass / Scss | missing | L0 | Yes | style/config gap | No first | Low |
| Puppet | missing | L0 | Yes | infra DSL gap | Maybe later | Low |
| CFG / DBC / Adabas Natural | missing | L0 | Yes | niche parity gap | No first | Low |

## Missing modern FP language matrix

These do not appear in the Planetnik factory reviewed here. They also do not appear in the Sokrates language catalog inspected for this exercise, unless noted.

| Language | Common extensions | Planetnik | Sokrates catalog reviewed | Why it matters | Tree-sitter suitability | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| Haskell | `.hs`, `.lhs` | Missing | Not observed | major FP language, common architecture interest | High | FP wave 1 |
| Gleam | `.gleam` | Missing | Not observed | modern BEAM FP language | High | FP wave 2 |
| Elixir | `.ex`, `.exs` | Missing | Not observed | mainstream functional production language | High | FP wave 1 |
| Erlang | `.erl`, `.hrl` | Missing | Not observed | core BEAM ecosystem | High | FP wave 1 |
| F# | `.fs`, `.fsi`, `.fsx`, `.fsproj` | Missing | Not observed | important typed FP-on-.NET language | High | FP wave 1 |
| OCaml | `.ml`, `.mli` | Missing | Not observed | major ML-family language | High | FP wave 2 |
| ReScript / Reason | `.res`, `.resi`, `.re`, `.rei` | Missing | Not observed | active typed FP/JS ecosystem | High | FP wave 2 |
| Elm | `.elm` | Missing | Not observed | well-known front-end FP language | High | FP wave 2 |
| PureScript | `.purs` | Missing | Not observed | strongly typed JS-targeting FP language | High | FP wave 2 |
| Scheme / Racket | `.scm`, `.ss`, `.rkt` | Missing | Not observed | classic Lisp family, reusable with Clojure learnings | Medium-High | FP wave 3 |
| Nix | `.nix` | Missing | Not observed | declarative language relevant to infra-heavy repos | Medium | FP wave 3 |

## Priority buckets

### Bucket A — pilot and prove the parser pattern

Focus on languages where parser-backed extraction is likely to produce immediate measurable wins.

- Rust
- Scala
- Swift
- PHP
- Clojure

### Bucket B — parity wins against Sokrates

Broaden Planetnik to close obvious language-catalog gaps already covered in Sokrates.

- Lua
- Julia
- Shell
- SQL / PL-SQL
- R
- Perl
- XML / YAML / JSON / CSS family where lightweight support is enough

### Bucket C — modern FP completeness

Close the most visible current FP gaps.

- Haskell
- Elixir
- Erlang
- F#
- OCaml
- Gleam
- Elm
- PureScript
- ReScript / Reason
- Scheme / Racket

## Phased plan

## Phase 0 — Baseline and matrix hardening

Goal: create a stable decision surface before adding parsers.

### Phase 0 deliverables

- lock this roadmap as the source-of-truth coverage matrix
- classify every language into support levels L0-L4
- record the exact extension list currently recognized by Planetnik
- record which languages are active in current real datasets if possible

### Phase 0 exit criteria

- support levels are explicit rather than implied by file-extension routing
- Rust pilot success metrics are agreed before implementation expands

## Phase 1 — Rust Tree-sitter pilot

Use `docs/tree-sitter-rust-pilot-checklist.md` as the execution checklist.
Use `docs/rust-tree-sitter-migration-discovery.md` as the post-pilot outcome record.

### Goals

- prove Bun + TypeScript + Tree-sitter runtime compatibility
- replace heuristic Rust unit extraction with syntax-tree-backed extraction
- add conservative Rust dependency extraction from `use` statements
- establish a reusable adapter boundary

### Success gates

- better unit recall and line ranges than current heuristics
- better complexity accuracy on tricky Rust fixtures
- dependency extraction is useful without pretending to resolve Cargo semantics
- runtime overhead remains acceptable on representative fixtures

### Failure gates

- parser integration becomes too brittle in Bun/TypeScript
- syntax-backed output is not materially better than heuristics
- adapter does not generalize beyond Rust

## Phase 2 — Adapter hardening

Goal: turn the Rust pilot into reusable parser infrastructure.

### Phase 2 deliverables

- a parser adapter module under `packages/analyzer/src/lang/` or similar
- syntax traversal helpers shared across parser-backed languages
- a documented split between:
  - parser syntax extraction
  - later semantic heuristics
- parser failure/fallback behavior

### Phase 2 exit criteria

- adding the next parser-backed language does not require inventing a new architecture

## Phase 3 — High-value parity wave

Goal: tackle languages already important either because Sokrates supports them or because Planetnik currently treats them too generically.

### Phase 3 recommended order

1. Scala
2. Swift
3. PHP
4. Clojure
5. Lua
6. Julia
7. Groovy

### Why this wave first

- closes the most visible parity gaps
- exercises more than one syntax family
- avoids jumping immediately from Rust to a dozen niche grammars
- produces a reusable pattern before the FP wave fans out

### Phase 3 target level

- at least L2 for most of these
- L3 where explicit import/module syntax is useful and deterministic

## Phase 4 — Modern FP wave

Goal: make the analyzer credible across current FP ecosystems.

### Phase 4 recommended order

#### Wave 4A

- Haskell
- Elixir
- Erlang
- F#

#### Wave 4B

- OCaml
- Gleam
- Elm
- PureScript
- ReScript / Reason

#### Wave 4C

- Scheme / Racket
- Nix

### Phase 4 target level

- at least L2 for all wave languages
- L3 where imports/modules are explicit enough to emit useful dependency graphs

## Phase 5 — Long-tail breadth wave

Goal: close remaining coverage gaps without over-investing where Tree-sitter is unnecessary.

### Likely candidates

- Shell
- SQL / PL-SQL
- R
- Perl
- Visual Basic
- Object Pascal
- ABAP
- D
- Puppet
- Thrift
- HTML / JSP
- XML / JSON / YAML
- CSS / Less / Sass / Scss

### Strategy

- do not assume Tree-sitter first
- prefer the lightest implementation that reaches the required support level
- reserve parser-backed work for languages where unit and dependency accuracy matter architecturally

## Decision rules for Tree-sitter adoption

Use Tree-sitter when most of the following are true:

- the language has rich nested syntax that heuristics handle poorly
- unit extraction matters for reports
- dependency extraction has architecture value
- the grammar ecosystem is mature enough to trust
- expected dataset frequency justifies the maintenance cost

Prefer lightweight analyzers when most of the following are true:

- the language is mostly config/markup/data
- unit extraction is not a primary value
- dependency extraction would be low-signal or speculative
- parser maintenance would outweigh analysis value

## Definition of feature complete

For Planetnik analyzer purposes, “feature complete” should mean:

- all important languages in active datasets are at L2 or better
- major architecture-relevant languages are at L3 where feasible
- modern FP languages of interest are not silently falling back to L0
- language support level is documented and testable
- parser adoption follows a repeatable integration pattern rather than one-off hacks

It should **not** mean only:

- a large extension map
- parity-by-marketing with no units/dependencies depth
- Tree-sitter everywhere regardless of ROI

## Proposed implementation backlog

### Epic A — Coverage matrix and measurement

- keep this roadmap updated as the canonical matrix
- optionally generate a machine-readable support report from `LanguageAnalyzerFactory.ts`
- record language frequency in current datasets

### Epic B — Rust pilot

- execute `docs/tree-sitter-rust-pilot-checklist.md`
- capture benchmark and quality outcomes

### Epic C — Parser adapter infrastructure

- extract reusable parser/visitor helpers
- define shared test fixtures pattern

### Epic D — Parity wave

- Scala
- Swift
- PHP
- Clojure
- Lua
- Julia
- Groovy

### Epic E — FP completeness wave

- Haskell
- Elixir
- Erlang
- F#
- OCaml
- Gleam
- Elm
- PureScript
- ReScript / Reason
- Scheme / Racket
- Nix

### Epic F — Long-tail language breadth

- Shell / SQL / R / Perl / VB / Pascal / ABAP / etc.
- markup/data families where lighter analyzers are enough

## Near-term recommendation

If the team wants the best balance of rigor and momentum, do this next:

1. keep the Rust pilot narrow and measurable
2. harden the adapter immediately after Rust proves itself
3. take one parity wave focused on:
   - Scala
   - Clojure
   - PHP
   - Swift
4. start the modern FP wave with:
   - Haskell
   - Elixir
   - Erlang
   - F#
   - OCaml
   - Gleam

This sequence gives Planetnik:

- a proven parser integration pattern
- meaningful parity movement against Sokrates
- a credible path to FP completeness

## Open questions

- Which missing languages appear in real Planetnik datasets today?
- Which languages need only L1/L2 versus full L3 support?
- Should the analyzer expose language support levels in generated reports or CLI diagnostics?
- Should parser-backed languages share one internal adapter API from the start, or can that wait until after Rust + one follow-on language?
