# Arc 20M — GearOps Cross-Module Integration Readiness

## Status

Implementation complete.

## Overview

Arc 20M builds GearOps cross-module integration readiness on top of the stabilized
GearOps architecture completed in Arc 20A–20L.

The primary goal is to prepare GearOps to connect cleanly with other CadreOS modules
(people, teams, athletes, guardians, events, attendance, tasks, notes, communications)
without creating tight coupling or rewriting adjacent modules.

This is an **integration-readiness arc**, not a full cross-module rebuild.

## Architecture Decisions

### Reference-First Integration Strategy

GearOps does not own or duplicate the source of truth for people, athletes, guardians,
teams, events, tasks, or notes.  Instead, GearOps reads those concepts via lightweight
typed references and resolvers that fail gracefully when adjacent module data is
unavailable.

This means:
- GearOps remains fully operational if adjacent module data is missing.
- Adjacent modules remain authoritative for their own data.
- Cross-module navigation is additive — it improves workflow without creating
  hard dependencies.

### Integration Module Structure

All integration readiness code lives in `lib/gear-ops-integration/` with a clean
public API surface (`index.ts`) and dedicated sub-modules:

| File | Responsibility |
|------|---------------|
| `types.ts` | Reference contracts, availability types, integration context shape |
| `resolver.ts` | DB-backed reference lookups, selector option queries |
| `guardian.ts` | Guardian approval boundary evaluation and display helpers |
| `context.ts` | High-level context selector that assembles integration context |
| `index.ts` | Public API surface |

### Module Availability Signals

Every `GearOpsIntegrationContext` carries a `GearOpsIntegrationAvailability` object
with a per-module status: `"available"`, `"unavailable"`, or `"deferred"`.

- **available** — The module is active and the reference resolved.
- **unavailable** — The module is active but the reference is missing (data gap).
- **deferred** — Integration is explicitly out of scope for this arc.

This lets UI code render graceful fallback messages instead of empty or broken panels.

### Graceful Fallback

`buildGearOpsStandaloneContext()` returns a fully-degraded context when adjacent module
data cannot be loaded.  GearOps continues to operate normally with this context.

`selectGearOpsIntegrationContext()` uses `Promise.allSettled()` so a single module
failure does not cascade to prevent other references from resolving.

### No Schema Changes

The Prisma schema already carries all the necessary cross-module FKs introduced in
earlier arcs:

- `GearAssignment.assignedToPersonId` → `Person`
- `GearAssignment.assignedToTeamId` → `Team`
- `GearAssignment.assignedToEventId` → `Event`
- `GearCheckout.eventId` → `Event`
- `GearCheckout.checkedOutById` / `issuedById` → `Person`
- `GearCategory.guardianApprovalRequired` → boolean flag
- `EventGearPlan.eventId` → `Event`

No schema migrations are required for Arc 20M.

## People / Athlete Integration Boundaries

### What is available now

- `resolveGearPersonReference()` — resolves any Person by ID within the org.
- `resolveGearAthleteReference()` — resolves athlete context (guardian presence)
  from `AthleteGuardianRelationship` records.
- `resolveGearPersonSelectorOptions()` — returns person selector list for assignment forms.
- `GearPersonReference` and `GearAthleteReference` typed contracts.

### Athlete Detection

An "athlete" in GearOps is any Person who has at least one `AthleteGuardianRelationship`
record in the organization.  This avoids introducing a competing athlete concept.

### Deferred

- Athlete roster role filtering (e.g., show only ATHLETE-role persons in selectors) —
  deferred to a future arc after role-scoped person queries are standardized.
- User account linking display in assignment context — deferred.

## Guardian Integration Boundaries

### What is available now

- `resolveGearGuardianReferences()` — queries all guardian relationships for an athlete.
- `evaluateGearGuardianApprovalBoundary()` — evaluates whether guardian approval is
  required for a gear assignment, using `GearCategory.guardianApprovalRequired`.
- `resolveCategoryGuardianApprovalRequired()` — single-category approval flag lookup.
- `formatGuardianApprovalBoundaryMessage()` and `formatGuardianApprovalSummary()` —
  human-readable display helpers for approval UI panels.
- `GearGuardianApprovalBoundary` and `GearGuardianApprovalReason` typed contracts.

### Guardian Approval Logic

When `GearCategory.guardianApprovalRequired = true` and the assignment recipient has
`AthleteGuardianRelationship` records, GearOps surfaces:
1. The guardian names and relationship types.
2. A confirmation message asking the operator to confirm approval before completing
   the assignment.

When no guardian is on file for a restricted-category assignment, GearOps blocks the
assignment with an explicit message directing staff to add a guardian relationship first.

### Deferred

- Guardian account-linking status checks (whether guardian has a UserAccount) —
  currently available via `guardian-operational-context.ts` but not yet wired into
  the GearOps assignment flow.
- Formal guardian approval records (audit trail of explicit approvals) — deferred;
  current approval is operator-confirmed, not cryptographically recorded.
- Guardian notification/communication handoffs — deferred to communication arc.

## Event Integration Boundaries

### What is available now

- `resolveGearEventReference()` — resolves Event metadata for gear plan context.
- `resolveGearEventSelectorOptions()` — returns event selector list for gear plan forms.
- `GearEventReference` typed contract carrying `startsAt`, `teamId`, `programId`.
- `EventGearPlan` already links directly to `Event` (established in Arc 20G).

### Deferred

- Event attendance-to-gear linkage (e.g., show gear context on attendance records) —
  deferred.
- Event readiness pre-check surfacing gear availability to event detail screens —
  partially available via event gear page; further cross-context integration deferred.

## Team / Program Integration Boundaries

### What is available now

- `resolveGearTeamReference()` — resolves Team metadata for assignment context.
- `resolveGearTeamSelectorOptions()` — returns team selector list.
- `GearTeamReference` typed contract carrying `teamId`, `teamName`, `programId`.
- `GearAssignment.assignedToTeamId` FK already in schema.
- `resolveGearOpsReadAccess()` already filters gear visibility by team/program scope.

### Deferred

- Team roster membership filtering for person selectors (e.g., "only show members of
  this team") — deferred.
- Program-scoped gear inventory views beyond what `gear-ops-access.ts` already provides —
  deferred.

## Task / Follow-Up Action Integration Boundaries

### What is available now

- `resolveGearTaskReferences()` — resolves FollowUpTasks linked to a gear item via
  `EntryObjectLink`.
- `GearTaskReference` typed contract.
- `GearCrossModuleLink` type for generic GearOps → Task navigation links.

### Creating Follow-Up Tasks from GearOps

GearOps does not yet auto-create follow-up tasks.  The integration readiness layer
establishes the reference types and lookup patterns so task creation can be wired
in from:
- Post-event recovery with `maintenanceFlag = true`.
- Maintenance log entries flagged as requiring follow-up.
- Condition-failure scans (DAMAGED / POOR) detected during inventory audit.

The existing `FollowUpTask` model and `Entry` system are the targets; no new task model
is introduced.

### Deferred

- Auto-creation of FollowUpTask from GearOps maintenance flag — deferred to a
  follow-up arc; the reference model is now in place.
- Task status display on gear item detail pages — deferred pending UI arc.

## Notes / Activity Integration Boundaries

### What is available now

- `resolveGearNoteReferences()` — resolves ObservationNotes linked to a gear item
  via `EntryObjectLink`.
- `GearNoteReference` typed contract carrying linked person, team, and event IDs.
- `GearActivityReference` typed contract for InventoryMovement cross-module navigation.

### Deferred

- Surfacing GearOps maintenance notes inside the shared activity/history feed —
  deferred pending feed integration arc.
- Bi-directional note navigation (from ObservationNote to related gear item) —
  deferred.

## Communication Integration Boundaries

### What is available now

- `communicationModule` availability is always `"deferred"` in
  `GearOpsIntegrationAvailability`.

### Deferred

Full messaging, email, SMS, or notification automation is explicitly out of scope for
Arc 20M.  The `communicationModule: "deferred"` signal is present in all integration
contexts to signal this clearly to future arcs.

## GearOpsIntegrationContext

The `GearOpsIntegrationContext` type assembles all resolved references for a gear item:

```typescript
type GearOpsIntegrationContext = {
  organizationId: string;
  gearItemId: string;
  assignedPerson: GearPersonReference | null;
  assignedTeam: GearTeamReference | null;
  assignedEvent: GearEventReference | null;
  athleteReference: GearAthleteReference | null;
  guardianApprovalRequired: boolean;
  guardianReferences: GearGuardianReference[];
  linkedTasks: GearTaskReference[];
  linkedNotes: GearNoteReference[];
  integrationAvailability: GearOpsIntegrationAvailability;
};
```

Pages call `selectGearOpsIntegrationContext()` to populate this context and then
inspect `integrationAvailability` to decide which cross-module panels to render.

## Changed Files

### Library

- `lib/gear-ops-integration/types.ts` — Reference type contracts, integration context
  shape, availability helpers, display name formatter, fallback availability builder
- `lib/gear-ops-integration/resolver.ts` — DB-backed reference lookups for person,
  athlete, guardian, team, event, task, and note; person/team/event selector queries
- `lib/gear-ops-integration/guardian.ts` — Guardian approval boundary evaluation,
  display helpers, relationship type label formatter
- `lib/gear-ops-integration/context.ts` — `selectGearOpsIntegrationContext()` high-level
  context selector; `buildGearOpsStandaloneContext()` for graceful degradation
- `lib/gear-ops-integration/index.ts` — Public API surface

### Tests

- `tests/gear-ops-integration/types.test.ts` — Reference type shape, availability
  builders, display name formatter, status message formatter
- `tests/gear-ops-integration/resolver.test.ts` — Selector option logic, note/task
  reference shape, event selector label generation
- `tests/gear-ops-integration/guardian.test.ts` — Guardian approval boundary logic,
  display formatting, fallback behavior, relationship type label conversion

### Planning

- `planning/PHASE_20M_GEAROPS_CROSS_MODULE_INTEGRATION_READINESS.md` — This document
- `planning/README.md` — Added Arc 20M entry

## Arc 20N Recommended Next Steps

1. **Wire guardian approval boundary into the gear assignment UI** — Surface the
   `GearGuardianApprovalBoundary` evaluation result in the assignment form when
   `guardianApprovalRequired = true`, blocking submission until the operator confirms.

2. **Auto-create FollowUpTask from maintenance flag** — When `EventGearAssignment.
   maintenanceFlag = true` after recovery, offer a "Create follow-up task" action
   backed by the new `GearTaskReference` patterns.

3. **Surface linked tasks and notes on gear item detail page** — Use
   `resolveGearTaskReferences()` and `resolveGearNoteReferences()` in the item detail
   page to render a cross-module activity panel.

4. **Person/athlete context on assignment confirmation** — Show athlete + guardian
   context on the assignment confirmation step when assigning to a person who has
   guardian relationships.

5. **GearOps links on person/event detail pages** — Add a "Gear" section to person
   and event detail pages (using the existing assignment/checkout FKs) so staff can
   see gear in context without navigating to GearOps first.

6. **Team-scoped person selector** — Filter person selector options to team roster
   members when a team context is already selected in the assignment form.

7. **Communication handoff stubs** — Add placeholder notification trigger points at
   assignment creation and guardian approval check points, ready for the communication
   arc.
