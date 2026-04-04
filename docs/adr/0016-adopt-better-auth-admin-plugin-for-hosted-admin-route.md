# ADR-0016: Adopt Better Auth Admin Plugin for the First Hosted Admin Route

## Status

Accepted

## Context

Planetnik now has a separate hosted application boundary:

- [apps/app](/Users/alan/Projects/planetnik/apps/app) is the authenticated Astro application shell
- [apps/runtime](/Users/alan/Projects/planetnik/apps/runtime) owns Better Auth, sessions, and persistent state

That split was accepted in:

- [ADR-0015](/Users/alan/Projects/planetnik/docs/adr/0015-adopt-separate-static-reports-and-hosted-runtime-for-intelligence.md)

The next hosted capability needed is a minimal admin-only route for operational access and future user management.

The current hosted auth implementation is not yet capable of that:

- [apps/runtime/src/db/schema/auth.ts](/Users/alan/Projects/planetnik/apps/runtime/src/db/schema/auth.ts) does not currently store a user role
- [apps/runtime/src/lib/auth.ts](/Users/alan/Projects/planetnik/apps/runtime/src/lib/auth.ts) does not enable Better Auth's admin plugin
- [apps/app/src/middleware.ts](/Users/alan/Projects/planetnik/apps/app/src/middleware.ts) protects authenticated routes, but has no admin-only branch
- [apps/app/src/lib/session.ts](/Users/alan/Projects/planetnik/apps/app/src/lib/session.ts) does not currently type or rely on `user.role`

The team has also been consulting a reference Better Auth implementation that already uses the admin plugin and documents the required schema additions:

- `/Users/alan/Projects/New Folder With Items/next-auth-poc/apps/docs/src/content/docs/decisions/admin-plugin.md`
- `/Users/alan/Projects/New Folder With Items/next-auth-poc/apps/web/src/components/user-admin/UserAdminDashboard.tsx`

We need to formalize the first hosted admin slice before implementation spreads through runtime, middleware, and page code.

## Decision

We will adopt Better Auth's admin plugin in [apps/runtime](/Users/alan/Projects/planetnik/apps/runtime) and use it to support a minimal hosted `/admin` route in [apps/app](/Users/alan/Projects/planetnik/apps/app).

### Scope of the first slice

The first hosted admin slice includes:

- Better Auth admin plugin enabled in `apps/runtime`
- auth schema fields required for role-based admin access
- session typing that includes `user.role`
- middleware protection for `/admin`
- a minimal placeholder `/admin` route for authenticated admins only

The first slice explicitly does **not** include:

- user explorer or admin dashboard components
- ban/unban UI
- impersonation UI
- password reset or set-password admin flows
- custom admin APIs beyond Better Auth's admin plugin

### Authorization model

For the first hosted slice:

- authorization is role-based
- users with `user.role === "admin"` may access `/admin`
- authenticated users without the admin role are redirected away from `/admin`
- unauthenticated users are redirected to `/sign-in`

### Auth schema policy

The Better Auth user and session schema in `apps/runtime` will be extended with the admin-plugin-compatible fields needed now:

- `user.role`
- `user.banned`
- `user.banReason`
- `user.banExpires`
- `session.impersonatedBy`

If a field already exists, we keep the existing compatible definition rather than reintroducing it differently.

### Transport and application boundaries

- [apps/runtime](/Users/alan/Projects/planetnik/apps/runtime) remains the source of truth for auth and authorization state
- [apps/app](/Users/alan/Projects/planetnik/apps/app) uses session resolution plus Astro middleware for route protection
- the hosted app does not create a separate admin authorization store
- the static site in [apps/site](/Users/alan/Projects/planetnik/apps/site) remains unaffected

### Bootstrap policy

The first admin user may be bootstrapped through a direct database update or equivalent operational step.

This ADR does **not** require a self-serve admin-promotion UI.

### TDD policy

Implementation follows [ADR-0002](/Users/alan/Projects/planetnik/docs/adr/0002-tdd-approach.md):

1. failing tests for `/admin` protection behavior
2. failing tests or contract checks for role-aware session flow
3. minimal implementation to pass
4. refactor only after behavior is green

## Why This Option

- It uses Better Auth's built-in admin model instead of inventing a parallel authorization system.
- It keeps auth ownership inside `apps/runtime`, which is already the accepted hosted boundary.
- It adds the smallest viable admin capability without prematurely porting the reference app's user-management UI.
- It keeps authorization centralized in middleware and session flow instead of scattering checks throughout pages.
- It lets Planetnik establish a stable admin route contract before building any admin UI components.

## Consequences

- The auth schema will need a migration before `/admin` can be treated as real.
- Hosted sessions now need to preserve role information, not only authentication state.
- Admin access becomes an explicit hosted concern in `apps/app`, but only behind runtime-owned auth state.
- A future admin dashboard can build on Better Auth's plugin surface instead of replacing it.
- There is now a clear distinction between authenticated users and authorized admins in the hosted shell.

## Non-goals

- no admin features in `apps/site`
- no multi-role authorization model beyond the initial `admin` gate
- no user-management dashboard in this ADR
- no custom RBAC system
- no replacement of Better Auth admin behaviors with bespoke runtime endpoints

## Related ADRs

- ADR-0001: Effect TS with Bun Runtime
- ADR-0002: Test-Driven Development Approach
- ADR-0015: Adopt Separate Static Reports and Hosted Runtime for Intelligence

## Implementation Plan

- **Affected paths**:
  - [apps/runtime/src/db/schema/auth.ts](/Users/alan/Projects/planetnik/apps/runtime/src/db/schema/auth.ts)
  - [apps/runtime/src/lib/auth.ts](/Users/alan/Projects/planetnik/apps/runtime/src/lib/auth.ts)
  - [apps/runtime/src/db/migrations](/Users/alan/Projects/planetnik/apps/runtime/src/db/migrations)
  - [apps/app/src/lib/session.ts](/Users/alan/Projects/planetnik/apps/app/src/lib/session.ts)
  - [apps/app/src/middleware.ts](/Users/alan/Projects/planetnik/apps/app/src/middleware.ts)
  - new [apps/app/src/pages/admin/index.astro](/Users/alan/Projects/planetnik/apps/app/src/pages/admin/index.astro)
  - middleware and page tests in `apps/app`

- **Patterns to follow**:
  - use Better Auth's `admin()` plugin in the runtime
  - keep authorization checks centralized in Astro middleware
  - keep the first `/admin` page intentionally minimal
  - keep Effect/Bun/Drizzle/Neon as the underlying hosted stack established by ADR-0015
  - implement under TDD as established in ADR-0002

- **Patterns to avoid**:
  - do not port the reference app's full admin dashboard yet
  - do not add custom admin-only runtime endpoints before the route gate exists
  - do not duplicate role checks in every page when middleware can own the decision
  - do not introduce a second user-role source outside Better Auth persistence

## Verification

- [ ] Better Auth admin plugin is enabled in `apps/runtime`
- [ ] auth schema includes the required role/admin-compatible fields
- [ ] hosted session typing exposes `user.role`
- [ ] `/admin` redirects unauthenticated users to `/sign-in`
- [ ] `/admin` redirects authenticated non-admin users to `/`
- [ ] `/admin` returns `200` for authenticated admins
- [ ] no user-management UI components are required for the first slice
