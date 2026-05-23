# Phase 4F — Mock Auth Removal and Fallback Hardening

## Objective

Remove Phase 0 mock-auth behavior now that Clerk authentication, `UserAccount` linking, and Phase 4E write authorization are in place, while keeping local development fail-safe.

## What Phase 4F Changes

1. Removed hard-coded mock auth constants (`phase0-mock-user`, `phase0-mock-org`) from `lib/auth`.
2. Replaced non-configured-environment auth fallback with a fail-safe unauthenticated context (`clerkUserId: null`, `organizationId: null`).
3. Hardened organization resolution in `lib/organization-context.ts`:
   - Clerk-authenticated flows no longer silently fall back to the first organization when multiple organizations exist.
   - Single-organization fallback may still be used temporarily, but it now emits explicit warning metadata.
   - Local/dev mode without Clerk may still use first-organization fallback, flagged with an explicit warning.
4. Removed actor attribution fallback chain in `resolveActorPersonId`:
   - Removed fallback to first `ORGANIZATION_ADMIN`.
   - Removed fallback to first `Person`.
   - Attribution now requires linked `UserAccount.personId` (or explicit preferred linked person).
5. Updated create/attendance/note/task write routes to rely on scoped Clerk identity from `getOrganizationScope()` and fail clearly when actor attribution is unresolved.
6. Updated `/dashboard` to redirect unresolved linked accounts to `/account/link-person`.
7. Updated `/account` messaging to clearly show:
   - Clerk identity
   - `UserAccount` id
   - linked `Person`
   - active organization (name + id)
   - fallback organization warnings when active
8. Removed stale UI copy that referenced mock-auth attendance attribution fallback.

## Fallback Behavior Removed

- Static mock-auth identity and organization ids.
- Write attribution fallback to seeded/admin person records unrelated to signed-in user linkage.
- Silent first-organization fallback in Clerk-authenticated multi-organization situations.

## Remaining Temporary Fallback Behavior

1. **Single-organization fallback for Clerk-authenticated sessions without explicit Clerk org context**
   - Kept temporarily to support current MVP operation without Clerk Organizations.
   - Explicit warning is surfaced in auth scope and on `/account`.
2. **First-organization fallback in local/dev when Clerk env vars are not configured**
   - Kept for local developer ergonomics.
   - Explicit warning is surfaced in auth scope and on `/account`.
   - Writes remain fail-safe due to unauthenticated auth context and Phase 4E permission checks.

## Deferred to Future Authorization Phases

1. Full read authorization policy across dashboard views.
2. Parent/guardian relationship-scoped authorization and portal behavior.
3. Non-fallback, explicit organization-context selection flow without Clerk Organizations.
4. Expanded auth UX around organization mismatch or organization switching.

## Known Limitations

1. In multi-organization environments without explicit Clerk org context, active organization auto-resolution is intentionally blocked.
2. Single-organization fallback remains temporary until explicit organization context strategy is finalized.
3. This phase does not introduce Clerk Organizations.
