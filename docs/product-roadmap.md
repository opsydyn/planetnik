# Product Roadmap

## Goal

Make Planetnik competitive with CodeScene by moving from descriptive architecture reporting to actionable engineering decision support.

## Guiding Principle

Prioritize features that answer:

- what should we fix next
- why is it risky
- who is affected
- what kind of coupling or domain boundary problem is driving it

More charts only matter when they support that loop.

## Platform Track: Static Reports and Hosted Intelligence

The platform split is formalized by:

- [ADR-0015: Adopt Separate Static Reports and Hosted Runtime for Intelligence](/Users/alan/Projects/planetnik/docs/adr/0015-adopt-separate-static-reports-and-hosted-runtime-for-intelligence.md)

Alongside feature work, Planetnik now has a clear platform split to deliver:

- keep `apps/site` as the easy, no-auth, static report product
- add a separate authenticated hosted product for intelligence and secret-dependent features

This is an enabling track, not a replacement for the product roadmap above.

### Why this matters now

- intelligence and Dependabot require request-time secrets
- the static report product should stay simple to host and share
- auth, user state, and runtime integrations should not leak into the static deployment model

### Planned shape

- `apps/site`
  - static Astro
  - GitHub Pages / static hosting
  - report browsing and public analytics
- `apps/app`
  - hosted Astro SSR
  - authenticated shell
  - intelligence and user-aware features
- `apps/runtime`
  - Bun/Effect API
  - Better Auth
  - Dependabot and AI integrations
  - Neon Postgres-backed state

### Delivery order

1. auth server first in `apps/runtime` with Better Auth and Neon
2. hosted Astro shell on Azure Container Apps
3. migrate intelligence out of the static app
4. add Dependabot as a hosted feature
5. only then extract shared packages where duplication is proven

### Architectural rule

Do not turn the static report product into a half-server app.

If a capability needs:

- auth
- request-time secrets
- persistent user state
- provider credentials

it belongs in the hosted product.

## Current Strengths

Planetnik already has strong coverage for:

- structural analysis
- file and unit metrics
- contributor and temporal signals
- dependency and coupling visualizations
- searchable report navigation

## Primary Gap

Planetnik still under-serves the main buying question:

- which hotspots should a team act on first

That is the gap CodeScene emphasizes through Code Health, prioritization, and engineering guidance.

## Priority 1: Planetnik Health and Hotspots

Build a scoring and explanation layer across files, units, and components.

### Outcomes

- ranked hotspot queues
- explainable score breakdowns
- trend direction, not just absolute metric values
- drill-through into the existing pages

### Inputs to combine

- churn
- temporal coupling
- static dependency centrality
- duplication
- conditional complexity
- contributor concentration / bus-factor risk
- file age and freshness

### Deliverables

- `hotspots` export contract from analyzer/reports
- `/hotspots` Astro page
- file, unit, and component hotspot views
- explanation cards such as:
  - high churn + high temporal coupling
  - large module + high complexity + low ownership spread
  - stable core dependency with rising change pressure

### Why first

This is the shortest path from “interesting report” to “engineering management product”.

## Priority 2: Goals, Controls, and Findings

Turn existing backend capability into a real product surface.

### Current state

- analyzer and exporter support controls already exists
- Astro parity expects `/controls` and `/findings`
- both pages are still placeholders

### Deliverables

- traffic-light controls dashboard
- trends against target ranges
- failed and tolerant controls queue
- findings page wired to exported data
- optional goal packs such as:
  - maintainability baseline
  - team ownership baseline
  - coupling control pack

### Why second

This is a fast win with high product value and low research risk.

## Priority 3: Coupling Studio

Build a coupling workbench using Vlad Khononov style “balanced coupling” thinking, but start with the dimensions Planetnik can support credibly now.

### Phase 3A: First-class coupling views

- static/module coupling
- temporal coupling
- afferent/efferent coupling

These are already close to current data or can be derived from current exports.

### Phase 3B: Higher-order coupling

- semantic coupling
- lifecycle coupling
- runtime coupling
- connascence-informed signals

These likely require new analyzers and clearer contracts.

### Suggested product surface

- `/coupling` overview
- per-component coupling profiles
- “balanced vs overloaded” coupling score
- dependency rationale panels:
  - incoming pressure
  - outgoing volatility
  - co-change intensity
  - semantic overlap

### Why third

This can become a real differentiator, but it should deepen hotspot explanations rather than replace them.

## Priority 4: Domain Navigator

Use DDD ideas to connect code structure to domain shape.

### Product direction

- bounded context map over codebase structure
- domain language extraction from names and semantic clusters
- context ownership and drift indicators
- cross-context change pressure
- domain hotspot views

### Good first slice

- context map from logical decompositions
- domain glossary per component
- cross-context coupling score

### Why fourth

High strategic value, but it needs the hotspot and coupling layers underneath to avoid becoming a static model diagram.

## Priority 5: Cynefin Overlay

Apply Cynefin as a decision support overlay, not as the core analysis model.

### Best use

- portfolio and leadership view
- classify hotspots or components by intervention style
- distinguish:
  - clear
  - complicated
  - complex
  - chaotic

### Product surface

- “how should we intervene” panel on hotspots
- complexity-mode overlays for systems or bounded contexts
- guidance on suitable action:
  - refactor
  - stabilize ownership
  - reduce runtime coupling
  - run experiment
  - add guardrail

### Why fifth

Strong framing tool, but weaker than hotspots for day-to-day engineering workflow. It should interpret the data, not precede it.

## Recommended Sequence

1. Planetnik Health and Hotspots
2. Goals, Controls, and Findings UI
3. Coupling Studio
4. Domain Navigator
5. Cynefin Overlay

## What Not to Prioritize Next

- more standalone visualizations without actionability
- replacing stable charting/table stacks again
- executive framing models before engineering prioritization works

## Next Build Slice

The next concrete feature should be:

- hotspot scoring export
- `/hotspots` route
- explainable score breakdowns

In parallel, the fastest tactical follow-up is:

- wire `/controls`
- wire `/findings`

## Delivery Slices by Scope

This is the practical implementation split for the ideas currently on the table.

### Astro Only

These can ship from the data already loaded in `apps/site`.

#### Small

- `/controls` page shell using existing `controls.txt` if we add only frontend parsing inside the page
- richer contributor risk cards from existing:
  - contributor details
  - people dependencies
  - commits per period
- ownership concentration views on `/components` using current `filesMain.contributors`
- bus-factor overlays on files, units, and components
- hotspot previews based on frontend-composed heuristics only

#### Medium

- knowledge distribution page using:
  - contributor counts
  - commits by contributor
  - files per contributor
  - components per contributor
- “single point of knowledge” explorer
- offboarding preview based on current contributor detail pages:
  - what files/components lose primary coverage if contributor X disappears
- coupling summary page using existing:
  - static dependencies
  - temporal dependencies
  - people dependencies

#### Large

- a first `Planetnik Health` UI built entirely from frontend-composed scores
- Conway-style visual overlays using inferred contributor clusters only

This is possible, but the score quality will be weaker than a backend-owned contract.

### CLI Export and Astro Loader Update

These are the highest-leverage next slices because they produce stable data contracts without requiring brand new analyzers.

#### Small

- export structured `controls.json` instead of only `controls.txt`
- add Astro loader and collection for controls
- export structured `findings.json` if findings input already exists in report generation flow
- add Astro loader and collection for findings
- export a normalized `ownership_summary.json`
  - files per contributor
  - components per contributor
  - backup contributor counts

#### Medium

- export `hotspots.json` using a first weighted scoring formula over existing metrics
- export `knowledge_distribution.json`
- export `component_health.json`
- export `contributor_risk.json`

#### Large

- export scenario-style offboarding summaries:
  - contributor removed
  - affected files
  - affected components
  - controls likely to fail
  - hotspots worsened

This is still feasible without new analyzers if it is driven by current git-history ownership signals.

### Beyond Loader and Export: New Analyzer or New Input Model

These require new semantics, not just reshaping existing data.

#### Medium

- afferent/efferent coupling if we decide current dependency export is not enough and want first-class analyzer support
- semantic coupling based on lexical similarity or co-naming
- lifecycle coupling as a distinct contract rather than inferred from commits and ownership

#### Large

- Conway alignment with explicit team mapping
- team-to-system congruence scoring
- bounded-context drift detection
- runtime coupling
- connascence-informed signals

#### Extra Large

- Cynefin classification engine
- robust offboarding simulation with team substitution and control impact forecasting
- DDD context map generation with inferred domain language and socio-technical ownership alignment

These need either:

- new config input
- richer org metadata
- new analyzer passes
- or all three

## What We Can Do Now

If the goal is maximum product value with minimal new backend work, the best immediate sequence is:

1. Astro-only knowledge distribution and bus-factor views
2. structured `controls.json` export plus Astro `/controls`
3. first `hotspots.json` export
4. Astro `/hotspots`
5. offboarding preview based on existing contributor ownership

## T-Shirt Sizing Summary

### Small

- `/controls` from existing exports
- bus-factor and ownership overlays
- knowledge distribution summaries

### Medium

- structured controls/findings contracts
- `/findings`
- first hotspot scoring export
- first coupling overview page
- offboarding preview from current contributor data

### Large

- full hotspot engine across file/unit/component
- knowledge distribution product surface
- balanced coupling workbench
- Conway alignment with team model

### Extra Large

- Cynefin overlay
- DDD/domain navigator
- advanced semantic/runtime/lifecycle coupling
- robust offboarding simulation with scenario analysis

### OWASP updates realtime security threat tracking
tbc


## References

- CodeScene Code Health: https://codescene.com/code-health
- Behavioral code analysis in practice: https://codescene.com/hubfs/web_docs/Behavioral-code-analysis-in-practice.pdf
- Module coupling overview: https://coupling.dev/posts/related-topics/module-coupling/
- Integration strength dimension: https://coupling.dev/posts/dimensions-of-coupling/integration-strength/
- Cynefin reference material: https://thecynefin.co/wp-content/uploads/2021/11/Cynefin-book-SAMPLE_Ed01.pdf
