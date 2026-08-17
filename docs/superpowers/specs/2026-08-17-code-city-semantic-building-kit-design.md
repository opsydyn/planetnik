# Code City Semantic Building Kit — Design

**Date:** 2026-08-17  
**Status:** Proposed — visual design approved in conversation; implementation not authorised  
**Depends on:** [Code City WebGL UI design](./2026-08-16-code-city-ui-design.md)

## Goal

Increase the descriptive and visual fidelity of Code City with a restrained,
Minecraft-like building language. The city should feel like a place made of
voxel materials while remaining an auditable view of canonical analysis data.

The visual system must answer two questions at once:

1. What structural facts does this building or parcel represent?
2. Which analytical lens is currently active?

The first answer uses stable geometry and materials. The second uses surface
treatment, lighting, route emphasis, and small accents. Switching lenses must
not reshuffle the city or silently change its meaning.

## Locked visual decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Art direction | Semantic-first Minecraft | Voxel character without decorative noise or game mechanics |
| Fidelity level | Semantic building kit | A small deterministic primitive library; no full voxel engine |
| Stable geometry | Structure and topology | Silhouette remains comparable across lenses |
| Lens treatment | Materials, textures, lighting, and accents | Analytical questions can change without moving evidence |
| Building identity | One building per canonical file ID | Preserves the existing model boundary |
| Hub landmarks | Dependency-hub districts | Current canonical topology is district/component-level, not file-level |
| Texture source | Procedural/generated atlas | Avoids downloaded texture packs, asset weight, and provenance concerns |
| Variation | Seeded orientation/tiling only | Same snapshot and layout seed produce the same city |
| Scope | Single repository first | Landscape aggregation and hosted integration remain follow-ons |

## Semantic grammar

Every visible distinction must be traceable to a canonical field or an
explicitly documented derived value.

| Visual part | Source property | Meaning |
| --- | --- | --- |
| Parcel base and border | district kind (`component` or `path`) | Explicit bounded context vs derived grouping |
| Material family | file extension and source set | Language/file family, with test files retaining their source family |
| Main mass | LOC, bounded and log-scaled | Structural footprint |
| Floor bands and windows | unit count and unit LOC | Internal implementation density |
| Roof style | stable role bucket from available structure | Flat, pitched, stepped, or capped silhouette |
| Dome or tower | weighted incident dependency score for the district | Topological importance, not health severity |
| Bridge or buttress | multi-district affiliation | Explicit cross-context relationship |
| Beacon, flag, or trim | active analytical lens | Health, impact, change, ownership, or complexity accent |
| Texture and wear | active analytical lens | Surface expression of a measured signal, never a new metric |

The current model exposes dependency edges at district/component level. The
first implementation therefore places domes and towers on hub parcels. It
must not invent file-level dependency hubs. File-level landmarks require a
future canonical topology contract and a separate design decision.

Missing properties produce neutral geometry or an unavailable surface state;
they do not produce guessed architecture.

## Building kit

The renderer should use a small library of reusable low-poly, voxel-aligned
primitives:

- block, slab, and stepped base;
- flat, pitched, and cap roofs;
- floor band and window-row modules;
- cupola, dome, and tower modules;
- bridge, buttress, and route-support modules;
- beacon, pennant, and trim modules.

The scene adapter derives renderer-neutral visual tokens such as
`materialFamily`, `buildingArchetype`, `roofStyle`, `landmarkTier`, and
`texturePattern`. These tokens are not new analysis data and must not leak
into `packages/common` as fabricated canonical fields.

### Stable building forms

- Extension controls the base material family.
- Source set controls a secondary form: test files use a lighter annex roof or
  checker-window treatment while retaining the same language family.
- LOC controls bounded height and floor count; a minimum mass keeps small files
  selectable.
- Unit count and unit LOC control façade segmentation, not additional city-wide
  geometry.
- Component affiliation controls corner/buttress treatment where the model
  explicitly lists more than one district.
- Stable role buckets may choose roof styles, but the bucket must be derived
  from available model facts and documented in the adapter tests.

### Dependency landmarks

Derive a weighted incident score from canonical component dependency edges. Use
relative tiers so thresholds remain meaningful across repositories:

- local parcel: no landmark;
- connected parcel: small cupola or roof marker;
- hub parcel: dome and short tower;
- super-hub parcel: larger dome, tower, and raised bridge approaches.

The implementation should cap major landmarks per view and measure the chosen
relative thresholds against complete and dense fixtures. A noisy snapshot must
not become a forest of towers.

## Material and texture language

The first fidelity pass should use shared procedural or generated canvas
textures, not per-building image assets.

Suggested base families are:

- TypeScript/JavaScript: warm brick or copper blocks;
- Rust: ironstone with darker metal trim;
- JSON/YAML/configuration: glazed tile or glass-block treatment;
- CSS/HTML: plaster or slab treatment;
- Markdown/documentation: paper or wood treatment;
- unknown/generated: neutral slate.

The exact palette remains a token decision, but every family must combine hue
with a pattern or surface cue so colour is not the only signal. Texture scale
must remain stable in world units and avoid moiré at overview zoom.

Lens overlays are deliberately restrained:

- **Health:** wear, cracks, darkened grout, and severity trim;
- **Impact:** brighter incident routes and target-façade accents;
- **Change:** amber scaffolding or construction trim;
- **Ownership:** banners or pennants, with contributor count also written in
  the inspector;
- **Complexity:** denser/darker window patterns or rooftop machinery;
- **Unavailable:** desaturated neutral material and explicit text.

Overlays never alter parcel coordinates, building mass, archetype, or landmark
tier. Shape, pattern, and text reinforce colour for accessibility.

## Civic geography and hierarchy

- Component districts receive bordered civic parcels and a central-plaza
  treatment.
- Derived path districts receive simpler street-block parcels and an
  explicit derived marker.
- Parcel identity remains stable; active lenses do not recolour the entire map
  into an unrelated geography.
- District labels remain visible at overview scale.
- The hierarchy is parcel boundary/label, hub landmark, building silhouette,
  lens accent, then fine texture.

Existing dependency routes remain authoritative. Selection raises and brightens
incident routes; unresolved edges remain diagnostics rather than speculative
scenery.

## Renderer and level of detail

Three.js should reuse a small number of geometries and materials with
instancing. It must not allocate unique textures or complex meshes per file.

- **Overview:** parcel, main mass, roof silhouette, hub landmarks, and district
  labels.
- **District focus:** floor bands, windows, bridges, richer parcel texture, and
  selected route emphasis.
- **Building focus:** selected façade detail; units remain primarily in the
  inspector.
- **Dense mode:** simplify texture and decorative modules, then offer the
  table view explicitly.

The renderer remains a client-only concern. Astro loaders and canonical JSON
adapters remain unaware of Three.js. The fallback table continues to represent
every entity and evidence link.

## Interaction invariants

- Lens changes preserve coordinates, archetypes, and landmark tiers.
- Selection preserves the camera.
- Focus is explicit and reversible.
- Reduced motion removes pulses and easing, not semantic emphasis.
- Hover previews identity but does not open the inspector or move the camera.
- Every visual entity has a keyboard/table equivalent.

## Verification boundary

Before implementation is considered complete, the slice must prove:

1. visual-token derivation is deterministic for a fixed model and seed;
2. permutations of model arrays do not change positions or archetypes;
3. extension/source-set/LOC/unit/component mappings have focused tests;
4. hub tiers derive only from canonical component edges;
5. missing optional signals produce neutral/unavailable treatments;
6. lens changes preserve scene geometry;
7. complete, partial, and dense fixtures render honest degraded states;
8. browser captures show stable arrangement and visible semantic distinction;
9. draw calls, mesh count, bundle cost, first interaction latency, and repeated
   layout stability are recorded;
10. the table fallback remains complete and evidence-linked.

This design does not claim native renderer parity, runtime parsing, landscape
aggregation, file-level dependency synthesis, or a full game-like voxel world.

## Proposed implementation slices

1. Add a renderer-neutral visual-token contract and golden fixture expectations.
2. Add procedural material families and a shared texture atlas.
3. Add deterministic building archetypes and hub landmark tiers.
4. Add instanced kit rendering with overview/district/building detail levels.
5. Add lens overlays, accessibility cues, and fallback parity.
6. Run the direct browser interaction and performance matrix, then decide
   whether this design is ready to supersede the provisional Code City ADR.

No implementation slice is authorised by this document alone.
