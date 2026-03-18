# Site Search Checklist

Implementation checklist for ADR-0005.

## Phase 1: Data Model

- [ ] Add `fuse.js` to `apps/site/package.json`
- [ ] Create `apps/site/src/lib/search/types.ts`
- [ ] Define a normalized `SearchDocument` shape
- [ ] Define supported `kind` values for v1:
  - `page`
  - `file`
  - `unit`
  - `contributor`
  - `metric`
  - `extension`
- [ ] Add a shared result-group label helper if the UI needs grouped sections

## Phase 2: Search Corpus Builder

- [ ] Create `apps/site/src/lib/search/buildSearchDocuments.ts`
- [ ] Build page search documents for:
  - `/`
  - `/about`
  - `/overview`
  - `/metrics`
  - `/components`
  - `/dependencies`
  - `/duplication`
  - `/files/size`
  - `/files/age`
  - `/files/churn`
  - `/files/temporal`
  - `/units/size`
  - `/units/complexity`
  - `/contributors`
  - `/commits`
  - `/topology`
  - `/concerns`
  - `/findings`
  - `/controls`
  - `/trends`
- [ ] Build file search documents from `filesMain`
- [ ] Build unit search documents from `units`
- [ ] Build contributor search documents from `contributors`
- [ ] Build metric search documents from `metrics`
- [ ] Build extension search documents from `filesMain` or `commitsPerExtension`
- [ ] Keep v1 exclusions out of the builder:
  - duplicate blocks
  - dependency rows
  - temporal dependency rows
  - people dependency edges

## Phase 3: Fuse Configuration

- [ ] Create `apps/site/src/lib/search/fuseConfig.ts`
- [ ] Weight `title` and `keywords` highest
- [ ] Keep `subtitle` and `description` medium weight
- [ ] Keep `route` low weight
- [ ] Enable match metadata for highlighting
- [ ] Set fuzzy options deliberately rather than relying on defaults
- [ ] Keep config typed and colocated with the search document model

## Phase 4: Static Search Payload

- [ ] Create `apps/site/src/pages/search-index.json.ts`
- [ ] Return a static JSON payload built from content collections
- [ ] Decide whether to ship:
  - raw documents only
  - raw documents plus a prebuilt Fuse index
- [ ] Keep the payload compact enough for lazy client loading
- [ ] Validate that the endpoint works in both `astro dev` and `astro build`

## Phase 5: Search UI

- [ ] Create `apps/site/src/components/search/GlobalSearch.tsx`
- [ ] Add a trigger button suitable for desktop and mobile
- [ ] Support `Cmd+K` / `Ctrl+K`
- [ ] Fetch the search payload only on first use
- [ ] Instantiate Fuse client-side from the static payload
- [ ] Group results by kind
- [ ] Highlight matched terms
- [ ] Support keyboard navigation:
  - arrow keys
  - enter to open
  - escape to close
- [ ] Show an empty state for no results
- [ ] Show a loading state while the payload is fetched

## Phase 6: Dashboard Integration

- [ ] Mount the search trigger from `apps/site/src/layouts/Dashboard.astro`
- [ ] Make search available from every report page
- [ ] Ensure the trigger works in both the sidebar and mobile top bar if needed
- [ ] Keep the search UI visually aligned with the current dashboard shell

## Phase 7: Relevance Pass

- [ ] Test queries for page discovery:
  - `metrics`
  - `duplication`
  - `contributors`
  - `topology`
- [ ] Test queries for code entities:
  - file path fragments
  - function or unit names
  - contributor names or emails
  - metric names such as `LINES_OF_CODE`
  - extension queries such as `java`, `js`, `typescript`
- [ ] Adjust weights or keywords where obvious false positives appear
- [ ] Confirm that top results are stable across repeated searches

## Phase 8: Verification

- [ ] Run `bun run --filter site build`
- [ ] Manually verify search from the dashboard in `astro dev`
- [ ] Confirm search still works in `astro preview`
- [ ] Confirm lazy loading does not noticeably delay initial page render
- [ ] Confirm result navigation works without hydration errors

## Phase 9: Deferred Follow-ups

- [ ] Consider filters such as `Pages`, `Files`, `Units`, and `People`
- [ ] Consider precomputing and shipping a serialized Fuse index if payload size grows
- [ ] Consider indexing duplicates and dependency data only after measuring user value
- [ ] Consider adding a dedicated `/search` route if the modal-only approach feels limiting
