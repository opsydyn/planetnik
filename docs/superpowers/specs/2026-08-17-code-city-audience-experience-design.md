# Code City Audience Experience — Design

**Date:** 2026-08-17
**Status:** Proposed — audience and narrative direction approved in conversation; implementation not authorised
**Depends on:** [Code City WebGL UI design](./2026-08-16-code-city-ui-design.md), [Code City semantic building kit](./2026-08-17-code-city-semantic-building-kit-design.md)

## Goal

Make Code City a first-class architecture storytelling instrument. A person
who does not know the repository should be able to form an accurate mental
model, understand one meaningful relationship, and follow that explanation to
the exact evidence page.

The product should serve three audiences without creating three cities:

- a new engineer onboarding into the repository;
- an experienced engineer reviewing boundaries, coupling, and risk;
- a product or technical stakeholder who does not work in source code daily.

The same canonical model, city coordinates, entity identities, lenses, and
evidence routes remain authoritative in every audience mode.

## North-star experience

> A first-time visitor feels guided; an expert remains in control; a
> stakeholder leaves with one accurate, memorable insight.

The first 30 seconds should answer four questions in order:

1. What repository and snapshot am I looking at?
2. What do the parcels, buildings, materials, and landmarks mean?
3. Which relationship or signal matters for this audience?
4. Where can I verify that claim?

The governing interaction sequence is **orientation → interpretation →
evidence**.

## Locked experience decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Audience control | Explicit `Audience` switch with Onboarding, Architecture Review, and Stakeholder modes | Makes the narrative choice visible and reversible |
| Data boundary | Existing canonical v2 JSON → `CodeCityModel` | Avoids a second data contract and preserves evidence truth |
| Presentation boundary | Pure `AudiencePresentationModel` derived from `CodeCityModel` | Keeps narrative rules deterministic, testable, and shared by static and hosted consumers |
| Geometry | Same city coordinates, building forms, and landmark tiers in every mode | Prevents mode changes from changing architectural facts |
| Storytelling | Optional “Explain this city” story rail | Guided help is available without forcing a tour on expert users |
| Camera | Preserve camera and selection on mode changes; allow movement only inside an opted-in story or explicit Focus action | Keeps user control and spatial memory intact |
| Copy | Deterministic, evidence-backed templates; no generated claims | Every statement must be auditable |
| Shareability | Audience and story state may be encoded in the URL | Makes onboarding and review links reproducible |
| Delight | Restrained transitions, evidence tethers, and architecture briefs | Adds memorability without turning the report into a game |

## Audience modes

Audience modes are narrative presets over the same city. They change emphasis,
terminology, label density, inspector ordering, and the first suggested action;
they do not change model identity, coordinates, or evidence availability.

| Mode | Opening question | Map treatment | Inspector emphasis | First suggested action |
| --- | --- | --- | --- | --- |
| **Onboarding** | “How is this repository organised?” | District names prominent, quieter routes, generous labels, friendly path-group terminology | Purpose, ownership, dependencies, glossary explanations, and “why this matters” copy | Select a district |
| **Architecture Review** | “Where are the boundaries and pressures?” | Context parcels dominant, dependency routes on selection, hubs and cross-context buildings highlighted | Coupling, boundary crossings, hotspots, ownership, impact, and exact evidence | Inspect a hub or boundary crossing |
| **Stakeholder** | “What deserves attention?” | Calm skyline, domain labels instead of file paths, consequential routes and landmarks only | Plain-language health, risk, impact, trend, and recommended evidence | Open the top concern |

### Shared mode rules

- The active audience is always visible in the control bar.
- Switching mode never silently filters entities or invents values.
- Existing selection and camera state are retained where the selected entity is
  still meaningful; otherwise the UI explains why the selection was cleared.
- Every mode has a short “What you’re seeing” explanation.
- Every important visual claim has a text equivalent and an evidence route.
- The table fallback uses the same mode-aware labels and ordering as the map.
- Missing signals remain unavailable and do not cause a mode to fall back to a
  fabricated score.

## Guided story rail

The story rail is an optional, dismissible narrative path launched by
**Explain this city**. It is a stateful aid, not an automatic tour that takes
control away from the user.

### Common story steps

1. **Orient** — show the whole city and explain the visual grammar.
2. **Name** — introduce the major districts and what each represents.
3. **Connect** — reveal the most meaningful dependency or boundary relationship.
4. **Prove** — open the inspector and connect the claim to exact evidence.

Each step has a stable identifier, a headline, a short explanation, a target
entity or relationship, an optional evidence route, and a completion condition.
The narrative is derived from the model and sorted by stable IDs and semantic
scores so the same snapshot produces the same story.

### Mode-specific narration

- **Onboarding:** “This is the `reports` context. It owns these
  responsibilities and depends on these neighbouring areas.”
- **Architecture Review:** “This boundary carries the strongest cross-context
  pressure.”
- **Stakeholder:** “This area combines high change activity with the largest
  delivery impact.”

The exact values and evidence links are inserted only when the relevant
canonical signals are present. If a step cannot be supported, the rail explains
that the evidence is unavailable and offers the next supported step rather than
replacing the claim with a guess.

### Story controls

- compact rail with progress, Back, Next, Skip, Replay, and Exit;
- explicit “Return to overview” after any story focus;
- immediate undo for every story-driven camera movement;
- Escape clears story focus and returns to the previous selection state;
- reduced-motion preferences remove easing and pulses while retaining semantic
  emphasis;
- story completion leaves the user at the final inspector/evidence state rather
  than navigating away unexpectedly.

Story camera movement is the one exception to the normal “selection does not
move the camera” rule, and is available only after the user opts into the
story. A manual selection or mode switch never triggers an implicit fly-to.

## Delight system

Delight is organised as a restrained vocabulary rather than a collection of
effects:

- **Arrival:** subtle camera easing after an explicit Focus action.
- **Reveal:** districts and buildings wake up in a short deterministic
  sequence during the onboarding story.
- **Connection:** a selected dependency path draws from source to destination
  once, then settles into the normal route emphasis.
- **Evidence tether:** a visual signal, inspector sentence, and evidence link
  highlight together so the explanation feels connected to proof.
- **Architecture brief:** the completed story or current audience view produces
  a concise, copyable summary of selected contexts, the key relationship, the
  concern, and its evidence links.

The experience must not add ambient particles, forced tours, sound, perpetual
animation, or decorative effects that compete with labels and evidence. Motion
is short, purposeful, interruptible, and disabled or reduced when the user
requests reduced motion.

## Heuristic quality bar

### Orientation and visibility

- repository, snapshot, audience, lens, selection, and camera state are
  visible or discoverable without leaving the city;
- the active story step and progress are obvious;
- dense mode and renderer fallback state are explicit;
- the user can always tell whether a value is measured, derived, or unavailable.

### Recognition and consistency

- the same material, silhouette, route, and lens vocabulary is reused across
  audience modes;
- labels and legends explain the visual grammar before detail is required;
- path groups and technical terms gain friendly explanations in Onboarding and
  Stakeholder modes without changing their underlying identity;
- map, inspector, and table use the same entity names and evidence routes.

### User control and recovery

- selection never moves the camera;
- Focus, story movement, and mode changes are explicit and reversible;
- Escape clears transient state;
- “Return to overview” restores the prior camera and selection context;
- a broken WebGL scene falls back without losing the active audience or
  evidence path.

### Evidence and trust

- every audience-generated sentence is assembled from canonical values and
  named evidence routes;
- unavailable data is labelled rather than inferred;
- unresolved dependencies remain diagnostics, not speculative scenery;
- presentation summaries expose their source links instead of becoming opaque
  marketing copy.

## Architecture and data flow

The new experience remains a renderer-neutral presentation layer:

```text
Canonical JSON
    ↓
CodeCityModel
    ↓
AudiencePresentationModel
    ├─ mode-specific labels and terminology
    ├─ emphasis and visibility rules
    ├─ deterministic story steps
    └─ evidence-backed summary facts
    ↓
AudienceSwitch + StoryRail + existing Map / Inspector / Table
```

### Proposed boundaries

- `AudienceMode` — the three public mode IDs and labels.
- `AudiencePresentationModel` — pure derivation of mode-aware copy,
  emphasis, suggested actions, and story facts.
- `AudienceSwitch` — persistent, accessible mode control.
- `StoryRail` — optional narrative state machine and controls.
- `ArchitectureBrief` — concise current-view or completed-story summary.
- Existing `CodeCityCanvas`, `CodeCityInspector`, and `CodeCityFallback` remain
  the visual/evidence primitives.

The new modules belong in `packages/report-ui` and must remain server-safe
unless they are explicitly client-only UI. Astro loaders and canonical JSON
adapters remain unaware of audience modes. No new fields are added to
`packages/common` unless a later feasibility slice proves that the existing
model cannot express a requirement.

### URL state

Audience and story state may be represented as safe, optional query parameters:

```text
/code-city?audience=architecture-review&story=boundary-pressure
```

Invalid or unsupported values fall back to the default audience and explain the
fallback in a non-blocking status message. URL state must not bypass the
canonical snapshot or create a second selection identity.

## State and failure behaviour

The presentation state is a small explicit state machine:

```text
idle
  └─ start story → story(step-1)
story(step-n)
  ├─ next/back → story(step-m)
  ├─ skip/exit → idle
  ├─ focus → story(step-n, focused)
  └─ complete → completed brief
```

- Invalid audience values resolve to the default mode and a status message.
- Missing signal shards produce neutral labels and unavailable copy.
- A story step with no supported target is omitted from the deterministic
  sequence.
- Empty or invalid Code City snapshots retain the existing route states and do
  not render a fictional story.
- WebGL unavailable, dense data, print, and keyboard use the complete fallback
  with the same audience-aware explanation and evidence links.
- If a selected entity disappears because a valid snapshot changes, selection
  is cleared with a visible announcement rather than silently pointing at a
  different entity.

## Responsive and accessibility requirements

- The Audience switch is a labelled button group with a visible active state.
- The story rail has a labelled heading, progress semantics, keyboard controls,
  and a clear exit action.
- Every visual story target has a fallback row and an equivalent inspector
  sentence.
- The map, story rail, and inspector stack predictably on narrow screens.
- Colour is never the only carrier of audience or signal meaning.
- Reduced motion removes non-essential transitions, not content or emphasis.
- Screen readers receive announcements for mode changes, story progress,
  selection, focus, fallback, and evidence availability.
- Print output uses the table/brief representation rather than a GPU canvas.

## Proposed implementation slices

1. **Audience contract:** add mode IDs, pure presentation derivation, mode
   switch, and mode-aware inspector/legend copy without camera movement.
2. **Story rail:** add deterministic four-step narratives, state transitions,
   explicit focus/restore, keyboard behaviour, and evidence tethering.
3. **Architecture brief:** add current-view/completed-story summaries and safe
   URL state for audience and story selection.
4. **Polish and acceptance:** add responsive styling, reduced-motion and print
   verification, browser interaction evidence, visual regression captures, and
   performance checks.

Each slice must preserve the existing Code City fallback and route contracts.
The slices should be implemented in this order so the narrative value is
validated before adding richer guided motion or shareable presentation output.

## Verification and acceptance

### Automated checks

The implementation must add focused tests for:

1. total audience-mode resolution and invalid-mode fallback;
2. stable mode-aware labels, ordering, and inspector emphasis;
3. deterministic story step derivation for complete, partial, and dense models;
4. story state transitions, skip/back/exit, and camera-restore contracts;
5. evidence-link resolution for every generated story claim and brief fact;
6. URL state parsing and safe fallback for invalid query values;
7. keyboard, reduced-motion, print, and table/fallback parity;
8. unchanged scene coordinates and entity identities across modes.

### Direct evidence

Before claiming the experience complete, verify in a real browser:

- switching all three audiences preserves the city and selected entity;
- each mode communicates its intended question within the opening viewport;
- the story rail can start, advance, go back, skip, replay, and exit;
- story focus is explicit, reversible, and reduced-motion safe;
- evidence tethers visibly connect the city, inspector, and report route;
- the architecture brief is accurate, copyable, and link-complete;
- URL-addressed audience/story state reloads consistently;
- no-WebGL, dense, print, keyboard, and mobile layouts remain useful;
- the table fallback explains the same selected claim as the map.

This evidence claims the audience experience only. It does not claim native
renderer parity, runtime parsing, landscape aggregation, new canonical shards,
or hosted-runtime integration.

## Explicitly out of scope

- Separate cities or separate data models per audience.
- LLM-generated explanations or untraceable narrative copy.
- New canonical exporters or parser work.
- Automatic camera tours outside the opted-in story rail.
- Free-camera flight, game mechanics, ambient particles, sound, or perpetual
  animation.
- Landscape-root aggregation or cross-repository storytelling.
- File-level dependency synthesis not present in the canonical model.
- Sharing Astro page files with the future hosted product.

## Self-review checklist

- [x] The audience switch is explicit and reversible.
- [x] All modes preserve the same canonical city and evidence routes.
- [x] Guided motion is opt-in and recoverable.
- [x] Missing data and invalid state behaviour are defined.
- [x] Accessibility, fallback, print, dense-data, and reduced-motion paths are
  included.
- [x] Delight is bounded to purposeful, evidence-supporting interactions.
- [x] Implementation is decomposed into bounded slices.
- [x] No implementation is authorised by this document alone.
