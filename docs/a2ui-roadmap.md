# A2UI Roadmap

## Goal

Use A2UI to evolve Planetnik intelligence from a chat panel with one-off actions into a set of composed, stateful investigation surfaces that feel native to the product.

The roadmap should improve the hosted intelligence experience without destabilizing the static report product or betting the whole UX on a still-evolving specification.

## Scope

This roadmap is only about A2UI:

- how Planetnik should adopt declarative generative UI
- where it should land first in the product
- which capabilities should come before others
- what guardrails are required before broader rollout

This roadmap does **not** reopen the broader hosted-platform split. That direction is already covered by:

- [Hosted Intelligence Plan](/Users/alan/Projects/planetnik/docs/hosted-intelligence-plan.md)
- [ADR-0015: Adopt Separate Static Reports and Hosted Runtime for Intelligence](/Users/alan/Projects/planetnik/docs/adr/0015-adopt-separate-static-reports-and-hosted-runtime-for-intelligence.md)

## Current State

Planetnik already has a strong intelligence foundation, but it is not yet A2UI-driven.

### What exists today

- `apps/app` and `apps/site` already use CopilotKit chat components
- intelligence context is grounded through `useCopilotReadable`
- charts and navigation are exposed through client-side `useCopilotAction` hooks
- the intelligence panel persists across route changes when navigation stays inside the client router
- `@planetnik/report-ui` already provides reusable chart and report components
- `apps/runtime` already provides the hosted intelligence runtime boundary

### What does not exist yet

- no A2UI catalog definitions
- no A2UI renderer wiring
- no agent-generated multi-component surfaces
- no A2UI data-model workflows
- no client-side `checks` validation driven by generated UI
- no catalog negotiation or versioning strategy
- no hosted intelligence flows designed specifically for A2UI

### Practical implication

Today, Planetnik intelligence is best at:

- answering grounded questions in text
- rendering a chart inline
- navigating the user to a page

It is weaker at:

- composing several UI elements into one cohesive investigation surface
- holding state across a multi-step workflow
- guiding users through compare, filter, and triage flows without pushing everything back into text chat

## Product Positioning

A2UI should not replace the existing intelligence model all at once.

It should add a new layer above the current chat and action system:

- keep the existing CopilotKit chat experience
- keep imperative actions for reliability and fallback behavior
- add A2UI where a generated surface is genuinely better than plain text or a single chart

That means the first A2UI wins should be workflows where users benefit from:

- a short diagnosis
- a visual summary
- recommended next actions
- lightweight interactive state

## Adoption Principles

### Hosted app first

Start in `apps/app`, not `apps/site`.

Reasons:

- `apps/app` is the natural home for richer, stateful intelligence flows
- hosted intelligence already owns the runtime boundary and secret-dependent behavior
- the static site should stay simple and low-risk until the A2UI pattern is proven

### Keep the current action model as fallback

Do not rip out the current `useCopilotAction` flows immediately.

A2UI should first complement:

- `navigateToPage`
- inline chart actions
- existing grounded chat responses

This creates a safe fallback path when generated UI fails validation, is unsupported, or does not add enough value.

### Prefer a Planetnik catalog over the basic catalog for real product work

The built-in A2UI catalog is useful for prototyping, but Planetnik should not stop there.

For production-facing work, the agent should learn a Planetnik-specific component vocabulary built around existing report concepts, such as:

- pressure summaries
- hotspot rankings
- severity breakdowns
- impact opportunities
- suggested navigation cards
- report-specific charts and tables

### Treat A2UI v0.9 as a pilot until it proves stable enough

The current A2UI v0.9 specification is promising, but it is still draft.

Planetnik should therefore:

- prototype against v0.9 features that materially improve UX
- keep rollout behind a feature flag at first
- preserve a non-A2UI fallback for critical hosted intelligence paths
- avoid making the static site depend on draft-only behavior early

## Target User Outcomes

The roadmap is successful when users can do more than chat about the codebase.

### Primary user outcomes

- inspect a hotspot through a single generated investigation surface
- compare repositories or components without re-describing state in chat
- move from diagnosis to action through suggested follow-up UI
- stay inside a flow long enough to refine filters, thresholds, or selections
- trust that generated UI still feels like Planetnik, not a generic widget pack

### First candidate experiences

1. **Pressure zone brief**
   - short diagnosis
   - top reasons
   - supporting chart
   - direct next action
2. **Security storm summary**
   - severity distribution
   - affected repositories
   - recommended drill-down
3. **Impact opportunity surface**
   - top opportunities
   - dimension breakdown
   - follow-up actions
4. **Compare flow**
   - choose repositories or components
   - apply thresholds
   - generate a summary view

## Roadmap

### Phase 0: Capability Audit and Design Spike

Outcome:

Planetnik has a clear, low-risk A2UI starting point before product wiring begins.

Deliverables:

- audit current CopilotKit and runtime compatibility for A2UI support
- confirm whether the current runtime can support the first A2UI slice directly or needs a targeted upgrade path
- inventory current intelligence actions, readable context, and reusable `@planetnik/report-ui` components
- prototype three target surfaces in A2UI Composer or equivalent local experiments
- define the initial feature flag and fallback behavior
- decide whether the first slice uses only built-in A2UI components or immediately introduces a custom Planetnik catalog

Exit criteria:

- one written technical recommendation for the first implementation slice
- three proven UI concepts with clear product value
- a documented fallback path when A2UI is unavailable or invalid

### Phase 1: Catalog Foundation in `apps/app`

Outcome:

The hosted app can render Planetnik-branded A2UI surfaces using a controlled catalog.

Deliverables:

- add the A2UI renderer package(s) required by the chosen CopilotKit version
- wire A2UI support into the hosted intelligence provider in `apps/app`
- define an initial versioned catalog, such as `planetnik-core/v1`
- implement a small set of renderers backed by existing report UI components
- establish theme conventions for agent name, icon, and brand color alignment
- document catalog naming and versioning rules

#### Recommended first catalog surface area

- `PressureSummaryCard`
- `HotspotBarChart`
- `SeverityDonut`
- `ImpactOpportunityList`
- `SuggestedNavigation`

Exit criteria:

- `apps/app` can render mocked A2UI surfaces from the initial catalog
- catalog IDs and versioning rules are defined
- unsupported components degrade safely instead of breaking the UI

### Phase 2: First Live Agent-Driven Surfaces

Outcome:

The hosted intelligence experience can return real A2UI surfaces for high-value investigations.

Deliverables:

- enable A2UI generation behind a hosted-app feature flag
- keep current text and action-based flows available as fallback
- ship the first three live A2UI experiences:
  - pressure zone brief
  - security storm summary
  - impact opportunity surface
- add product rules for when the agent should prefer A2UI over plain text
- ensure generated surfaces can still hand off to existing navigation actions

Exit criteria:

- at least three real intelligence prompts can produce useful A2UI surfaces from live data
- users can still complete the same tasks when A2UI is disabled
- the generated surfaces feel materially better than the old one-chart-at-a-time interaction

### Phase 3: Stateful Investigation Workflows

Outcome:

Users can refine and complete multi-step investigations through generated UI instead of pushing all state back into chat.

Deliverables:

- adopt `sendDataModel` for selected workflows
- add generated filters, selectors, and lightweight forms
- introduce client-side `checks` for required fields and common validation rules
- support compare flows for repositories, components, or hotspot subsets
- add explicit patterns for handoff from generated UI to navigation or chart drill-down
- ensure session persistence and route changes do not wipe active investigation state unnecessarily

#### Good first workflows

- compare two repositories
- filter hotspots by severity and dominant dimension
- set thresholds before generating a ranked summary
- choose one of several recommended next actions from a generated surface

Exit criteria:

- a user can complete at least one multi-step investigation without retyping state into chat
- invalid inputs are blocked or corrected on the client side
- the runtime receives enough state to produce context-aware follow-up UI

### Phase 4: Runtime and Data Access Hardening

Outcome:

A2UI is backed by server-side intelligence capabilities, not only prompt-compressed frontend context.

Deliverables:

- move the highest-value A2UI flows onto server-side data access in `apps/runtime`
- define a clear runtime contract for A2UI-capable intelligence actions and surface generation
- ensure the runtime can work with hosted datasets beyond a trimmed prompt summary
- add logging or observability for A2UI generation, validation failures, and fallback behavior
- support catalog negotiation and version-aware rollout where appropriate
- keep the backend framework choice open unless the implementation work proves a stronger requirement

#### Architectural rule

Do not make A2UI depend on stuffing larger and larger summaries into prompt context.

If a flow needs:

- full dataset filtering
- large result sets
- comparison across many records
- saved or resumable state

it should be backed by the hosted runtime, not by ever-larger frontend-readable blobs.

Exit criteria:

- the first important A2UI workflows are powered by runtime data access
- A2UI failures are observable and debuggable
- the hosted runtime can serve richer flows than the static prompt-only pattern

### Phase 5: Shared Catalog and Optional Site Rollout

Outcome:

Planetnik can selectively reuse proven A2UI surfaces across products without forcing the static site into hosted-app complexity.

Deliverables:

- extract stable catalog definitions and renderers into shared code where duplication is proven
- define which surfaces are safe for `apps/site` and which remain hosted-only
- introduce read-only A2UI surfaces to the static site only if they add clear value
- keep hosted-only flows for anything that needs request-time secrets, user state, or large runtime queries
- verify that the site can gracefully avoid A2UI when runtime support is absent

#### Recommended scope for `apps/site`

Only bring over:

- read-only summary cards
- simple guided drill-down surfaces
- chart-plus-recommendation experiences that work without authenticated state

Do not bring over first:

- stateful compare workflows
- saved investigations
- anything that requires runtime-only data access

Exit criteria:

- shared catalog code is real and justified, not speculative abstraction
- `apps/site` remains optional and low-risk for A2UI usage
- hosted intelligence remains the primary home for advanced A2UI flows

### Phase 6: Default-On Maturity

Outcome:

A2UI becomes a dependable part of Planetnik intelligence for selected flows.

Deliverables:

- define which flows are A2UI-first by default
- add snapshot-style tests or contract tests for generated surfaces
- track usage, failure rates, and fallback frequency
- document authoring rules for prompts, catalogs, validation, and graceful degradation
- version catalogs cleanly as the component set evolves
- build a migration path for older catalog versions if needed

Exit criteria:

- selected hosted intelligence workflows are A2UI-first with confidence
- validation failures do not create broken-user experiences
- catalog changes can ship without surprise regressions

## Workstreams

### Frontend and Catalog

Owns:

- renderer setup
- catalog definitions
- theme alignment
- graceful degradation
- feature flags
- shared renderers where proven

### Runtime and Agent

Owns:

- A2UI-capable runtime flow
- server-side data access for richer surfaces
- validation, logging, and failure handling
- catalog negotiation support where needed

### Product and UX

Owns:

- deciding when A2UI is better than text or a chart action
- prompt and component authoring rules
- workflow design for triage, compare, and recommendation
- rollout order for hosted versus static experiences

### Quality and Observability

Owns:

- validation and fallback coverage
- instrumentation for render failures and retries
- test fixtures for representative surfaces
- regression checks for catalog changes

## Non-Goals

For the first dedicated A2UI push, do not aim for:

- replacing the entire intelligence experience with generated UI
- retiring existing `useCopilotAction` flows immediately
- making `apps/site` the primary A2UI target
- shipping draft-only behavior without a rollback path
- treating the basic catalog as the long-term Planetnik design language
- rebuilding report pages as agent-generated screens

## Recommended First Build Slice

The best first implementation slice is:

1. complete the capability audit and design spike
2. wire A2UI into `apps/app` behind a feature flag
3. create a tiny Planetnik catalog with a handful of high-value components
4. ship one real hosted experience: the pressure zone brief
5. preserve existing chart and navigation actions as fallback
6. measure where A2UI is actually better than current chat plus actions

If that slice feels strong, add:

- security storm summary
- impact opportunity surface
- one stateful compare flow

## Risks

### Risk: draft-spec churn

Mitigation:

- keep the first rollout flagged
- version the catalog explicitly
- maintain fallback paths for key workflows

### Risk: generated UI feels generic

Mitigation:

- move quickly from the basic catalog to Planetnik-specific components
- reuse existing `@planetnik/report-ui` building blocks

### Risk: the runtime stays too thin

Mitigation:

- move richer flows onto hosted runtime data access before scaling the surface area
- do not rely on larger prompt summaries as the long-term answer

### Risk: site complexity leaks upward

Mitigation:

- keep `apps/app` as the first-class A2UI home
- only bring proven, read-only surfaces to `apps/site`

## Success Criteria

This roadmap is working when:

- `apps/app` delivers at least three A2UI-backed intelligence experiences that are better than plain chat
- users can complete at least one multi-step investigation through generated UI
- A2UI failures degrade safely to existing flows
- catalog evolution is versioned and testable
- `apps/site` remains optional and low-risk for A2UI adoption
- hosted intelligence becomes more guided and less chat-box-bound

## References

- [A2UI Protocol v0.9](https://a2ui.org/specification/v0.9-a2ui/)
- [A2UI Catalogs](https://a2ui.org/concepts/catalogs/)
- [CopilotKit A2UI guide](https://docs.copilotkit.ai/generative-ui/a2ui)
- [CopilotKit built-in agent A2UI notes](https://docs.copilotkit.ai/built-in-agent/generative-ui/a2ui)
- [AG-UI backend overview](https://docs.copilotkit.ai/backend/ag-ui)
- [ADR-0013: Adopt CopilotKit for Intelligence View](/Users/alan/Projects/planetnik/docs/adr/0013-adopt-copilotkit-for-intelligence-view.md)
- [Hosted Intelligence Plan](/Users/alan/Projects/planetnik/docs/hosted-intelligence-plan.md)
