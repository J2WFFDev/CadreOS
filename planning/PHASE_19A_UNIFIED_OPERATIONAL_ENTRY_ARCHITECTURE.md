# Arc 19A — Unified Operational Entry Architecture

## Status

**Active** — Foundation PR. Implements schema, service layer, type definitions, and authorization alignment.

---

## Background

CadreOS is evolving from a CRUD-heavy management platform into an **operational coordination system**. PR #140 introduced a first-pass `Entry`, `EntryLink`, and `EntryActivity` model with quick-add routes and basic entry views.

Arc 19A solidifies that foundation into a canonical **Unified Operational Entry Architecture** — the shared domain model and service layer that all future entry workflows will build upon.

---

## Primary Goal

Establish the foundational architecture for a Unified Operational Entry System. This PR delivers:

- Extended domain model (enum additions, new fields, new join tables)
- Canonical service module at `lib/operational-entry/`
- Entry authorization alignment in `lib/permissions/`
- Full planning documentation

---

## What Was Built

### Schema additions (`prisma/schema.prisma` + migration `20260526004640_arc19a_operational_entry_architecture`)

#### `EntryType` enum additions
Added three new entry types to the existing enum:

| Type | Purpose |
|---|---|
| `FOLLOW_UP` | Action items derived from meetings, events, or observations (distinct from generic TASK) |
| `ACTIVITY` | Records of what happened — physical, administrative, or operational activities |
| `READINESS_ITEM` | Pre-event/pre-season readiness check items and tracking records |

Existing values (`TASK`, `NOTE`, `EVENT`, `DECISION`, `JOURNAL`, `HABIT`, `OBSERVATION`) are unchanged.

#### `Entry` field additions
| Field | Type | Purpose |
|---|---|---|
| `occurredAt` | `DateTime?` | When the entry subject actually happened (distinct from `createdAt`) |
| `updatedByPersonId` | `String?` | Which person last modified this entry (actor attribution) |

#### New enums
| Enum | Values | Purpose |
|---|---|---|
| `EntryObjectLinkTargetType` | PERSON, TEAM, PROGRAM, SEASON, EVENT, ATTENDANCE_RECORD, FACILITY, FACILITY_RESOURCE, RESOURCE_BOOKING, GEAR_ITEM, GEAR_ASSIGNMENT, GEAR_CHECKOUT, GEAR_MAINTENANCE_LOG, FOLLOW_UP_TASK, OBSERVATION_NOTE | Discriminator for polymorphic CadreOS object links |
| `EntryAssignmentRole` | OWNER, COLLABORATOR, REVIEWER | Role classification for entry assignment records |

#### New models

**`EntryObjectLink`**
Polymorphic links from an `Entry` to any CadreOS domain object. Distinct from `EntryLink` (which links Entry→Entry). Allows entries to carry operational context about the people, teams, events, facilities, and gear items they relate to.

```
EntryObjectLink
  organizationId      String
  entryId             String → Entry
  targetType          EntryObjectLinkTargetType
  targetId            String (the ID of the linked CadreOS object)
  createdByPersonId   String → Person
  createdAt           DateTime
```

**`EntryAssignment`**
Explicit assignment join table for multi-assignee support and assignment history. The existing scalar `Entry.assignedToPersonId` is preserved for backward compatibility and simple single-assignee cases.

```
EntryAssignment
  organizationId      String
  entryId             String → Entry
  personId            String → Person
  role                EntryAssignmentRole  (OWNER | COLLABORATOR | REVIEWER)
  assignedByPersonId  String?  → Person
  assignedAt          DateTime
  revokedAt           DateTime?  (soft revocation)
```

**`EntryStatusHistory`**
Immutable audit log of status transitions. Written automatically when status changes through the `changeEntryStatus` or `updateOperationalEntry` service functions.

```
EntryStatusHistory
  organizationId      String
  entryId             String → Entry
  fromStatus          EntryStatus?  (null on first status assignment)
  toStatus            EntryStatus
  changedByPersonId   String?  → Person
  note                String?  (optional context message)
  changedAt           DateTime
```

**`EntryComment`** *(deferred placeholder)*
Schema established. Routes, UI, and notification behavior deferred to a future Arc 19 sub-phase.

**`EntryReminder`** *(deferred placeholder)*
Schema established. Reminder dispatch and UI deferred to a future Arc 19 sub-phase.

---

### Service layer (`lib/operational-entry/`)

New canonical module for operational entry domain logic. Designed to be the authoritative location going forward; `lib/entries/` is preserved as-is for backward compatibility.

#### `lib/operational-entry/types.ts`
- `OPERATIONAL_ENTRY_TYPES` — canonical entry type constant array
- `CreateOperationalEntryInput`, `UpdateOperationalEntryInput`, `ChangeEntryStatusInput`
- `LinkEntryToObjectInput`, `AssignEntryInput`, `RevokeEntryAssignmentInput`
- `ENTRY_ACTIVITY_ACTIONS` — typed action string constants for `EntryActivity.action`
- `OperationalEntryRef`, `EntryObjectLinkView`, `EntryAssignmentView`, `EntryStatusHistoryView`

#### `lib/operational-entry/service.ts`
- `createOperationalEntry(input)` — creates entry + writes `entry.created` activity
- `updateOperationalEntry(input)` — updates entry fields + records status history if status changed
- `changeEntryStatus(input)` — discrete status transition + records `EntryStatusHistory` + activity
- `linkEntryToObject(input)` — idempotent EntryObjectLink creation + activity
- `unlinkEntryFromObject(input)` — removes EntryObjectLink + activity
- `assignEntry(input)` — idempotent EntryAssignment creation + activity
- `revokeEntryAssignment(input)` — soft-revokes assignment via `revokedAt` + activity
- `writeEntryActivity(input)` — shared activity write helper (re-exported for legacy use)

#### `lib/operational-entry/authorization.ts`
- `resolveEntryAccess(context)` — returns `EntryAccessLevel` (NONE | READ | WRITE | MANAGE)
- `meetsAccessLevel(actual, required)` — ordered comparison helper
- `canWriteEntries(context)` — convenience check for WRITE-level access
- `canManageEntries(context)` — convenience check for MANAGE-level access (delete/restore)

Access level mapping:
| Role | Level |
|---|---|
| ORGANIZATION_ADMIN (org-scoped) | MANAGE |
| PROGRAM_DIRECTOR (org-scoped) | MANAGE |
| COACH, ASSISTANT_COACH | WRITE |
| Authenticated, no staff role | READ |
| No actor | NONE |

---

### Authorization alignment (`lib/permissions/index.ts`)

Added three new `SupportedAction` values:

| Action | Roles with access |
|---|---|
| `entry.create` | ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH, ASSISTANT_COACH |
| `entry.update` | ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH, ASSISTANT_COACH |
| `entry.delete` | ORGANIZATION_ADMIN, PROGRAM_DIRECTOR |

`entry.create` and `entry.update` are added to `SCOPED_ACTIONS` so program/team scope is honored when present.

---

## What Was Intentionally Deferred

The following capabilities are explicitly out of scope for Arc 19A:

- **Full feed / Today view redesign** — existing Today/Upcoming views from PR #140 are preserved unchanged
- **Quick-capture UI redesign** — existing quick-add routes are preserved unchanged
- **Comment and reminder routes/UI** — models are present in schema; API and UI deferred
- **Entry notifications / alerts** — no notification dispatch wired yet
- **AI-assisted capture or tagging** — no inference or enrichment features
- **Workflow automation / BPMN-style orchestration** — not applicable to Arc 19A
- **EntryObjectLink resolution UI** — the model exists; a human-readable linked-object panel is deferred
- **EntryAssignment multi-assignee UI** — the model exists; UI surface deferred to Arc 19B+

---

## Preserved Behavior

All existing behavior is preserved:

- `lib/entries/service.ts` — unchanged, still used by existing task/note compatibility routes
- `app/(dashboard)/entries/` — all routes unchanged
- `app/(dashboard)/today/`, `app/(dashboard)/upcoming/`, `app/(dashboard)/decisions/` — unchanged
- FieldOps, GearOps, Roster Lifecycle, Reporting — all unchanged
- Existing tests — all pass

---

## Architecture Decision Notes

### Why `EntryObjectLink` instead of extending `EntryLink`
`EntryLink` (from PR #140) represents Entry→Entry relationships. `EntryObjectLink` represents Entry→CadreOS domain object relationships. These are semantically different: one is a graph edge between entries, the other is a contextual reference to an operational record. Keeping them separate avoids polymorphic query ambiguity and maintains schema clarity.

### Why keep `Entry.assignedToPersonId` alongside `EntryAssignment`
The scalar `assignedToPersonId` enables simple single-assignee queries without joining the assignment table. `EntryAssignment` enables multi-assignee, role-classified, and historically-tracked assignment. Both serve different query patterns. The scalar is kept as a display/index convenience; authoritative assignment data lives in `EntryAssignment`.

### Why `EntryStatusHistory` as a separate table instead of inferring from `EntryActivity`
`EntryActivity.action` is a free-form string. `EntryStatusHistory` provides typed `fromStatus`/`toStatus` fields that enable efficient lifecycle queries without parsing activity log JSON. This is the correct design for a system that may need to query "all entries that transitioned from IN_PROGRESS to BLOCKED this week."

---

## Next Steps (Arc 19B+)

1. **Arc 19B** — Entry create form using `lib/operational-entry/service.ts` `createOperationalEntry`
2. **Arc 19C** — EntryObjectLink UI: link panel on entry detail showing resolved CadreOS object display names
3. **Arc 19D** — EntryAssignment multi-assignee UI and assignment panel
4. **Arc 19E** — EntryStatusHistory visualization on entry detail page
5. **Arc 19F** — EntryComment activation (routes + UI, no notifications yet)
6. **Arc 19G** — EntryReminder activation (schedule + basic UI)
