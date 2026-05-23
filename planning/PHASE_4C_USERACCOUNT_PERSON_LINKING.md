# Phase 4C: UserAccount to Person Linking

## Goal
- Bridge Clerk identity (`clerkUserId`) to CadreOS identity (`Person`) through `UserAccount`.
- Keep auth behavior conservative while making unresolved-link state explicit.
- Improve actor attribution by preferring linked `UserAccount.personId`.

## Scope Delivered
- Signed-in Clerk users now trigger `UserAccount` upsert against the active organization context.
- Added `/account` status page for identity/linking visibility.
- Added `/account/link-person` workflow to map current `UserAccount` to an existing `Person` in the active organization.
- Dashboard shell now shows a clear unresolved-link banner with a link to `/account/link-person`.
- Actor attribution helpers/routes now prefer linked `UserAccount.personId` via a shared resolver before falling back.

## Identity Transition Model
1. Clerk authenticates request and provides `userId`.
2. CadreOS resolves active organization context (explicit Clerk org when present, fallback to first organization when absent).
3. CadreOS upserts `UserAccount` using:
   - `clerkUserId = Clerk userId`
   - `organizationId = active organization`
4. User links `UserAccount.personId` from `/account/link-person`.
5. Workflow attribution resolves actor person in this order:
   - linked `UserAccount.personId`
   - first `ORGANIZATION_ADMIN` role assignment person
   - first person in organization

## Remaining Conservative Fallbacks
- Active organization still falls back to the first organization when explicit Clerk org context is unavailable.
- Actor attribution still includes admin/first-person fallbacks when `personId` is unresolved.
- Full authorization enforcement remains deferred to a later phase.

## Redirect Behavior Notes (Observed)
- Dashboard-family protected routes continue redirecting unauthenticated users to Clerk sign-in as expected.
- Post-auth redirects are still environment-driven via Clerk settings (`/dashboard` target).
- `/account` and `/account/link-person` are now included in protected route matching.
- No redirect redesign was applied in Phase 4C; any minor Clerk-hosted redirect edge behavior remains for later hardening.

## Explicit Non-Scope
- No Clerk Organizations integration.
- No full authorization policy enforcement.
- No parent/guardian access model changes.
- No FieldOps or GearOps modules.
- No Notes/Entry model refactor.
