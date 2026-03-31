# Hosted Intelligence Plan

## Goal

Keep Płanetnik easy to deploy as a static report product, while introducing a separate authenticated hosted app for intelligence and other runtime-secret features.

The core constraint is simple:

- the existing static site must remain the default and cheapest deployment path
- intelligence and Dependabot features must stop relying on build-time-exposed public env vars
- authentication, runtime secrets, and user state must live in a server-side deployment

## Decision

Use **two delivery modes**, not one hybrid app trying to do everything:

1. **Static Reports**
   - current `apps/site`
   - no auth
   - static Astro build
   - deployable to GitHub Pages or another static host
   - driven entirely by generated report JSON

2. **Hosted Intelligence**
   - new authenticated Astro app plus runtime API
   - deployed to Azure Container Apps
   - Better Auth backed by Neon Postgres
   - runtime-only secrets for AI and GitHub integration

This is the pragmatic split. It preserves the static product instead of turning it into a compromised pseudo-server app.

## Why Not One App

Trying to keep one Astro app that sometimes behaves like a static report and sometimes like an authenticated server product will make every concern worse:

- deployment becomes harder
- environment-variable handling becomes ambiguous
- auth middleware leaks into the static product
- build and runtime assumptions mix together
- simple report hosting stops being simple

The static report product is a strength. Do not weaken it.

## Current State

### What we already have

- `apps/site` is static Astro and works well for report publishing
- report generation and JSON contracts are already strong
- intelligence already exists in the site UI, but depends on runtime configuration such as `PUBLIC_COPILOT_RUNTIME_URL`
- Dependabot-related backend capability already exists in the CLI/domain layer
- the reference Astro + auth + ACA example proves the deployment pattern:
  - Astro server output with `@astrojs/node`
  - middleware-based session resolution
  - Better Auth
  - Container Apps
  - Postgres-backed auth state

### What is missing

- a hosted runtime boundary for secrets
- auth and session handling
- persistent user/account data
- a clear split between public reports and authenticated capabilities
- a dedicated deployment topology for the hosted product

## Target State

### Public product

- `reports.planetnik.io`
- static, unauthenticated
- generated from analysis output
- ideal for repo reports, landscapes, demos, easy sharing

### Hosted product

- `app.planetnik.io`
- authenticated
- Astro SSR
- user-aware
- able to call protected intelligence and Dependabot services at runtime

### Runtime API

- `api.planetnik.io`
- Bun/Effect service
- owns Better Auth server endpoints
- owns AI orchestration and GitHub-backed features
- uses Neon Postgres for auth and persistent application state

## Recommended Repo Shape

Keep the static app where it is and add hosted concerns as separate apps:

```text
apps/
  site/            # existing static report app
  app/             # new authenticated Astro SSR app
  runtime/         # new Bun/Effect API for auth, intelligence, dependabot
packages/
  report-ui/       # shared UI and presentational components (later extraction)
  report-models/   # shared data contracts/helpers (later extraction)
```

Do **not** start by extracting everything. First prove the hosted slice, then extract only what is obviously shared.

## Deployment Topology

### Static Reports

- GitHub Pages or Azure Static Web Apps
- built from generated report JSON
- no database
- no secrets required at request time

### Hosted Intelligence

Deploy to Azure Container Apps:

- one ACA environment
- one container app for `app`
- one container app for `runtime`
- optional later worker container app for long-running jobs
- ACR for container images
- Log Analytics for observability
- Neon Postgres for Better Auth and app state

### Secret handling

Runtime secrets should exist only in ACA secrets and app settings:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- AI provider secrets
- GitHub integration secrets or app credentials
- any internal API keys

These should never be exposed through `PUBLIC_*` variables in the hosted product unless they are genuinely public.

## Authentication Model

### Recommended v1

Use Better Auth backed by Neon Postgres.

Why:

- already proven in the reference repo
- good fit for Bun/TypeScript
- keeps auth at the application layer instead of forcing Azure Easy Auth too early
- works well with an Astro frontend and a Bun runtime API

### Session flow

- `app` uses Astro middleware to resolve the current session from `runtime`
- `runtime` exposes Better Auth endpoints
- session/user tables live in Neon
- protected routes in `app` redirect unauthenticated users

### Identity provider

Start simple:

- email/password or GitHub login first

Later:

- add Microsoft Entra ID once enterprise buyer pressure justifies it

## Runtime Ownership

### `apps/app`

Owns:

- authenticated shell
- user-aware navigation
- gated pages
- server-rendered route protection
- presentation for intelligence and Dependabot results

Should **not** own:

- long-running orchestration
- GitHub API business logic
- AI secret management
- auth database access beyond session checks

### `apps/runtime`

Owns:

- Better Auth server endpoints
- intelligence orchestration
- Dependabot integration
- GitHub API calls
- durable state and job records
- database access

This boundary keeps the web app thinner and easier to reason about.

## Data Strategy

Do not solve multi-tenant report storage in the first slice.

### v1

- hosted app reads the same report artifact shape we already generate
- pick one report root per deployment or environment
- intelligence works against the current loaded report dataset

### v2

- move report bundles to blob/object storage
- let the hosted app select a report by slug or workspace
- persist user actions, notes, and saved prompts in Neon

## Feature Placement

### Keep in static reports

- dashboards
- metrics
- coupling
- hotspots
- impact
- controls
- topology
- repository and landscape report browsing

These are read-only and report-driven.

### Move to hosted product

- intelligence chat
- any AI-assisted explanation or query feature
- Dependabot enrichment and alert workflows
- saved investigations
- user preferences
- authenticated actions

These need request-time secrets, auth, or persistence.

## Delivery Roadmap

### Phase 0: Protect the static product

Outcome:

- commit to `apps/site` remaining static-first
- remove pressure to make auth/runtime fit there

Deliverables:

- architecture plan
- route ownership map
- environment variable classification

### Phase 1: Runtime backbone

Outcome:

- secure server-side foundation exists before UI migration

Deliverables:

- `apps/runtime`
- Better Auth setup
- Neon Postgres schema
- health endpoint
- protected session endpoint
- ACA Terraform/Bicep baseline

Success criteria:

- user can sign in against the runtime
- runtime secrets exist only in ACA

### Phase 2: Hosted Astro shell

Outcome:

- authenticated web shell exists without migrating the whole product

Deliverables:

- `apps/app` Astro SSR app
- `@astrojs/node` standalone output
- auth middleware
- shared branding/theme from the report site
- simple dashboard and protected shell

Success criteria:

- unauthenticated users are redirected
- authenticated users see the hosted shell

### Phase 3: Intelligence migration

Outcome:

- intelligence leaves the static product cleanly

Deliverables:

- move current intelligence UI into `apps/app`
- runtime-backed chat/orchestration endpoint in `apps/runtime`
- replace public runtime URL dependency with internal authenticated calls

Success criteria:

- no AI runtime secrets in the static site
- hosted intelligence works end to end

### Phase 4: Dependabot feature

Outcome:

- GitHub-backed insights become first-class and authenticated

Deliverables:

- runtime service for Dependabot fetching and caching
- user-visible Dependabot pages in `apps/app`
- background job or scheduled refresh if needed

Success criteria:

- no GitHub tokens exposed client-side
- results are visible only to authenticated users

### Phase 5: Shared product layer

Outcome:

- reduce duplication without prematurely abstracting

Deliverables:

- extract shared UI components from `apps/site` and `apps/app`
- extract shared report readers/formatters
- shared route helpers where appropriate

Success criteria:

- duplication is reduced
- static and hosted apps still deploy independently

### Phase 6: Multi-report and workspace model

Outcome:

- hosted product grows beyond one dataset per deployment

Deliverables:

- report/workspace registry
- object storage for report bundles
- user-to-workspace access model
- saved queries, notes, and investigations

This is deliberately later.

## Recommended First Build Slice

Do this first:

1. add `apps/runtime`
2. stand up Better Auth with Neon
3. add `apps/app` with Astro SSR and auth middleware
4. move the existing intelligence route into `apps/app`

Do **not** start with:

- a total rewrite of `apps/site`
- multi-tenant report storage
- Entra integration
- background job infrastructure
- a shared mega-package refactor

## Environment Variable Policy

### Static app

Allowed:

- build-time report path configuration
- genuinely public configuration

Not allowed:

- AI secrets
- GitHub credentials
- auth secrets
- database credentials

### Hosted app and runtime

Allowed:

- request-time secrets
- auth configuration
- database connection strings
- provider credentials

This boundary is the main reason to split the products.

## Risks

### Risk: two apps drift visually

Mitigation:

- share theme tokens and selected UI components
- do not share everything too early

### Risk: hosted app becomes a second product

Mitigation:

- keep it focused on authenticated and secret-dependent capabilities
- leave report browsing in the static product unless a strong reason appears

### Risk: infra complexity grows too early

Mitigation:

- start with two ACA apps and Neon
- do not add queues/workers until feature pressure requires them

## Non-Goals

For the first hosted slice, do not aim for:

- full enterprise RBAC
- SSO-only auth
- multi-tenant billing
- fully dynamic report ingestion
- replacing the static deployment path

## Success Criteria

We are done with the first major platform split when:

- `apps/site` still deploys as a simple static report
- `apps/app` deploys to ACA as an authenticated Astro SSR app
- `apps/runtime` owns auth and secret-dependent operations
- Better Auth uses Neon Postgres successfully
- intelligence no longer depends on public runtime env vars in the static app
- Dependabot can be added without exposing GitHub credentials client-side
