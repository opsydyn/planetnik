# Impact Plan

## Goal

Turn Planetnik's philosophy into a product surface that helps engineers distinguish visible activity from structural impact.

Working tagline:

> activity is visible. impact is structural.

## Why This Matters

Many engineering environments still reward visible throughput:

- commits
- pull requests
- tickets closed
- lines of code

That is useful context, but it is not a good proxy for meaningful engineering impact.

Planetnik is strongest when it helps users identify work that changes the system's future:

- reducing structural complexity
- improving boundaries
- lowering coupling pressure
- increasing knowledge spread
- enabling change for other teams
- removing recurring coordination friction

This aligns well with the framing in:

- Staff Engineer, "Work on what matters": https://staffeng.com/guides/work-on-what-matters/
- Hunter Walk, "The Best Startups Resist Snacks": https://hunterwalk.com/2016/06/18/the-best-startups-resists-snacks-im-not-talking-about-food/

## Decision

Yes, this merits a standalone page.

It should not be only a manifesto page and it should not live only inside `about` or `guide`.

It deserves a first-class route because it can become:

- a differentiating product narrative
- a translation layer from philosophy to code evidence
- a prioritization aid for staff engineers, tech leads, and engineering managers
- a bridge between `hotspots`, `coupling`, `dependencies`, `contributors`, and `controls`

However, implementation should start backend-first:

1. define and test a stable `impact.json` contract
2. validate the derived impact model against real data
3. wire Astro loader and schema
4. build the `/impact` page on top of proven data

## Route Recommendation

Add a dedicated route:

- `/impact`

This route should sit near:

- `/hotspots`
- `/coupling`
- `/controls`

It should also be linked from:

- `/guide`
- `/about`
- site search

## Product Positioning

The page should answer:

- what work matters here
- what kind of impact is structural rather than merely visible
- where the current codebase suggests high-leverage action
- where teams may be "snacking" on low-impact work

The page should not answer:

- individual performance evaluation
- compensation or promotion scoring
- a universal impact truth detached from context

## Core UX Shape

### Section 1: Hero

Short framing copy:

- not all work has equal impact
- activity is visible. impact is structural.

Then anchor the page in Planetnik's purpose:

- surface work that changes the shape, changeability, and resilience of the system

### Section 2: Visible Activity vs Structural Impact

Simple contrast panel:

- visible activity: commits, PRs, volume
- structural impact: complexity reduction, boundary improvement, knowledge spread, coupling relief

This section explains why Planetnik exists as more than a metrics dashboard.

### Section 3: "Avoid Snacking" SVG

Use a dedicated SVG visual based on the low/high effort and low/high impact 2x2.

Quadrants:

- low effort / low impact: snacks
- high effort / low impact: ghosts
- low effort / high impact: edits and leverage
- high effort / high impact: strategic work

This should be a Planetnik-native visual, not a copy of the reference art.

The SVG should support:

- theme awareness
- static labels first
- optional future overlays with live Planetnik data

### Section 4: What Matters in Code

Map staff-level concepts onto Planetnik evidence.

This is the heart of the page.

### Section 5: Current High-Leverage Signals

Show what Planetnik can already surface today, for example:

- overloaded components
- structurally risky hotspots
- weak ownership spread
- heavy temporal coupling
- brittle boundary pressure

This section should point directly to existing routes.

### Section 6: Impact Playbook

Small set of suggested action patterns:

- reduce complexity in hotspot cores
- stabilize overloaded boundaries
- spread knowledge in fragile components
- reduce repeated co-change clusters
- use controls to hold the line after improvement

## Concept-to-Metric Mapping

This is the most important product move: turn philosophy into a concrete data model.

### Can Be Mapped Now

| Concept | Planetnik Evidence | Current Source |
| --- | --- | --- |
| reducing system-wide complexity | hotspot structural risk, unit complexity, duplication, large files | `hotspots`, `units/complexity`, `duplication`, `files/size` |
| shaping boundaries | component dependencies, balanced coupling, temporal dependencies | `/dependencies`, `/coupling`, `/files/temporal` |
| working across boundaries | people topology, cross-component contributor spread | `/topology`, `/contributors`, contributor details |
| increasing delivery safety | controls and findings | `/controls`, `/findings` |
| spreading knowledge | contributor concentration, component ownership spread, bus-factor style signals | `/contributors`, `/components`, contributor details |
| enabling future change | lower coupling, lower hotspot pressure, stronger ownership spread | derived from existing routes |

### Needs New Derived Metrics

| Concept | Proposed Metric | Notes |
| --- | --- | --- |
| working across boundaries | `cross_boundary_change_score` | derive from component/dependency/contributor overlap |
| enabling others | `downstream_reuse_score` or `enablement_score` | requires stronger change lineage or dependency reuse evidence |
| reducing entropy over time | `entropy_delta` | requires trend export and clear before/after model |
| unblocking teams | `coordination_relief_score` | likely derived from people dependencies plus ownership concentration |
| finishing things | `closure_leverage_score` | requires trend and issue/goal completion context |
| editing vs snacking | `impact_to_effort_ratio` | effort side is weak today without richer delivery metadata |

## Backend-First Recommendation

This feature should start in the backend, not in Astro.

Reason:

- the value depends on the quality of the impact model
- we need to understand whether the derived signals are defensible before presenting them as product guidance
- a stable export contract makes the Astro loader and UI straightforward
- this should follow the same CLI-contract discipline as the other report surfaces

So the first real milestone is:

- `impact.json`
- exporter tests
- real-data validation against Sokrates

Only after that should we add:

- Astro loader
- content collection schema
- `/impact` page

## Proposed `impact.json` Contract

Top-level shape:

- `visible_activity`
- `structural_impact`
- `impact_opportunities`
- `impact_dimensions`
- `concept_mappings`
- `snacking_candidates`

### Suggested v1 structure

```json
{
  "visible_activity": {
    "commits": 0,
    "contributors": 0,
    "changed_files": 0,
    "changed_units": 0
  },
  "structural_impact": {
    "summary": {
      "overall_score": 0,
      "dominant_dimension": "boundary_shaping"
    },
    "dimensions": {
      "complexity_reduction": 0,
      "boundary_shaping": 0,
      "knowledge_spread": 0,
      "coordination_relief": 0,
      "change_enablement": 0
    }
  },
  "impact_dimensions": [
    {
      "id": "boundary_shaping",
      "label": "Boundary shaping",
      "score": 0,
      "reasons": []
    }
  ],
  "impact_opportunities": [
    {
      "id": "component:reports",
      "kind": "component",
      "name": "reports",
      "impact_score": 0,
      "dominant_dimension": "coordination_relief",
      "dimensions": {
        "complexity_reduction": 0,
        "boundary_shaping": 0,
        "knowledge_spread": 0,
        "coordination_relief": 0,
        "change_enablement": 0
      },
      "reasons": [],
      "evidence_links": []
    }
  ],
  "concept_mappings": [
    {
      "concept": "working across boundaries",
      "dimension": "boundary_shaping",
      "evidence": []
    }
  ],
  "snacking_candidates": [
    {
      "id": "file:foo",
      "kind": "file",
      "name": "foo",
      "visible_activity_score": 0,
      "structural_impact_score": 0,
      "reason": "high visible change with weak structural leverage"
    }
  ]
}
```

### Accepted v1 dimensions

- `complexity_reduction`
- `boundary_shaping`
- `knowledge_spread`
- `coordination_relief`
- `change_enablement`

These should be the canonical first-pass dimensions.

## TDD and Validation

This should be built under TDD, in the same style as the other CLI/report contracts.

Required order:

1. write failing exporter tests for `impact.json`
2. implement the export contract in `packages/reports`
3. validate the export on real Sokrates data
4. only then add Astro loader and page work

Minimum test coverage:

- unit tests for impact score composition
- exporter contract tests for the final JSON shape
- CLI integration test proving `generateReports` emits `impact.json`
- real-data spot checks against Sokrates before UI work starts

## Recommended Phases

### Phase 1: Contract and Scoring

Scope:

- define `impact.json`
- implement backend-owned dimension scoring
- exporter tests
- CLI integration test
- real-data validation

No Astro work in this phase.

### Phase 2: Astro Integration

Scope:

- Astro loader
- content collection schema
- `/impact` page shell
- philosophy-to-metric mapping
- SVG 2x2
- links into existing reports

This phase should consume proven backend data, not invent its own model.

### Phase 3: Richer Impact Model

Scope:

- improve derived dimensions
- add stronger concept mappings
- identify more credible `snacking_candidates`
- add reusable impact cards for dashboard, hotspots, and contributor/component pages

## Recommended Visuals

### 1. Impact vs Effort SVG

Purpose:

- teach the model
- create a memorable Planetnik visual
- support future overlays

### 2. Structural Impact Dimensions Chart

Possible form:

- horizontal bars
- stacked bar
- radar only if readability stays high

### 3. High-Leverage Opportunities List

This should look like an action queue, not a marketing section.

Each row should answer:

- what matters
- why it matters
- what evidence supports it
- where to go next

## What Not To Do

- do not make this an individual ranking page
- do not imply exact effort estimates without enough evidence
- do not overclaim causality from weak signals
- do not make the page purely inspirational with no drill-through
- do not duplicate `/hotspots`; this page should explain leverage and impact, not replace queues

## Recommendation

Build `/impact` as a standalone page, but do not start with the page.

Start with:

- backend-owned `impact.json`
- unit-tested scoring
- CLI contract verification
- real-data validation

Then build an explanation-led `/impact` page on top of that proven contract.

## Next Concrete Slice

1. Add failing exporter tests for `impact.json`.
2. Implement `impact.json` in `packages/reports` with the accepted dimensions.
3. Add a CLI integration test proving `generateReports` emits the contract.
4. Run the contract against Sokrates and validate the data shape and top opportunities.
5. Only then wire the Astro loader and `/impact` page.
