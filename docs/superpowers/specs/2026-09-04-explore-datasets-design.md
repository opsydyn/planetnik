# Explore Datasets — Design

**Date:** 2026-09-04

**Status:** Approved

**Depends on:** [ADR-0020: Static dataset catalogue and Explore surface](../../adr/0020-adopt-static-dataset-explore-catalog.md)

## Goal

Make Planetnik feel like a place to discover codebases, not a report that can
display only whichever dataset was selected before the build started.

Explore is a calm, static, searchable catalogue of verified canonical v2
snapshots. It helps a person choose the right repository or landscape, preview
what evidence exists, and enter a shareable report URL. It does not analyse
repositories, clone sources, or become a second dashboard.

The visual reference is the compact, stat-led example treatment seen in
[Sokrates](https://www.sokrates.dev/): a recognisable title, a short
description, and immediately useful scale/activity facts. Planetnik adds
snapshot identity, provenance, capability state, and evidence honesty.

## Product boundaries

### In scope

- A dedicated `/planetnik/explore` catalogue surface.
- Curated repository and organisation-landscape entries.
- Search, report-type/language/tag filters, and deterministic sorting.
- A preview state with provenance, headline metrics, available views, and
  honest partial/planned states.
- URL-addressable dataset routes for the first `overview` and `code-city`
  slices.
- A report-shell switcher that preserves the current lens when possible.
- Audience-aware emphasis for Onboarding, Architecture Review, and
  Stakeholder views.
- Server-rendered HTML with a small client island for catalogue interaction.

### Out of scope

- Runtime GitHub cloning or arbitrary repository analysis.
- User accounts, saved collections, personal curation, or a hosted API.
- A cross-dataset trends view.
- A landscape-root Code City; landscape and repository drilldown remain distinct
  concepts.
- Rewriting every existing report route before the first dataset route slice is
  proven.

## Core user questions

Explore should answer these questions in order:

1. **What can I look at?** — title, type, domain/language, and one-line
   description.
2. **Why is this interesting?** — a small set of comparable headline facts.
3. **Can I trust the snapshot?** — source, ref, licence, generated date,
   snapshot ID, and capability/coverage state.
4. **Where should I start?** — audience-aware starting view and a single clear
   primary action.
5. **Can I share or change it?** — stable dataset URL and a lens-preserving
   switcher.

## Information architecture

```text
Planetnik
├── Explore datasets
│   ├── Featured landscapes
│   ├── Repository pilots
│   ├── Language showcases
│   ├── Recently verified
│   └── Planned examples (clearly labelled, no fabricated metrics)
└── Selected dataset report
    ├── Overview
    ├── Code City
    └── Other capabilities as they migrate
```

The Explore shell is not rendered inside `Dashboard.astro`. It has its own
lightweight shell so an unselected visitor does not inherit the default
dataset's “Report for …” context. Once a dataset is open, the existing report
shell returns and includes an Explore link plus the active dataset identity.

## Opening experience

### Explore landing

The first viewport contains:

- the heading **Explore codebases**;
- a short explanation that these are frozen, evidence-backed snapshots;
- the search combobox and a compact filter control;
- one or two curated shelves, not an overwhelming wall of cards;
- a visible result count and an honest empty state.

Featured order is editorial but deterministic. A dataset is never promoted to
Featured merely because it is large or famous; it must have a valid snapshot,
usable provenance, and a reason to teach or compare something useful.

### Card anatomy

Each ready or partial card contains:

1. **Identity row** — logo or deterministic initials, title, and a
   `Repository` or `Landscape` badge.
2. **Description** — one sentence written for a person choosing a dataset,
   not a raw repository README excerpt.
3. **Headline facts** — a consistent subset of repositories, KLOC, files,
   contributors, and commits, with unavailable values omitted rather than
   rendered as `0`.
4. **Language strip** — the top languages by LOC with text labels available to
   assistive technology.
5. **Trust row** — generated date, source/ref, licence where known, and
   `Ready`, `Partial`, or `Planned` state.
6. **Actions** — `Open report` as the primary action, `Preview` or `View
   source` as the secondary action.

Cards use the same metric labels as the selected report's dashboard. KLOC is a
display abbreviation only; the underlying descriptor retains exact integer LOC.

### Preview

Preview is a reversible detail panel on wide screens and a full-page detail
state on narrow screens. It shows:

- the full descriptor and source/provenance fields;
- a capability list such as `Overview`, `Code City`, `Impact`, or `Trends`;
- a coverage note for partial snapshots;
- the recommended first action for the selected audience;
- a `Copy link` affordance for the dataset route;
- no chart that requires loading the full report shards.

The full-page state is the accessible and no-JavaScript fallback. Closing the
panel returns to the same filter and scroll position when the browser supports
it; the URL remains the source of truth for direct sharing.

## Search, filter, and sort

### Search

Use a labelled, keyboard-accessible combobox over the small catalogue projection.
Search matches title, description, language labels, tags, source organisation,
and report type. It does not index rendered report HTML or low-level rows.

Results update locally after the catalogue is server-rendered. No API request
or repository lookup is made as the user types.

### Filters

The first release exposes:

- `All`, `Repositories`, `Landscapes`;
- language family;
- curated tag;
- `Ready`, `Partial`, `Planned` (planned is opt-in and clearly separated);
- audience starting point.

Filters are represented in the URL when practical so a curated view can be
shared. Clearing filters is one action. An empty result state explains the
active filters and offers `Clear all`.

### Sort

The deterministic choices are:

- Featured;
- Recently verified;
- Largest by LOC;
- Most contributors;
- Name.

The default is Featured, with the editorial order supplied by the curation
manifest and stable tie-breaking by dataset ID.

## Audience-aware emphasis

Audience is a presentation preference, not a new data model. It reuses the
existing vocabulary and remains URL-addressable when the report is opened.

| Audience | Card emphasis | Recommended first view | Copy style |
| --- | --- | --- | --- |
| Onboarding | What the project is, languages, size, and a short orientation note | Overview | Explain terms and reduce choice |
| Architecture Review | Health, coupling, hotspots, impact, and capability coverage | Code City or Overview | Point at evidence and trade-offs |
| Stakeholder | Repositories, KLOC, contributors, commits, and snapshot age | Overview | Concise scale and movement language |

Audience changes prominence and the recommended CTA. It must not hide a valid
dataset, alter metric values, or silently choose a different snapshot.

## Dataset switcher

Once inside a report, the shell shows:

- the active dataset title and report type;
- a compact combobox labelled **Switch dataset**;
- the current lens/view;
- a short snapshot-age/provenance hint.

Selecting a target maps the current route to the target dataset. The mapping
rules are explicit:

1. Preserve the current lens when the target advertises the same capability.
2. Preserve `overview` for all valid targets.
3. If a requested view is unavailable, open the target landing page and explain
   which capability is missing.
4. Never mutate `PLANETNIK_DATASET` or require a rebuild for normal selection.
5. Use a full navigation for routes already covered by the graph/WebGL reload
   policy if Astro client navigation cannot preserve the island safely.

The switcher is a convenience. The URL remains the canonical selection state,
so copy/paste, back/forward, hard reload, and opening a new tab all work.

## Dataset contract and provenance

The browser receives a compact `DatasetDescriptor`, not a filesystem path. Its
snapshot facts are derived from canonical v2 JSON; editorial fields come from a
tracked curation manifest.

### Required display facts

Ready and partial entries must provide snapshot identity. Planned entries are
editorial recommendations and may omit snapshot facts until their analysis is
generated; they must never display invented replacements.

- stable dataset ID and URL slug;
- human title and report mode;
- snapshot ID, data version, and generated timestamp;
- source URL and pinned ref when available;
- licence/attribution when known;
- exact LOC and the source of each headline metric;
- language summary;
- advertised capabilities;
- availability and coverage diagnostics.

### Freshness language

Use concrete dates and restrained labels:

- `Verified 3 Sep 2026`;
- `Partial — impact evidence not exported`;
- `Planned — snapshot not generated`;
- `Stale — last verified over 90 days ago` (threshold to be set in the
  catalogue contract, not inferred in the client).

Do not imply that a stale snapshot describes the live repository. Do not show
planned cards with made-up LOC, contributor, commit, or health values.

## Curated sample set

The first set should demonstrate language, scale, domain, and topology variety.
The entries below are recommendations for the curation manifest, not a claim
that the snapshots already exist locally.

### Repository candidates

| Candidate | Why it earns a place | Audience value | Guardrail |
| --- | --- | --- | --- |
| [`openai/openai-python`](https://github.com/openai/openai-python) | A focused, production Python SDK with a clear public API and generated/client boundaries | Onboarding plus Python evidence | Pin a ref; verify Apache-2.0 attribution and generated-code treatment |
| [`fastapi/fastapi`](https://github.com/FastAPI/FastAPI) | A recognisable Python framework with cohesive modules | Architecture Review | Pin a ref and record the project licence |
| [`pallets/flask`](https://github.com/pallets/flask) | A smaller mature framework that keeps the city readable | Onboarding baseline | Keep as the small/medium comparison, not a headline “largest” example |
| [`tokio-rs/tokio`](https://github.com/tokio-rs/tokio) | Rust async runtime with distinctive module and dependency structure | Rust/tree-sitter showcase | Pin a stable tag and capture parser coverage diagnostics |
| [`effect-ts/effect`](https://github.com/effect-ts/effect) | TypeScript monorepo with explicit package boundaries | Component and monorepo showcase | Treat packages as structure, not as invented bounded contexts |
| [`microsoft/vscode`](https://github.com/microsoft/vscode) | Large TypeScript application with platform and extension topology | Dense-scene/LOD stress case | Do not feature until measured build and fallback behaviour are acceptable |
| [`huggingface/transformers`](https://github.com/huggingface/transformers) | Large, domain-heavy Python surface with broad model families | AI-domain comparison | Pin a ref and exclude unbounded generated artefacts if the analyser cannot represent them faithfully |
| [`kubernetes/kubernetes`](https://github.com/kubernetes/kubernetes) | Very large Go platform repository with operational topology | Large-scale LOD stress case | Separate stress shelf from onboarding; record analysis cost and coverage |

### Organisation-landscape candidates

Create landscape entries only after a bounded repository list and a successful
v2 export exist:

- **OpenAI OSS Landscape** — AI SDKs, examples, and infrastructure-adjacent
  repositories.
- **Hugging Face OSS Landscape** — model tooling and community infrastructure.
- **JetBrains OSS Landscape** — language tooling and developer-platform
  diversity.
- **Mozilla OSS Landscape** — browser/platform and community project variety.
- **Google Gemini Landscape** — an AI-focused portfolio contrast.

These names are inspired by the example-landscape pattern in Sokrates. They
must remain `planned` until the source organisation, selected repositories,
licences, pinned refs, analysis date, and snapshot IDs are recorded. The public
gallery should show a mix of small, medium, and large examples rather than
only organisation-scale cards.

### Curation rubric

Promote a candidate to `ready` only when it has:

- a public, pinned source and compatible licence;
- a reproducible analysis command and v2 manifest;
- a useful reason to exist in the gallery;
- at least one meaningful capability beyond a headline count;
- no secrets, private paths, or unsafe shard references;
- direct browser smoke evidence at the target route;
- a documented refresh or deprecation owner.

## Responsive and accessibility behaviour

- Desktop: two- or three-column cards with a preview panel that does not
  destroy catalogue context.
- Tablet: two columns with filters in a disclosure.
- Mobile: one-column cards, sticky search, filters in a bottom sheet or native
  disclosure, and preview as a full-page state.
- All card actions are real links/buttons with visible focus.
- The search control uses native input semantics and an announced result count.
- Status is expressed with text and iconography, never colour alone.
- Cards remain useful in reduced-motion mode and with JavaScript disabled.
- The selected dataset, audience, filter, and preview state have an obvious
  focus/heading relationship for screen readers.

## Visual language

Explore should feel like a civic index of code, not an admin table:

- generous whitespace and a restrained card border;
- a small deterministic mark derived from the dataset ID or supplied logo;
- one accent colour for Planetnik actions and a separate, documented status
  treatment for Ready/Partial/Planned;
- compact stat chips with aligned labels and exact values;
- language colour is supplementary, with text labels always present;
- no decorative 3D scene is required on the catalogue card before the actual
  Code City route is opened.

This keeps visual delight in service of recognition and trust. A future card
thumbnail may be a deterministic Code City preview, but it must not become a
second renderer or a source of unverified claims.

## Failure and empty states

### No valid datasets

Explain that the build contains no valid v2 snapshots and link to local dataset
setup documentation. Do not render an empty grid with fake placeholder cards.

### Invalid entry

Keep the entry out of normal results. Build diagnostics name the dataset ID,
failed validation, and the missing/unsafe shard. A curator can fix it without
touching the UI.

### Partial entry

Show the available report and a compact coverage note. Missing optional lenses
are visibly unavailable and never represented as zero.

### Stale entry

Keep it discoverable if the curator marks it useful, but make the date and stale
state prominent and remove it from the default Featured shelf.

### Route failure

If a dataset URL cannot resolve at build time, show a safe not-found state with
`Back to Explore`. Do not fall back to another dataset silently.

## Performance and build constraints

- The catalogue descriptor should be small enough to inline or lazy-load as one
  compact JSON payload.
- Explore cards are server-rendered; only search/filter/sort needs hydration.
- Dataset report shards are loaded at build time for the route that needs them,
  not downloaded wholesale by Explore.
- Code City remains lazy WebGL with its existing HTML fallback and density
  guardrails.
- Multi-dataset build size and build duration must be measured before adding
  very large stress candidates to the default deployment.
- No performance claim is published until a repeatable local and CI measurement
  exists.

## Acceptance criteria

### Catalogue and routing

- [ ] `/planetnik/explore` renders all valid local v2 descriptors before client
      hydration.
- [ ] Cards show consistent headline metrics, language labels, provenance, and
      availability without reading TXT/HTML projections.
- [ ] Planned entries never display fabricated metrics or an enabled report
      link.
- [ ] Dataset landing, `overview`, and `code-city` routes are statically
      generated with safe URL IDs.
- [ ] Existing top-level report URLs still resolve the environment-selected
      default dataset.

### Interaction and accessibility

- [ ] Search, filters, sorting, result count, and clear-all work with keyboard
      input and visible focus.
- [ ] Preview preserves catalogue context on desktop and has a full-page mobile
      and no-JavaScript fallback.
- [ ] The shell switcher preserves a supported lens and explains unsupported
      capabilities without changing the snapshot silently.
- [ ] Direct links, hard reload, browser back/forward, and open-in-new-tab work
      for Explore and the first dataset routes.
- [ ] Ready/Partial/Planned and unavailable lens states remain understandable
      without colour or hover.

### Evidence and quality

- [ ] Current Python, complete Code City, partial, and invalid fixtures cover
      the catalog validator and route states.
- [ ] At least one small, medium, and large repository and three language
      families are verified before the gallery is described as diverse.
- [ ] A first curated organisation landscape is not promoted until its bounded
      repository list, licence/provenance, and v2 report are recorded.
- [ ] Site typecheck, focused tests, static build, and direct browser smoke
      evidence pass before release.
- [ ] A visual capture demonstrates desktop and mobile Explore, preview, and
      report switching without a broken shell or misleading empty state.

## Rollout

1. Land the catalogue contract and curation manifest with the current local
   fixtures only.
2. Ship Explore and preview while the existing one-dataset report build remains
   the compatibility path.
3. Add explicit dataset routes for `overview` and `code-city`.
4. Add the shell switcher and direct-link evidence.
5. Promote verified repository candidates, then one organisation landscape.
6. Expand route parity and CI packaging only after the first route slice is
   stable.

## Open follow-ons

- Add a deterministic Code City thumbnail to cards once the renderer has a
  stable capture path.
- Add same-repository snapshot trends to the preview when Phase 3 is delivered.
- Let the future hosted app consume the catalogue contract without importing
  Astro pages or static filesystem loaders.
- Revisit whether planned candidates should be public or curator-only after the
  first release has evidence on choice overload and stale-data comprehension.
