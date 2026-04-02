# ADR-0015: Adopt Separate Static Reports and Hosted Runtime for Intelligence

## Status

Accepted

## Context

Planetnik already has a strong static report product:

- [apps/site](/Users/alan/Projects/planetnik/apps/site) is a static Astro app driven by generated report JSON
- the current GitHub Pages deployment flow builds that static site directly from analysis output
- the report model already supports both single-repository and landscape data

That product should remain the default and cheapest deployment path.

At the same time, Planetnik now has features that no longer fit cleanly inside a static-only model:

- the intelligence UI currently lives inside the static site and depends on `PUBLIC_COPILOT_RUNTIME_URL`
  - [intelligence.astro](/Users/alan/Projects/planetnik/apps/site/src/pages/intelligence.astro)
  - [IntelligencePanelLoader.astro](/Users/alan/Projects/planetnik/apps/site/src/components/intelligence/IntelligencePanelLoader.astro)
  - [astro.config.mjs](/Users/alan/Projects/planetnik/apps/site/astro.config.mjs)
- [apps/copilot-runtime](/Users/alan/Projects/planetnik/apps/copilot-runtime) is a thin Bun-side runtime, but it has no auth, no persistent state, and no clear server-side ownership boundary
- Dependabot and future hosted intelligence features need request-time secrets, GitHub credentials, and authenticated user state

This creates two architecture decisions that are hard to reverse once implementation spreads through the repo:

1. whether to keep forcing intelligence and auth-adjacent features into `apps/site`
2. which runtime stack should own hosted auth and server-side features

The relevant repo constraints are already clear:

- ADR-0001 established Bun, Effect, and `@effect/schema` as the core runtime stack:
  - [ADR-0001](/Users/alan/Projects/planetnik/docs/adr/0001-effect-ts-with-bun-runtime.md)
- the shared app extraction plan explicitly says to share presentation and view-models, not pages, auth middleware, filesystem loaders, or runtime integrations:
  - [shared-app-extraction-plan.md](/Users/alan/Projects/planetnik/docs/shared-app-extraction-plan.md)
- the hosted intelligence plan already identifies a two-product split as the pragmatic direction:
  - [hosted-intelligence-plan.md](/Users/alan/Projects/planetnik/docs/hosted-intelligence-plan.md)
- the product roadmap now depends on a hosted product for secret-dependent features:
  - [product-roadmap.md](/Users/alan/Projects/planetnik/docs/product-roadmap.md)

The user also made two implementation constraints explicit during planning:

- use Neon as the auth database
- keep Effect and `@effect/schema` as the default schema and application patterns rather than making Zod the new repo-wide default

We therefore need one accepted ADR that settles the platform split, runtime ownership, and v1 auth/data stack for hosted intelligence.

## Decision

We will adopt a two-product architecture:

1. `apps/site` remains the public static report product
2. hosted intelligence and auth move to a separate `apps/app` plus `apps/runtime` deployment model

### Delivery model

#### Static reports

- `apps/site` remains static Astro
- it continues to build from generated report JSON
- it continues to support low-friction deployment such as GitHub Pages
- it does not gain auth middleware, database access, or request-time provider secrets

#### Hosted product

- `apps/app` will be a new authenticated Astro SSR application
- `apps/runtime` will be the new Bun runtime service for auth and secret-dependent operations
- hosted deployment targets Azure Container Apps rather than GitHub Pages

### Runtime ownership

`apps/runtime` owns:

- Better Auth endpoints
- session and user resolution
- intelligence orchestration and tool execution
- Dependabot and GitHub-backed features
- persistent application state
- database access

`apps/app` owns:

- authenticated shell and route protection
- session-aware navigation
- hosted intelligence presentation
- user-facing pages for authenticated and secret-dependent features

`apps/site` keeps:

- public report browsing
- dashboards, metrics, topology, hotspots, impact, controls, and other read-only report views

### Hosted auth and database stack

For v1 hosted auth and persistent state we will use:

- Better Auth for auth and session handling
- Drizzle ORM for database access and Better Auth persistence
- Neon Postgres as the backing database
- a standard Drizzle Neon connection path for auth and Better Auth integration

We are explicitly **not** choosing `drizzle-orm/effect-postgres` for the v1 auth path.

Reason:

- Better Auth already has a clear Drizzle integration path
- Neon is the chosen database provider
- auth is the part of the platform where novelty should be minimized first

### Application core policy

The hosted runtime remains Effect-first:

- `Effect` remains the default application and orchestration model
- `@effect/schema` remains the default schema, validation, and contract layer
- configuration, domain logic, and runtime service boundaries should follow the Effect patterns already accepted in ADR-0001

Zod is **not** adopted as the new repo-wide schema layer by this ADR.

### Transport policy

The HTTP shell for `apps/runtime` may use Bun primitives directly or a thin framework such as Elysia, but transport remains secondary to the core application model.

If Elysia is used:

- it is a transport adapter around Effect-based services
- it does not redefine the repo as an Elysia-first or Zod-first codebase

### Intelligence backend policy

This ADR does **not** choose a long-term agent framework such as Mastra.

For the first hosted slice:

- the runtime only needs to support hosted intelligence behind an authenticated runtime boundary
- existing CopilotKit-compatible runtime behavior may evolve incrementally inside `apps/runtime`
- future agent-backend choices remain open until the hosted shell, auth, and runtime boundary are in place

### Non-goals

- no conversion of `apps/site` into a hybrid static/server app
- no auth middleware in `apps/site`
- no move of all report pages into `apps/app`
- no multi-tenant report registry in the first hosted slice
- no commitment to Mastra, LangChain, or another agent framework in this ADR
- no use of `drizzle-orm/effect-postgres` for v1 auth integration
- no repo-wide shift from `@effect/schema` to Zod

## Why This Option

- It preserves Planetnik's strongest current deployment model instead of weakening it.
- It creates an explicit runtime boundary for secrets, sessions, and provider credentials.
- It matches the current product roadmap rather than forcing hosted capabilities into a static architecture.
- It uses a Better Auth + Drizzle + Neon combination that is already proven in the reference auth application the team has been consulting.
- It keeps the repo aligned with ADR-0001 by treating Effect and `@effect/schema` as the architectural core rather than as optional implementation details.
- It avoids making two risky decisions at once. The platform split and auth boundary are accepted now; deeper agent-framework choices are deferred until the hosted boundary exists.

## Consequences

- Planetnik will have two deployable application surfaces instead of one.
- Infrastructure and CI/CD become more complex because GitHub Pages and Azure Container Apps will coexist.
- The intelligence feature will stop being a production concern of the static site and become a hosted concern instead.
- Some duplication will exist temporarily between `apps/site` and `apps/app` until the planned shared package extraction is proven.
- `apps/copilot-runtime` is no longer the long-term product name or ownership boundary; it becomes the migration starting point for `apps/runtime`.
- ADR-0014 is no longer the active platform direction for the first hosted slice because this ADR defers long-term agent-backend framework selection until after auth and runtime separation are in place.

## Related ADRs

- ADR-0001: Effect TS with Bun Runtime
- ADR-0003: Backend-only parity, Astro frontend
- ADR-0013: Adopt CopilotKit for Intelligence View
- ADR-0014: Server-Side Intelligence Tools, Mastra Agent Backend

## Implementation Plan

- **Affected paths**:
  - [docs/hosted-intelligence-plan.md](/Users/alan/Projects/planetnik/docs/hosted-intelligence-plan.md)
  - [docs/product-roadmap.md](/Users/alan/Projects/planetnik/docs/product-roadmap.md)
  - [docs/shared-app-extraction-plan.md](/Users/alan/Projects/planetnik/docs/shared-app-extraction-plan.md)
  - [apps/site/src/pages/intelligence.astro](/Users/alan/Projects/planetnik/apps/site/src/pages/intelligence.astro)
  - [apps/site/src/components/intelligence](/Users/alan/Projects/planetnik/apps/site/src/components/intelligence)
  - [apps/site/src/layouts/Dashboard.astro](/Users/alan/Projects/planetnik/apps/site/src/layouts/Dashboard.astro)
  - [apps/site/astro.config.mjs](/Users/alan/Projects/planetnik/apps/site/astro.config.mjs)
  - [apps/copilot-runtime](/Users/alan/Projects/planetnik/apps/copilot-runtime) as the migration source for `apps/runtime`
  - new `apps/app/**`
  - new `apps/runtime/**`
  - [package.json](/Users/alan/Projects/planetnik/package.json)
  - [.github/workflows/deploy.yml](/Users/alan/Projects/planetnik/.github/workflows/deploy.yml)
  - new hosted deployment workflows under [.github/workflows](/Users/alan/Projects/planetnik/.github/workflows)

- **Dependencies**:
  - add hosted-app dependencies needed for Astro SSR, including `@astrojs/node` in `apps/app`
  - add runtime auth/database dependencies for Better Auth, Drizzle, and Neon in `apps/runtime`
  - keep `effect` and `@effect/schema` as first-class runtime dependencies
  - do not add `@mastra/core` or `drizzle-orm/effect-postgres` as required dependencies for the first hosted auth slice
  - do not add Zod as the default schema dependency for new hosted runtime contracts unless a specific library boundary requires it

- **Patterns to follow**:
  - follow ADR-0001 stack policy: Bun runtime, Effect-first services, `@effect/schema` for validation and contracts
  - keep Astro pages, middleware, and runtime integrations app-local as described in [docs/shared-app-extraction-plan.md](/Users/alan/Projects/planetnik/docs/shared-app-extraction-plan.md)
  - keep `apps/site` file-backed and static-first
  - use Astro middleware in `apps/app` for session resolution and protected-route redirects
  - use Better Auth with Drizzle-backed Neon tables inside `apps/runtime`
  - keep the first hosted data strategy simple: one report root per deployment, using the existing report artifact shape

- **Patterns to avoid**:
  - do not add auth, session, or request-time secret handling to `apps/site`
  - do not expose hosted secrets or credentials through `PUBLIC_*` env vars
  - do not make `apps/app` responsible for direct database ownership beyond session-aware web concerns
  - do not adopt a Mastra-first backend or another agent framework as part of the platform split itself
  - do not use `drizzle-orm/effect-postgres` for the first Better Auth integration
  - do not turn Zod into the default contract layer for new hosted code

- **Configuration changes**:
  - keep `apps/site` limited to report-path and genuinely public config
  - add hosted runtime secrets only to `apps/runtime`, including:
    - `DATABASE_URL`
    - `BETTER_AUTH_SECRET`
    - `BETTER_AUTH_URL`
    - provider credentials for AI and GitHub-backed integrations
    - any runtime CORS or cookie-domain settings needed for the hosted shell
  - add hosted app server-side config only to `apps/app`, such as the runtime base URL used for middleware session resolution
  - do not require `PUBLIC_COPILOT_RUNTIME_URL` for the hosted intelligence path

- **Migration steps**:
  - treat [apps/copilot-runtime](/Users/alan/Projects/planetnik/apps/copilot-runtime) as the starting point for `apps/runtime`
  - build the auth server in `apps/runtime` before creating `apps/app`
  - prove sign-in, sign-out, and session lookup directly against `apps/runtime`
  - only after the runtime auth flow works, create `apps/app`
  - move the intelligence route and hosted-only intelligence entry points from `apps/site` into `apps/app`
  - keep static report routes in `apps/site`
  - only after the hosted slice works end to end, extract shared packages such as `report-ui` and `report-core`

### Verification

- [ ] `apps/site` still builds as a static Astro report app through the existing Pages-oriented deployment path
- [ ] hosted-only secrets such as `DATABASE_URL`, `BETTER_AUTH_SECRET`, AI credentials, and GitHub credentials are absent from `apps/site` public env usage
- [ ] `apps/app` exists as a separate Astro SSR application with server-side session resolution
- [ ] `apps/runtime` owns Better Auth endpoints and a health endpoint
- [ ] Better Auth persistence uses Drizzle with Neon-backed Postgres tables
- [ ] the v1 auth path does not require `drizzle-orm/effect-postgres`
- [ ] new hosted runtime code uses Effect and `@effect/schema` as the default core patterns
- [ ] hosted intelligence can run without relying on `PUBLIC_COPILOT_RUNTIME_URL` inside the production static site
- [ ] static report browsing routes remain in `apps/site` rather than being migrated wholesale into `apps/app`
- [ ] separate hosted deployment workflows exist for the authenticated app and runtime alongside the existing static deployment flow

## Alternatives Considered

### Keep one hybrid Astro app for both static reports and hosted intelligence

This would reuse one app directory and avoid adding new deployables.

We are not choosing it because it mixes static and hosted concerns in one place, makes env handling ambiguous, and would pressure the public report product into becoming a partial server app.

### Adopt Mastra now as the first hosted-runtime decision

This would settle the long-term agent backend at the same time as the platform split.

We are not choosing it because the immediate blocker is not agent orchestration sophistication. The blocker is the lack of a proper hosted boundary for auth, secrets, and session-aware features.

### Use `drizzle-orm/effect-postgres` for auth from the start

This would make the auth database path more Effect-native immediately.

We are not choosing it because Better Auth already has a straightforward Drizzle integration path, Neon is the selected database provider, and auth is the wrong place to increase stack novelty in the first hosted slice.

### Make Elysia and Zod the new runtime core

This would align the hosted runtime more closely with another internal reference app.

We are not choosing it because Planetnik already has an accepted Effect-first architecture. Elysia may be used as transport, but it does not replace Effect or `@effect/schema` as the core runtime model.

## More Information

- This ADR formalizes the direction already described in:
  - [docs/hosted-intelligence-plan.md](/Users/alan/Projects/planetnik/docs/hosted-intelligence-plan.md)
  - [docs/product-roadmap.md](/Users/alan/Projects/planetnik/docs/product-roadmap.md)
  - [docs/shared-app-extraction-plan.md](/Users/alan/Projects/planetnik/docs/shared-app-extraction-plan.md)
- A future ADR may choose the long-term hosted intelligence backend once the hosted app/runtime boundary and auth stack are in place.
