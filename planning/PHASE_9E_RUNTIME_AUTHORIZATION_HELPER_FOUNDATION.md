# Phase 9E — Runtime Authorization Helper Foundation

## Purpose

Phase 9E implements a small, reusable runtime authorization helper foundation for current operational models — specifically `ObservationNote` and `FollowUpTask` — before any unified `Entry` model is introduced.

This phase translates the access-policy architecture defined in Phase 9D into working, testable code while keeping scope strictly limited to current models and current data.

---

## Constraints (unchanged from Phase 9D)

- No `Entry` model implemented.
- No `ObservationNote` or `FollowUpTask` migration performed.
- No Feed, Inbox, Journal, messaging, notifications, or workflow automation added.
- No guardian-facing read paths added.
- No schema redesign.
- No new major dependencies.
- Existing organization scoping preserved.

---

## What Was Built

### 1. `lib/authorization/index.ts` — Authorization helper module

**Types:**

| Type | Purpose |
|---|---|
| `StaffRoleAssignment` | A single resolved role assignment (roleType, scopeType, programId, teamId) |
| `ActorRoleContext` | The resolved role context for an actor: personId, staffRoleAssignments, isOrganizationAdmin, isStaffMember |

**Core resolver:**

| Function | Signature | Purpose |
|---|---|---|
| `resolveActorRoleContext` | `(organizationId, actorPersonId) → Promise<ActorRoleContext>` | Single DB call; loads all staff role assignments for the actor. Returns zero-access context for unlinked accounts. |

**Read access helpers (synchronous, pure):**

| Function | Signature | Purpose |
|---|---|---|
| `canReadStaffOnlyContent` | `(context) → boolean` | True if actor holds any staff role. Guards STAFF_ONLY content (all current ObservationNotes). |
| `canReadTeamScopedContent` | `(context, teamId) → boolean` | True if actor's role assignment covers the given team. Org admins pass unconditionally. Records with no teamId pass for all staff. |
| `canAccessFollowUpTask` | `(context, task) → boolean` | True if actor is staff, or if actor is the task assignee/creator (non-staff assignee pattern, for future extensibility). |

**Assertion helpers (throw on denial):**

| Function | Signature | Purpose |
|---|---|---|
| `assertStaffAccess` | `(context) → void` | Throws `AuthorizationDeniedError` if actor is not staff. |
| `assertOrganizationAdminAccess` | `(context) → void` | Throws `AuthorizationDeniedError` if actor is not org admin at org scope. |

**Error class:**

- `AuthorizationDeniedError` — named error for authorization failures, distinct from Prisma/Next.js errors.

### 2. Staff-access gate on `ObservationNote` read path

**File:** `app/(dashboard)/notes/page.tsx`

- Added `resolveActorRoleContext` + `canReadStaffOnlyContent` check immediately after `scope.organizationId` is resolved.
- If the actor is not staff, the page returns an "access denied" message instead of querying notes.
- **Behavioral impact on legitimate staff users: none.** All current users with linked person accounts hold staff role assignments.
- **Behavioral impact on non-staff or unlinked accounts: will now see a clear access-denied message** instead of potentially seeing all organization notes.

This is the integration described in Phase 9D §10.1 ("Apply visibility filtering to the existing `ObservationNote` queries as a dry run").

### 3. Staff-access gate on `FollowUpTask` read path

**File:** `app/(dashboard)/tasks/page.tsx`

- Same pattern as notes: `resolveActorRoleContext` + `canReadStaffOnlyContent` check before the main task query.
- Non-staff actors see an access-denied message instead of all organization tasks.

---

## Design Decisions

### Why a separate `lib/authorization/index.ts` instead of extending `lib/permissions/index.ts`?

`lib/permissions/index.ts` is a write-permission system. It evaluates whether a Clerk user may perform a specific write action. It works with Clerk user IDs, not resolved `personId` values, and does not return a reusable actor context.

`lib/authorization/index.ts` is a read-access system. It resolves actor context (personId → role assignments) and provides composable, synchronous helpers for read-path decisions. The separation keeps write-permission logic and read-access logic distinct and independently testable.

### Why call `resolveActorRoleContext` alongside the existing `resolveGuardianRelationshipAccess`?

`resolveGuardianRelationshipAccess` is kept as-is because it provides guardian-diagnostic-specific capabilities (`canViewGuardianRelationshipDetails`, `canEditGuardianLinkageWhereSupported`) that the new helper does not expose. Removing the existing call would change the guardian diagnostic panel behavior, which is outside Phase 9E scope.

The extra DB query is a minor cost. A future optimization could merge both into a single call — deferred.

### Why does `canReadTeamScopedContent` conservatively allow program-scoped assignments?

Verifying that a team belongs to a given program requires a DB lookup (`team.programId === assignment.programId`). This would make `canReadTeamScopedContent` async and force callers to await it on every record in a list. The conservative approach (allow program-scoped staff to read team-scoped records) matches existing behavior and is documented clearly. Strict program-to-team verification can be added as an async helper in a future phase when needed.

### Why not add the `EntryVisibility` enum to the schema in this phase?

Phase 9D §10.1 suggests adding the enum as a zero-risk schema change. However, Phase 9E's goal is the authorization helper foundation, and the enum is only needed once the Entry migration begins. Adding it now would create schema divergence with no runtime usage, and it would require a `prisma migrate dev` that cannot be validated without a live DB. The enum is deferred to the Entry schema phase (Entry Track E1).

---

## What Was NOT Done (as required)

- No Entry model, schema, or routes.
- No ObservationNote or FollowUpTask migration.
- No Feed, Inbox, Journal runtime behavior.
- No guardian-facing read path.
- No guardian-linked visibility runtime logic.
- No messaging, notification, or automation behavior.
- No new test framework introduced (see validation checklist instead).

---

## Integration Points for Future Phases

The `lib/authorization/index.ts` module is the foundation for:

1. **Entry visibility enforcement (Phase E1+):** The `resolveActorRoleContext` + visibility-category helpers pattern extends naturally to `Entry` records with `PRIVATE`, `STAFF_ONLY`, `TEAM_STAFF`, `SHARED`, and `GUARDIAN_LINKED` categories.

2. **Per-record `TEAM_STAFF` enforcement:** Once notes and tasks gain `teamId`-aware filtering, `canReadTeamScopedContent` provides the synchronous gate. Strict program-to-team verification can be added as an async variant.

3. **Assignee access on tasks:** `canAccessFollowUpTask` already handles the non-staff-assignee pattern. If tasks are ever assigned to athletes or guardians, the helper is ready without code changes.

4. **Admin-only management surfaces:** `assertOrganizationAdminAccess` can be applied to any future admin-gated page (role management, org settings, etc.).

---

## Files Changed

| File | Change |
|---|---|
| `lib/authorization/index.ts` | **New** — authorization helper foundation |
| `app/(dashboard)/notes/page.tsx` | Added staff-access gate using the new helper |
| `app/(dashboard)/tasks/page.tsx` | Added staff-access gate using the new helper |
| `planning/PHASE_9E_RUNTIME_AUTHORIZATION_HELPER_FOUNDATION.md` | **New** — this document |
| `planning/PHASE_9E_VALIDATION_CHECKLIST.md` | **New** — manual validation checklist |
| `planning/README.md` | Added Phase 9E entry to planning index |

---

## Validation

See `planning/PHASE_9E_VALIDATION_CHECKLIST.md` for the manual validation checklist.

Build validation:
- `npm run typecheck` — passes (zero errors)
- `npm run lint` — passes (zero warnings)

---

## What Remains Before Entry Runtime

Per Phase 9D §9 (Required Before Entry Runtime):

### Authorization prerequisites
- [x] **Reusable per-record read-access helpers** — `lib/authorization/index.ts` (this phase)
- [ ] **Visibility-aware Prisma `where` clause builders** — needed once Entry is added
- [ ] **`PRIVATE` record exclusion in shared surfaces** — needed once Entry `PRIVATE` category is live
- [ ] **Guardian boundary enforcement function** — needed before guardian-facing read paths
- [ ] **Visibility enforcement on note create/edit routes** — needed once NoteVisibility is runtime-evaluated

### Schema prerequisites
- [ ] `EntryVisibility` enum in schema
- [ ] Entry schema shape finalized
- [ ] Entry status model decided
- [ ] EntryLink schema defined

### Migration prerequisites
- [x] FK dependency map complete (Phase 9C ✅)
- [ ] Backfill semantics resolved
- [ ] Staging migration dry-run passing
- [ ] Operational history compatibility strategy defined

### Validation prerequisites
- [ ] Note/task fixture coverage for migration
- [ ] Visibility enforcement unit tests (with test framework)

### Guardian-facing prerequisites (before GUARDIAN_LINKED visibility at runtime)
- [ ] Guardian read path designed and implemented
- [ ] Consent/disclosure framework defined
- [ ] Pilot validation complete
