# Team Topology Impact Plan

## Goal

Extend the team topology view so it shows not only who is connected to whom, but also:

- who acts as **glue**
- where contributor activity looks like **snacking**
- why those signals matter structurally

This should make `/topology` a socio-technical decision surface instead of only a collaboration graph.

## Recommendation

Yes, this belongs on the existing topology page.

It does **not** need a separate page first.

Reason:

- the graph already anchors contributor relationships
- glue is primarily a topology concept
- contributor snacking only becomes useful when read alongside contributor connections, collaboration breadth, and shared ownership

So the correct product move is:

1. backend-first contributor impact contract
2. topology page integration
3. contributor detail links and drilldowns

## Important Constraint

`glue` can be estimated from current exports.

`snacking` should **not** be derived only in Astro.

Why:

- current `impact.json` is scoped to files, units, and components
- it does not attribute structural leverage back to contributors
- UI-only contributor snacking would be hand-wavy and difficult to test

So this should follow the same pattern as the `/impact` work:

- exporter contract first
- tests
- real-data validation
- then Astro loader and page work

## Product Questions

The topology page should answer:

- who connects otherwise separate contributors or contributor clusters
- who is carrying cross-boundary coordination work
- who is active mostly in low-structural-leverage work
- where team collaboration looks healthy vs fragile

It should not answer:

- personal performance evaluation
- promotion decisions
- a definitive ranking of individuals outside code evidence

## Proposed Concepts

### Glue

A contributor with high structural coordination value.

Possible signs:

- connects to many otherwise weakly connected contributors
- touches many logical components
- appears across high-coupling or high-boundary-pressure areas
- provides backup coverage in fragile components
- reduces concentration risk by spanning ownership islands

### Snacking

A contributor whose visible activity is high, but whose recent work shows weak structural leverage.

Possible signs:

- many commits in low-impact units/files
- activity concentrated in weakly leveraged areas
- high visible activity but little contribution to complexity reduction, boundary shaping, or change enablement
- repeated work in areas that do not reduce systemic pressure

## What We Can Derive Today

### Good Astro-only candidates

These can be prototyped without new backend work if needed:

- contributor degree from `people_dependencies*.json`
- strongest contributor connections
- contributor collaboration breadth
- component footprint breadth from `contributor_details/*.json`
- simple “glue candidate” heuristics:
  - many collaborators
  - many components
  - many shared files

### What should stay backend-first

- contributor `glue_score`
- contributor `snacking_score`
- contributor `structural_impact_score`
- contributor dimension breakdown
- reason strings explaining those scores

## Proposed Export Contract

Add a new backend contract, for example:

- `contributor_impact.json`

Suggested shape:

```json
{
  "periods": [
    {
      "period_key": "all_time",
      "period_label": "All Time",
      "contributors": [
        {
          "email": "user@example.com",
          "display_name": "user",
          "glue_score": 0,
          "snacking_score": 0,
          "structural_impact_score": 0,
          "visible_activity_score": 0,
          "dimensions": {
            "complexity_reduction": 0,
            "boundary_shaping": 0,
            "knowledge_spread": 0,
            "coordination_relief": 0,
            "change_enablement": 0
          },
          "top_components": [],
          "top_routes": [],
          "reasons": [],
          "is_glue": false,
          "is_snacking": false
        }
      ]
    }
  ]
}
```

## Proposed Scoring Model

### Glue score

Build from:

- collaboration degree
- weighted edge count from people dependencies
- component breadth from contributor details
- cross-component span
- backup coverage contribution
- bridge-style score across collaboration graph

Possible v1 formula:

- `35%` topology centrality
- `25%` component breadth
- `20%` shared-files coordination load
- `20%` knowledge spread / backup contribution

### Snacking score

Build from:

- contributor visible activity
- weak structural leverage of touched items
- concentration of work in low-impact files/units

Possible v1 formula:

- `visible_activity_score`
- minus weighted average structural impact of touched files/units/components
- boosted when activity clusters in items already classified as weak-leverage

This should reuse the same impact dimensions as `/impact` where possible.

## UX Plan For `/topology`

### Summary cards

Add:

- `Glue contributors`
- `Snacking contributors`
- `Highest glue score`
- `Highest snack risk`

### Graph nodes

Add optional node decoration:

- ring or badge for `glue`
- muted warning badge for `snacking`

Do not overload the node body text.

### Selected contributor panel

When a contributor is selected, show:

- `glue_score`
- `snacking_score`
- `structural_impact_score`
- dominant dimension
- short reasons

### Strongest Connections table

Add columns like:

- `Contributor 1 glue`
- `Contributor 2 glue`
- `Snack risk`
- `Shared structural impact`

Only if the export contract supports it cleanly.

## Delivery Slices

### S

Backend-only spike:

- define contributor glue and snacking heuristics
- validate against real Sokrates data
- decide whether scores feel defensible

### M

Exporter + tests:

- add `contributor_impact.json`
- unit tests for scoring
- CLI integration test

### M

Astro integration:

- loader
- content schema
- topology summary cards
- selected contributor panel

### L

Graph enrichment:

- node badges
- glue/snacking filters
- stronger table integration

### XL

Cross-page integration:

- contributor detail page uses contributor impact signals
- impact page links back to glue/snacking contributors
- controls/findings incorporate socio-technical risk framing

## Verification

Backend:

- deterministic unit tests for glue and snacking scoring
- exporter snapshot/contract tests
- CLI report generation test

Real data:

- run against Sokrates
- confirm scores are selective and explainable
- confirm known bridge contributors rank plausibly
- confirm snack candidates are not just “low commit count”

UI:

- topology page renders without clutter
- node decorations remain legible
- contributor panel reasons are short and actionable

## Recommended Next Step

Do this backend-first, exactly like `/impact`.

Immediate next slice:

1. add a failing exporter test for `contributor_impact.json`
2. implement `glue_score` and `snacking_score`
3. validate on Sokrates
4. only then wire `/topology`
