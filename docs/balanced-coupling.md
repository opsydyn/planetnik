# Balanced Coupling

## Purpose

The balanced coupling view answers a simple question:

- which components are overloaded because several kinds of coupling pressure are piling up at the same time

It is not just a dependency chart. It combines structure, change, coordination, and knowledge exposure into one view so teams can spot the components most likely to behave like a "big ball of mud".

## Current Inputs

The first Planetnik implementation derives its model from existing site data:

- logical component mapping from `files_main.json`
- static component dependencies from `component_dependencies.json`
- the widest exported temporal coupling window from `temporal_dependencies.json`
- component hotspot dimensions from `hotspots.json`

This means the page is currently a site-side model, not yet a dedicated CLI export contract.

## Dimensions

Each component gets four scores:

- `staticCoupling`: pressure from incoming and outgoing component dependencies
- `temporalCoupling`: pressure from files that repeatedly change together across component boundaries
- `coordinationCoupling`: contributor overlap and shared change traffic across components
- `knowledgeRisk`: thin ownership, weak backup coverage, and hotspot knowledge signals

Planetnik then derives:

- `overallLoad`: combined pressure across the four dimensions
- `balanceScore`: how evenly or unevenly the dimensions are distributed
- `systemicRisk`: final risk score used for ranking

## Risk Tiers

Current thresholds are:

- `Critical`: `>= 7.5`
- `High`: `>= 5.5`
- `Medium`: `>= 3.5`
- `Low`: `< 3.5`

These thresholds are intentionally simple so the model stays explainable while the product matures.

## How To Read The Page

Start with the `Big Ball of Mud` chart:

- the center summarizes average load, balance, and risk
- the outer ring shows the average mix of coupling dimensions across the system
- the orbiting nodes are the top risky components
- the selected component panel explains why that component is risky

Then validate with the supporting sections:

- `Average Coupling Mix` tells you what kind of pressure dominates the system
- `Dominant Dimension by Component` shows whether one failure mode is clustering across the architecture
- `Top Risk Components` gives you a ranked queue
- `Coupling Inventory` lets you search and inspect every component in the model

## Alert Simulation

The page supports an alert simulation mode for demos and UX work:

- `/coupling?alert-test`
- `/coupling?-alert-test`

When enabled:

- the page shows an "Alert simulation enabled" badge
- the mud ring pulses even if the real model has no critical components
- if there are no real critical nodes, Planetnik pulses the top-risk components so the alert state can still be evaluated

The in-chart toggle can switch the alert pulse on or off without losing the query-param mode.

## Current Limitations

- The view assumes the current component mapping exported into the site and does not yet model multiple decompositions independently.
- Temporal input uses the widest currently exported period rather than a dedicated coupling-specific contract.
- Semantic, lifecycle, runtime, and connascence-informed coupling are not part of this first slice yet.

## Next Likely Evolution

The next maturity step is to promote this from a site-derived view into a dedicated exporter contract, likely something like `balanced_coupling.json`, so the scoring model becomes stable, testable, and reusable across pages.
