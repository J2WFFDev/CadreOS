# Phase 4E — Basic Authorization and Permission Matrix

## Objective

Establish an MVP-safe, server-side authorization baseline for **write actions** using:

- authenticated `UserAccount`
- linked `Person`
- `RoleAssignment`
- active `Organization`
- role scope (`ORGANIZATION`, `PROGRAM`, `TEAM`)

This phase is intentionally conservative and deny-by-default.

## What Phase 4E Implements

1. Centralized permission resolution in `lib/permissions/index.ts`.
2. Centralized mutation guard in `requirePhase1CMutationPermission(...)` now delegates to real permission checks.
3. Signed-in users without a linked `Person` are denied write actions with clear guidance to `/account/link-person`.
4. Mutation handlers surface permission errors as user-facing redirect messages instead of generic failures.
5. Scope-aware authorization for key resource-linked writes (program/team/event/note/task/season/role-assignment contexts where resolvable).

## MVP Action Allowlist

- `program.create`
- `program.update`
- `season.create`
- `season.update`
- `person.create`
- `person.update`
- `team.create`
- `rosterMembership.create`
- `roleAssignment.create`
- `roleAssignment.delete`
- `event.create`
- `event.update`
- `rsvp.upsert`
- `attendance.upsert`
- `note.create`
- `note.update`
- `task.create`
- `task.update`

Any non-allowlisted action is denied by default.

## MVP Permission Matrix (Write Actions)

| Role | Allowed in Phase 4E |
| --- | --- |
| `ORGANIZATION_ADMIN` | All allowlisted write actions in organization scope |
| `PROGRAM_DIRECTOR` | `season.*`, `team.create`, `rosterMembership.create`, `event.*`, `rsvp.upsert`, `attendance.upsert`, `note.*`, `task.*` within matching scope |
| `COACH` | `rosterMembership.create`, `event.*`, `rsvp.upsert`, `attendance.upsert`, `note.*`, `task.*` within matching scope |
| `ASSISTANT_COACH` | `attendance.upsert`, `note.*`, `task.*` within matching scope |
| `PARENT_GUARDIAN` | No staff write access in this phase |
| `ATHLETE` | No staff write access in this phase |

Notes:
- Non-admin role assignments only authorize writes when scope matches the target request scope.
- For scope-dependent actions where scope cannot be resolved safely, access is denied.

## Parent/Guardian and Relationship Scope (Deferred)

Deferred to a later phase:

- Relationship-scoped authorization using `AthleteGuardianRelationship`.
- Parent/guardian write/read flows tied to linked athlete relationships.
- Parent/guardian portal/full access experiences.

This phase does **not** grant parent/guardian staff writes.

## Notes Visibility Safeguard

This phase does not broaden note read access.

- `ObservationNote.visibility` remains `STAFF_ONLY` by default.
- Dedicated note-read visibility enforcement remains a future pass.

## Known Limitations

1. Read-page authorization is not fully enforced in Phase 4E; this pass focuses on write routes.
2. Scope inference is intentionally conservative and only applied where safe context is available.
3. Parent/guardian relationship-scoped authorization is deferred.
4. Authorization remains role-assignment driven and does not use Clerk Organizations.
