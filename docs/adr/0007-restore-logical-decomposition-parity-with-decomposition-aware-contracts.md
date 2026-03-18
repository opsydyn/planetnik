# ADR-0007: Restore Logical Decomposition Parity with Decomposition-Aware Contracts

## Status

Accepted

## Context

Płanetnik was originally ported from the Sokrates Java codebase with an explicit goal of preserving core backend behavior while moving HTML rendering into Astro.

That direction is already captured in [ADR-0003](./0003-backend-only-parity-astro-frontend.md): the backend analysis engine and JSON exporters are the critical contract, while the Astro frontend replaces Java HTML reports.

For logical decomposition and dependency reporting, the current TypeScript port is not yet at parity with the Java implementation:

- the Astro dependencies page expects a normalized component-dependency collection, but the current site loader reads only `dependencies.json`
- the TypeScript exporter currently emits decomposition-scoped dependency TXT files, but not a dedicated decomposition-aware JSON contract for the site
- Java import resolution does not reliably map all internal module dependencies back to logical components when component names do not align with package roots
- the Astro `components` page currently reconstructs component summaries from file data instead of consuming a dedicated logical decomposition contract
- the original Java logical decomposition flow includes adjacent component-level signals such as commit totals, commit trends, and temporal dependencies that are not yet represented as first-class frontend data contracts

The Sokrates repository is the best parity fixture for this area:

- it is the original Java implementation and report producer
- it is a multi-module Java codebase with real logical decomposition and dependency behavior
- it exposes concrete gaps in the TypeScript port, especially around component dependency resolution for modules such as `codeanalyzer`

This decision affects multiple layers at once:

- analyzer dependency resolution semantics
- exported JSON contracts
- Astro content collections and loaders
- Astro report pages for components and dependencies
- regression and parity tests

Because these contracts are hard to reverse once the frontend depends on them, this needs an explicit ADR rather than a series of local fixes.

## Decision

We will restore logical decomposition parity against the Sokrates Java implementation by introducing decomposition-aware JSON contracts and golden parity verification, with data semantics fixed before frontend rendering changes.

### Core policy

- Treat Sokrates as the golden reference fixture for logical decomposition parity.
- Prefer semantic parity over 1:1 HTML parity.
- Make decomposition-aware JSON the canonical frontend contract.
- Keep raw dependency exports and decomposition-aware component dependency exports as separate concepts.
- Resolve internal dependencies to logical components first; preserve external/package targets only as an explicit secondary stream.

### Contract model

The Astro frontend must not infer logical decomposition structure from generic file exports where a dedicated decomposition export exists.

The backend will expose normalized, decomposition-aware JSON artifacts for the frontend, including:

- logical decompositions and component summaries
- static component dependencies
- component commit totals or equivalent component history summaries
- component temporal dependencies

Each artifact must include a stable decomposition key so multiple decompositions can coexist without ambiguity.

### Frontend policy

- `/components` should be driven by decomposition-aware exports, not ad hoc aggregation over `filesMain`
- `/dependencies` should render true static component dependencies from the decomposition contract
- component-level commit and temporal dependency views should be derived from explicit exports, not reconstructed heuristically in Astro

### Verification policy

Parity for this area is not complete until it is enforced by tests using the Sokrates fixture and by exporter- and loader-level contract assertions.

## Why this option

- It aligns with ADR-0003, which makes exporter contracts the core backend/frontend boundary.
- It fixes the current failure mode at the right layer instead of patching Astro pages around missing or ambiguous data.
- It gives future agents a stable and explicit contract for logical decomposition features.
- It avoids conflating raw language/package dependencies with logical component dependencies.
- It creates a reusable pattern for other parity-sensitive report areas.

## Alternatives Considered

### Patch the Astro dependencies page to parse existing TXT exports

This would be the smallest immediate fix.

We are not choosing it because it would hard-code frontend parsing against backend text dumps, preserve ambiguous semantics, and fail to support multiple decompositions cleanly.

### Keep deriving component views from `filesMain` and other generic collections

This would avoid new exports.

We are not choosing it because generic file collections do not fully encode logical decomposition semantics, dependency resolution decisions, or decomposition-scoped historical views. It would also keep parity fragile and distributed across page code.

### Match the Java HTML reports visually before fixing data semantics

This could produce faster visible progress.

We are not choosing it because the current gaps are contract and semantics gaps, not presentation gaps. Visual parity built on the wrong data would be misleading and expensive to unwind.

### Make Sokrates parity a best-effort manual review instead of a tested policy

This would reduce up-front test work.

We are not choosing it because this area already regressed through contract drift. Without golden tests, parity will remain anecdotal and unstable.

## Consequences

- `packages/analyzer` will need explicit work on dependency-to-component resolution rules.
- `packages/reports` will gain decomposition-aware JSON export artifacts for logical decomposition features.
- `apps/site` will gain new loaders and content collection schemas for decomposition-aware data.
- Existing Astro pages for components and dependencies will need to be rewired around the new contracts.
- Sokrates fixture-based tests will become part of the acceptance bar for logical decomposition work.
- The project will treat raw dependency data and component dependency data as distinct products rather than one overloaded export.

## Non-goals

- No attempt to reproduce the Java HTML output pixel-for-pixel
- No commitment to preserve existing TXT export formats as the primary frontend contract
- No requirement that every legacy visualization helper be ported immediately
- No coupling of this ADR to a specific charting library or visual style
- No requirement to solve every report parity gap in a single implementation slice

## Related ADRs

- ADR-0003: Backend-Only Parity — Astro Frontend Replaces Java HTML Reports
- ADR-0006: Add Contributor Detail Routes and a Per-Contributor Export Contract

## Implementation Plan

- **Affected paths**: `packages/analyzer/src/analysis/LogicalDecompositionAnalyzer.ts`, `packages/analyzer/src/dependencies/DependenciesFinderExtractor.ts`, `packages/analyzer/src/lang/JavaAnalyzer.ts`, `packages/analyzer/src/results/LogicalDecompositionAnalysisResults.ts`, `packages/reports/src/exporters/DataExporter.ts`, `apps/site/src/loaders/planetnik-loader.ts`, `apps/site/src/content.config.ts`, `apps/site/src/pages/components.astro`, `apps/site/src/pages/dependencies.astro`, `apps/site/src/pages/files/temporal.astro`, `packages/reports/src/__tests__/`, `packages/analyzer/src/__tests__/`, `apps/site/src/lib/__tests__/`
- Establish a golden parity baseline from the Sokrates fixture: expected decomposition names, component sizes, static component dependencies, component temporal dependencies, and component history signals.
- Update dependency resolution so logical components can be resolved from component ownership and decomposition rules, not only from component-name segment matching.
- Keep unresolved external/package targets separate from resolved logical component dependencies.
- Add decomposition-aware JSON exports for logical decomposition summaries and component dependency views.
- Ensure each export carries a decomposition key and uses stable, frontend-friendly shapes.
- Add Astro loaders and content collection schemas for the new exports instead of overloading the current `dependencies` collection with the wrong artifact.
- Rewire `/components` to read logical decomposition exports directly.
- Rewire `/dependencies` to read normalized static component dependencies directly.
- Add component-level commit and temporal dependency exports, then surface them in `/components` or other decomposition-aware frontend views.
- Preserve existing raw dependency exports where they are still useful, but treat them as separate data products from logical component dependencies.
- Add regression tests that compare TypeScript outputs against expected Sokrates fixture behavior at analyzer, exporter, and loader boundaries.

## Verification

- [ ] The TypeScript analyzer resolves internal Sokrates module dependencies to logical components rather than leaving them as package strings when a component match exists
- [ ] The backend emits decomposition-aware JSON for logical decompositions and static component dependencies
- [ ] Each decomposition-aware export includes a stable decomposition key
- [ ] The Astro `dependencies` route renders non-empty static component dependencies for the Sokrates fixture
- [ ] The Astro `components` route renders from decomposition-aware contracts rather than rebuilding everything from `filesMain`
- [ ] Component-level temporal or history views in the frontend are backed by explicit exports rather than page-local inference
- [ ] Raw dependency exports remain available without being confused with logical component dependency contracts
- [ ] Golden parity tests protect this behavior against regression
