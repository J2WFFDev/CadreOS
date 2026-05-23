# Phase 6J — FieldOps MVP Hardening

## Goal

Harden the FieldOps MVP by documenting actual behavior, improving developer
and operator confidence, and confirming that the core workflow is complete and
well-understood. No new product features are introduced.

---

## What is complete (as of Phase 6I)

### Facilities

- Facility list at `/field-ops/facilities` — scoped to current organization,
  shows status (ACTIVE / INACTIVE) and address.
- Facility detail at `/field-ops/facilities/[id]` — shows description,
  address, status, and the resource list for that facility.
- Inactive facilities are visually distinguished.
- Create/edit UI is not included in MVP; facilities are managed via seed or
  direct database operations.

### Resources

- Resource list at `/field-ops/resources` — scoped to current organization,
  shows type, capacity, status, and parent facility.
- Resource detail at `/field-ops/resources/[id]` — shows full resource
  metadata and facility link.
- Inactive resources are visually distinguished.
- Create/edit UI is not included in MVP.

### Booking requests

- Booking list at `/field-ops/bookings` with filters for:
  - `status`, `approvalStatus`, `precheckStatus`
  - facility, resource
  - timeframe (`upcoming`, `past`, `all`)
  - conflict presence (`with`, `without`)
- Booking detail at `/field-ops/bookings/[id]` — shows all booking fields,
  conflict list, and approval action buttons when eligible.
- New booking form at `/field-ops/bookings/new` — only offers ACTIVE
  facilities and resources.
- Create route at `POST /field-ops/bookings/create` — validates fields, runs
  precheck, persists booking and conflict rows atomically.
- Required fields: `resourceId`, `title`, `startsAt`, `endsAt`.
- Optional fields: `facilityId`, `description`, `programId`, `teamId`,
  `eventId`.

### Conflict / precheck behavior

- Precheck runs synchronously during booking creation (not deferred).
- Checks:
  1. Facility status — BLOCKING if not ACTIVE.
  2. Resource status — BLOCKING if not ACTIVE.
  3. Overlapping bookings on the same resource — BLOCKING if overlap with an
     approved booking; WARNING if overlap with a pending/requested booking.
- Results:
  - All clear → `status = PRECHECK_PASSED`, `precheckStatus = PASSED`.
  - Warning only → `status = REQUESTED`, `precheckStatus = WARNING`.
  - Any blocking → `status = CONFLICT_FOUND`, `precheckStatus = FAILED`.
- Conflict rows are persisted in `BookingConflict` in the same transaction as
  the booking.

### Approval / denial behavior

- Route: `POST /field-ops/bookings/[bookingId]/decision`
- Actions: `approve` or `deny` via form field `decision`.
- Permission required: `booking.approve` or `booking.deny` —
  `ORGANIZATION_ADMIN` or `PROGRAM_DIRECTOR` only.
- Guards:
  - `approvalStatus` must be `PENDING`.
  - `status` must not be `COMPLETED`, `CANCELED`, or `DENIED`.
  - Approval is blocked when unresolved `BLOCKING` conflicts exist.
- On approval: `status → APPROVED`, `approvalStatus → APPROVED`,
  `approvedByPersonId` is set.
- On denial: `status → DENIED`, `approvalStatus → DENIED`.

### Dashboard / summary behavior

- Dashboard at `/field-ops` shows six summary cards:
  1. Total booking requests
  2. Pending approvals
  3. Approved bookings
  4. Denied or canceled
  5. Bookings with conflicts
  6. Upcoming approved (starts ≥ now)
- Summary cards link to filtered booking list views.
- Alert banners for pending approvals and active conflict counts.
- Empty state shown when no active resources exist (new booking button hidden).

---

## What is intentionally deferred

The following features are **not** part of the FieldOps MVP and are out of
scope for Phase 6J:

| Feature | Notes |
|---|---|
| Recurring bookings | Not modeled; no recurrence fields in schema |
| Notifications | No notification system in CadreOS MVP |
| External calendar sync | No external integrations in scope |
| GearOps / equipment dependency checks | GearOps is a separate future module |
| Advanced recommendation logic | No optimization engine; precheck only |
| Staff / role requirements per resource | No staffing rules in schema |
| Blackout windows | No blackout date model in schema |
| Capacity rules enforcement | `capacity` field exists but is not enforced at booking time |
| Facility / resource create/edit UI | Admin creates facilities via seed or direct DB in MVP |
| Multi-step or delegated approvals | Single-step approval only |
| Booking revision history | No audit trail for booking changes |
| Attendance linkage from bookings | Not implemented |
| Weather / status notes | Not in scope |

---

## Known limitations

1. **No facility/resource management UI.** Operators must seed or directly
   manage facilities and resources in the database. This is acceptable for MVP
   pilot use but will need a UI for general use.

2. **Capacity is recorded but not enforced.** The `capacity` field on
   `FacilityResource` is stored and displayed but does not block bookings when
   capacity would be exceeded.

3. **Precheck is point-in-time.** The precheck runs at submission. If a
   conflicting booking is approved after a warning-level booking was created,
   the earlier booking's precheck result does not automatically update.

4. **Single-step, two-role approval.** Only `ORGANIZATION_ADMIN` and
   `PROGRAM_DIRECTOR` can approve or deny. There is no escalation, delegation,
   or multi-step flow.

5. **COACH cannot approve.** Coaches can create booking requests but cannot
   approve or deny them, even for their own team's requests.

6. **No booking edit.** Submitted bookings cannot be edited. A new request
   must be submitted and the old one denied/canceled.

7. **`DRAFT` and `RECOMMENDED` statuses exist in the schema but are not
   produced by the current workflow.** `DRAFT` may be used in a future create
   flow; `RECOMMENDED` is reserved for a future recommendation engine.

8. **Pre-existing typecheck errors in `lib/workflows/index.ts`.** Implicit
   `any` types from Zod v4 transform callbacks cause TypeScript errors. These
   are pre-existing and not introduced by FieldOps.

---

## Validation performed (Phase 6J)

- Reviewed all FieldOps source files: routes, precheck lib, workflows schema,
  permissions, seed, and Prisma schema.
- Confirmed documentation matches actual implemented behavior.
- Confirmed seed script is idempotent and instructions are reproducible.
- Confirmed manual test checklist is executable by a developer with seeded
  data.
- Confirmed no new product features were added.
- Confirmed organization scoping is intact across all FieldOps routes.
- Confirmed no recurrence, notifications, external calendar sync, GearOps, or
  recommendation logic is present.

---

## Files added in Phase 6J

| File | Purpose |
|---|---|
| `planning/FIELDOPS_DEVELOPER_SETUP.md` | Developer setup: Prisma generate, DB push, seed, UI verification, key source files |
| `planning/FIELDOPS_VALIDATION_REFERENCE.md` | Validation rules: required fields, date/time, active checks, conflict detection, approval authorization |
| `planning/FIELDOPS_MANUAL_TEST_CHECKLIST.md` | Manual test checklist: 12 scenarios covering the full booking workflow |
| `planning/PHASE_6J_FIELDOPS_MVP_HARDENING.md` | This file — MVP completion summary, deferred scope, known limitations |

---

## Recommended next phase options

The following are the most impactful options for a Phase 7 FieldOps iteration,
in rough priority order:

1. **Facility and resource management UI** — create/edit/deactivate facilities
   and resources without direct database access. Likely the highest operational
   priority.

2. **Booking edit / revision** — allow requester or admin to update a pending
   booking request before it is approved.

3. **Capacity enforcement** — enforce the `capacity` field during precheck and
   show remaining capacity on the booking form.

4. **Blackout window support** — add a `FacilityBlackout` model and check it
   during precheck.

5. **Notification hooks** — notify the requester when their booking is approved
   or denied; notify approvers when a new request is pending.

6. **Recurring bookings** — allow a booking request to repeat on a schedule
   (weekly practice blocks, etc.).

7. **GearOps integration** — check equipment availability when a booking
   requests specific gear.

8. **Coach-level approval for team-scoped bookings** — expand the approval
   permission model to allow coaches to approve bookings within their own
   team/program scope.
