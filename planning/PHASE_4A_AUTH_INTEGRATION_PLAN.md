# Phase 4A: Authentication and Authorization Integration Plan

## Goal
- Define the minimum viable path to replace mock auth with real authentication and foundational authorization checks.
- Keep current product workflows stable.
- Avoid overbuilding before MVP adoption signals.

## Explicit Non-Scope (Phase 4A)
- No Clerk/Auth.js implementation code in this phase.
- No Prisma schema edits in this phase.
- No new product workflows or feature expansion.

## Current State Findings

### Auth placeholder (`lib/auth`)
- `requireAuthContext()` returns a static Phase 0 stub:
  - `userId: "phase0-mock-user"`
  - `organizationId: "phase0-mock-org"`
- `requireOrganizationContext()` returns the same static stub.
- There is no real session lookup, no user identity verification, and no organization membership resolution.

### Organization context resolution (`lib/organization-context.ts`)
- `getOrganizationScope()` calls `requireOrganizationContext()`.
- If the auth-provided `organizationId` does not resolve, it falls back to the first organization in the database.
- In practice today, mock `organizationId` does not exist in seed data, so first-organization fallback is commonly used.

### Mutation permission placeholder
- `requirePhase1CMutationPermission()` in `lib/workflows/index.ts` calls `requireAuthContext()` but performs no policy check and never throws.
- All current write routes using this helper are effectively permission-open once organization scope resolves.

### Current author/actor attribution behavior
- Several routes resolve actor person via `UserAccount.clerkUserId -> personId`.
- If no linked `UserAccount.personId` exists, fallback is:
  1. first `ORGANIZATION_ADMIN` role assignment
  2. first person in organization
- This fallback exists in:
  - `app/(dashboard)/events/create/route.ts`
  - `app/(dashboard)/events/[eventId]/attendance/route.ts`
  - `app/(dashboard)/notes/create/route.ts`
  - `lib/follow-up-tasks.ts` (task creator)

## User / Person / Organization Assumptions Review

### How mock auth resolves organization today
- Mock auth returns a fixed non-seeded org id (`phase0-mock-org`).
- Organization scope helper then falls back to first org record.
- Result: organization selection is implicit and not identity-bound.

### Seeded users/people vs future authenticated users
- Seed script creates Organization, Program, Season, Team, People, Roles, and relationships.
- Seed script does **not** create `UserAccount` rows.
- Future real sign-ins will initially authenticate users with no person link unless linking flow is added.

### How `UserAccount` should connect to `Person`
- MVP path: keep `UserAccount` as auth identity record per active organization and link optional `personId`.
- Linking should happen once (or be repairable by admin) using trusted identifiers (email-first with explicit confirmation fallback).
- Route-level actor identity should prefer linked `personId`; remove broad fallback once linking is in place.

### Gaps before real auth
- No sign-in/out flow.
- No protected routes/layout enforcement.
- No user-to-person linking flow.
- No explicit active organization resolver from authenticated context.
- No scoped role resolution attached to auth context.
- No real server-side authorization enforcement in permission helper.

## Provider Path: Clerk vs Auth.js

## Comparison Summary
- **Clerk**
  - Pros:
    - Fastest setup for Next.js + Vercel.
    - Managed auth UX, session handling, and org primitives.
    - Lower solo-builder operational burden for MVP.
    - Good fit with existing `UserAccount.clerkUserId`.
  - Tradeoffs:
    - Vendor coupling unless auth identity fields are abstracted later.
    - Organization model decisions must be mapped cleanly to CadreOS org scoping.

- **Auth.js**
  - Pros:
    - Greater portability/control of auth stack.
    - Flexible provider composition and session strategy.
  - Tradeoffs:
    - More implementation decisions and maintenance overhead.
    - Slower path for solo-builder MVP in this codebase stage.
    - More custom work to reach equivalent org/session ergonomics.

## Recommended MVP Provider
- **Primary path: Clerk** for Phase 4B–4F MVP execution speed and lower auth operations complexity.
- Reassess Auth.js only after stable MVP auth/authorization baseline and clearer portability requirements.

## Minimum Viable Auth Model (Target)

### 1) Sign in/out
- Provider-managed sign-in and sign-out for dashboard routes.
- Unauthenticated access redirected to sign-in.

### 2) Authenticated user account
- On first authenticated request, upsert `UserAccount` for active org + provider user id.
- Keep user identity fields minimal in app DB; source of truth for credentials remains provider.

### 3) Link authenticated user to `Person`
- Add explicit linking step for accounts without `personId`.
- Block staff-write actions until link is resolved.
- Record link in audit events.

### 4) Resolve active `Organization`
- For MVP pilot, resolve one active org deterministically.
- Avoid first-org fallback once real auth is active; fail closed when org context cannot be verified.

### 5) Resolve `RoleAssignment`s
- Hydrate role assignments for linked person in active org.
- Attach resolved role/scope context to permission checks.

### 6) Enforce server-side scope checks (next phase wiring)
- Route handlers keep organization filters.
- Permission helper transitions from placeholder to deny-by-default policy checks.

## Phase 4 Implementation Sequence

### Phase 4B: Provider Setup
- Integrate Clerk SDK and middleware/proxy gating for dashboard routes.
- Implement auth-aware `requireAuthContext()` and `requireOrganizationContext()`.
- Preserve existing app behavior for authenticated staff users only.

### Phase 4C: UserAccount Linking
- Implement first-login upsert for `UserAccount`.
- Add unresolved-link handling path (prompt/admin-assisted matching).
- Add auditable user-to-person linking action.

### Phase 4D: Route Protection
- Protect dashboard shell and mutation routes.
- Add unauthorized/forbidden response patterns for server handlers.
- Remove Phase 0 header messaging in dashboard layout.

### Phase 4E: Basic Authorization Checks
- Implement minimal action checks in `lib/permissions` + `requirePhase1CMutationPermission`.
- Enforce org boundary and role-based allow list for write actions.
- Keep checks intentionally narrow (MVP-safe, no over-modeling).

### Phase 4F: Replace Mock Auth
- Remove all mock auth constants and first-org fallback dependencies.
- Normalize actor attribution to linked user/person identity.
- Validate end-to-end workflows under real authenticated sessions.

## Code Areas Expected to Change
- `lib/auth` (provider session integration and auth context shape)
- `lib/permissions` (actual policy evaluation)
- `lib/workflows` (`requirePhase1CMutationPermission` enforcement)
- route handlers under `app/(dashboard)/**/route.ts` (auth/forbidden handling)
- `app/(dashboard)/layout.tsx` (auth-aware shell/header state)
- `middleware.ts` (or Next.js proxy equivalent) for route protection
- `.env.example` and deployment env configuration docs
- planning docs:
  - `planning/README.md`
  - follow-on phase docs for 4B–4F execution details

## Required Environment Variables (MVP with Clerk)
- Existing:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_APP_URL`
- Add for Clerk:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (or route equivalent)
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (if self-serve signup is enabled)
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
- Potential later:
  - `CLERK_WEBHOOK_SECRET` (if webhook-based sync is introduced)

## Required Future Schema Changes (Documented, Not Applied in 4A)
- **No required schema change to start Phase 4B MVP** because `UserAccount` already exists and can be used.
- Recommended future hardening changes (post-MVP or before multi-org expansion):
  - Generalize `UserAccount.clerkUserId` to provider-neutral fields (`authProvider`, `providerUserId`) for portability.
  - Revisit uniqueness model for multi-organization memberships (current global unique `clerkUserId` limits multi-org account strategies).

## Risks and Mitigations

### Risk: Breaking existing workflows
- Mitigation: phase rollout with minimal auth surface first (4B), then incremental enforcement (4D/4E), with route-level validation retained.

### Risk: Incorrect organization resolution
- Mitigation: remove implicit first-org fallback for authenticated paths; fail closed when org cannot be proven.

### Risk: Local/dev vs Vercel misconfiguration
- Mitigation: document exact env requirements in `.env.example` and deployment notes before enabling protected routes.

### Risk: Parent/guardian access complexity
- Mitigation: keep parent/guardian authorization narrow in MVP; do not open staff-only notes by default.

### Risk: Staff-only notes exposure
- Mitigation: deny-by-default permission checks for note reads/writes until relationship-aware rules are explicit.

### Risk: Overbuilding auth too early
- Mitigation: keep Phase 4 to auth baseline + minimal policy enforcement; defer advanced membership and sharing models.

## Open Decisions
- Single-org MVP behavior:
  - lock all users to one org, or support explicit org switch now?
- User-to-person linking UX:
  - automatic email match vs explicit admin approval first?
- Signup policy:
  - invite-only staff onboarding vs open signup with restricted access?
- Parent/guardian login timing:
  - include in MVP auth baseline or defer to controlled-access phase?
- Middleware migration:
  - keep `middleware.ts` short term or move to `proxy.ts` immediately per Next.js guidance?

## Phase 4B Readiness
- **Ready to begin with Clerk as primary provider path**, provided:
  - env variables are prepared in local + Vercel,
  - first-login `UserAccount` upsert + unresolved person-link flow are included in 4C scope,
  - first-org fallback is disabled for authenticated paths by 4D/4F completion.
