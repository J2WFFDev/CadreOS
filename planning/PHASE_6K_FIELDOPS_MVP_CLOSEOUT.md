# Phase 6K — FieldOps MVP Closeout and Phase 7 Decision Plan

## Goal

Close out the FieldOps MVP with a single, decision-ready reference that separates:

- completed MVP behavior
- deferred future scope
- open product decisions for the next phase

No runtime product features are added in this phase.

---

## 1) Implemented MVP capabilities (current state)

FieldOps MVP currently includes:

- Organization-scoped facilities and resources data model
- Read views for facilities, resources, and bookings
- Booking request creation workflow
- Synchronous precheck/conflict evaluation on request create
- Conflict persistence (`BookingConflict`) and conflict visibility in list/detail UI
- Approval/denial workflow for pending bookings with role/scoping checks
- FieldOps dashboard summary with workflow-focused counts and quick filters
- Idempotent demo seed data for facility/resource/event/booking scenarios

---

## 2) Current data model (implemented)

Implemented Prisma models:

- `Facility`
- `FacilityResource`
- `ResourceBooking`
- `BookingConflict`

Implemented enums:

- `FacilityStatus`, `ResourceStatus`, `ResourceType`
- `BookingStatus`, `PrecheckStatus`, `ApprovalStatus`
- `ConflictType`, `ConflictSeverity`

Current model notes:

- `ResourceBooking` supports optional `programId`, `teamId`, and `eventId` linkage.
- `capacity` exists on `FacilityResource` as stored/displayed metadata.
- `BookingApprovalHistory` is not implemented in current schema.

---

## 3) Current UI and views (implemented)

Current FieldOps routes:

- `/field-ops` (summary dashboard)
- `/field-ops/facilities`
- `/field-ops/facilities/[facilityId]`
- `/field-ops/resources`
- `/field-ops/resources/[resourceId]`
- `/field-ops/bookings`
- `/field-ops/bookings/new`
- `/field-ops/bookings/[bookingId]`

Current view behavior:

- Facilities/resources are read-only in MVP (no create/edit UI).
- Booking list supports filter combinations for status, approval, precheck, facility/resource, timeframe, and conflict presence.
- Booking detail shows lifecycle status, attribution, linked context, conflict details, and approval actions when eligible.
- New request form only offers ACTIVE facilities/resources.

---

## 4) Current booking lifecycle (implemented behavior)

Request create defaults to pending approval and runs precheck immediately:

- base create intent: `REQUESTED + NOT_RUN + PENDING`
- post-precheck mapping:
  - no conflicts → `PRECHECK_PASSED + PASSED + PENDING`
  - warning-only conflicts → `REQUESTED + WARNING + PENDING`
  - any blocking conflict → `CONFLICT_FOUND + FAILED + PENDING`

Decision outcomes:

- approve → `APPROVED + APPROVED`
- deny → `DENIED + DENIED`

Notes:

- `DRAFT` and `RECOMMENDED` exist in enum values but are not produced by the current MVP flow.

---

## 5) Current conflict/precheck rules (implemented)

Precheck currently evaluates:

- facility ACTIVE status
- resource ACTIVE status
- overlapping bookings on the same `organizationId + resourceId` where times overlap:
  - overlap against approved booking → `BLOCKING`
  - overlap against pending/requested-style booking → `WARNING`

Conflict handling:

- conflict rows are written to `BookingConflict` in the same transaction as booking create.
- no asynchronous recheck/reconciliation job exists after create.

---

## 6) Current approval/denial rules (implemented)

Decision route:

- `POST /field-ops/bookings/[bookingId]/decision`

Guards:

- booking must exist in active organization scope
- `approvalStatus` must be `PENDING`
- booking `status` cannot be `COMPLETED`, `CANCELED`, or `DENIED`
- approval is blocked if unresolved `BLOCKING` conflicts exist

Decision writes:

- approve sets `approvalStatus=APPROVED`, `status=APPROVED`, `approvedByPersonId`
- deny sets `approvalStatus=DENIED`, `status=DENIED`

---

## 7) Current role/authorization assumptions (implemented)

Write authorization uses the existing scoped permission system:

- `booking.create`: `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, `COACH`
- `booking.approve` / `booking.deny`: `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`
- `COACH`, `ASSISTANT_COACH`, `PARENT_GUARDIAN`, and `ATHLETE` cannot approve/deny in MVP

Scope model remains program/team/event-resolved under organization context.

---

## 8) Current seed/demo data behavior (implemented)

Seed behavior is manual/idempotent and includes:

- facility: `cadreos-demo-facility` ("Demo Range Complex")
- resources: Bay A and Bay B (ACTIVE)
- one published demo event
- one approved booking linked to event/program/team
- one pending booking without event linkage

Seed records are deterministic (`upsert` + fixed IDs) for reproducible local/manual validation.

---

## 9) Current manual validation checklist

Manual test scenarios are documented in:

- [FieldOps Manual Test Checklist](./FIELDOPS_MANUAL_TEST_CHECKLIST.md)

Checklist coverage includes:

- valid/invalid request creation
- overlap warnings and blocking conflicts
- approve/deny behavior and permission checks
- dashboard count sanity checks
- inactive resource guard behavior
- organization scoping behavior

---

## 10) Known limitations (current MVP)

- No recurring bookings
- No notifications/reminders
- No external calendar sync
- No advanced recommendations/optimization logic
- No GearOps/equipment dependency checks
- No staff/role requirement enforcement per resource
- No blackout window rules
- Capacity is stored but not enforced at booking time
- Concurrency handling for near-simultaneous booking requests is limited to application-level checks (no DB-level overlap exclusion/locking policy)
- No facility/resource management UI (managed through seed/direct DB operations)
- No booking edit/revision workflow

---

## 11) Recommended Next Phase Options (decision-ready)

### Option A — FieldOps 7A: Recurring bookings

- **Purpose:** Support repeated practice/operations schedules without manual re-entry.
- **User value:** Large reduction in repetitive data entry for recurring blocks.
- **Implementation complexity:** High.
- **Risk:** High (series exceptions, conflict fan-out, lifecycle drift).
- **Suggested first PR scope:** Add recurrence series metadata model + read-only expansion preview + series-level validation rules (no full edit engine yet).

### Option B — FieldOps 7A: Notifications/reminders

- **Purpose:** Notify requesters/approvers of pending and decided bookings.
- **User value:** Faster turnaround and fewer missed approvals/decisions.
- **Implementation complexity:** Medium.
- **Risk:** Medium (delivery reliability, noise tuning, user preference requirements).
- **Suggested first PR scope:** In-app notification event model + booking decision event writes + pending-approval digest surface (without external channels first).

### Option C — FieldOps 7A: Calendar sync

- **Purpose:** Mirror approved bookings to external calendar systems.
- **User value:** Better visibility in existing team calendars.
- **Implementation complexity:** High.
- **Risk:** High (auth token lifecycle, sync failures, reconciliation complexity).
- **Suggested first PR scope:** Outbound read-only calendar feed for approved bookings + explicit sync boundary rules before provider-specific write-back.

### Option D — FieldOps 7A: Staff/role requirements

- **Purpose:** Enforce required roles (for example safety staffing) before approval.
- **User value:** Stronger operational and safety policy compliance.
- **Implementation complexity:** Medium-High.
- **Risk:** Medium-High (policy modeling complexity, false blocking, operator override needs).
- **Suggested first PR scope:** Resource-level required-role policy model + precheck enforcement with clear conflict messages (no advanced staffing recommendation yet).

### Option E — Pause FieldOps and return to broader CadreOS MVP

- **Purpose:** Protect delivery focus by deferring further FieldOps expansion.
- **User value:** Faster progress on cross-module MVP priorities.
- **Implementation complexity:** Low.
- **Risk:** Low.
- **Suggested first PR scope:** Freeze FieldOps scope in planning docs, add backlog tickets for A-D options, and shift active implementation to highest-priority non-FieldOps MVP milestones.

---

## 12) Recommendation — safest next move

**Recommended safest next move: Option E (pause FieldOps expansion temporarily and return to broader CadreOS MVP priorities).**

Rationale:

- FieldOps MVP workflow is complete and usable for pilot scenarios.
- Remaining FieldOps options (A-D) all introduce medium-to-high implementation and product risk.
- Deferring expansion now reduces scope creep and preserves delivery confidence while keeping a clear, decision-ready backlog for FieldOps 7A.

---

## 13) Open product decisions after MVP closeout

These decisions remain open and should be explicitly selected before FieldOps 7A implementation starts:

- Which of options A-D should be first when FieldOps resumes
- Whether FieldOps should prioritize operational safety policy (Option D) before convenience features (A/B/C)
- What concurrency guarantees are required for booking create under higher usage
- Whether capacity becomes informational only or enforced policy

---

## 14) Source references

- [Phase 6A FieldOps Planning](./PHASE_6A_FIELDOPS_PLANNING.md)
- [Phase 6B FieldOps Schema Draft](./PHASE_6B_FIELDOPS_SCHEMA_DRAFT.md)
- [Phase 6C FieldOps Prisma Schema](./PHASE_6C_FIELDOPS_PRISMA_SCHEMA.md)
- [Phase 6D FieldOps DB Update and Schema Validation](./PHASE_6D_FIELDOPS_DB_UPDATE_VALIDATION.md)
- [Phase 6E FieldOps Read-Only Views](./PHASE_6E_FIELDOPS_READ_ONLY_VIEWS.md)
- [Phase 6F FieldOps Booking Request Workflow](./PHASE_6F_FIELDOPS_BOOKING_REQUEST_WORKFLOW.md)
- [Phase 6G FieldOps Conflict Prechecks](./PHASE_6G_FIELDOPS_CONFLICT_PRECHECKS.md)
- [Phase 6H FieldOps Booking Approval Workflow](./PHASE_6H_FIELDOPS_APPROVAL_WORKFLOW.md)
- [Phase 6I FieldOps MVP Polish](./PHASE_6I_FIELDOPS_MVP_POLISH.md)
- [Phase 6J FieldOps MVP Hardening](./PHASE_6J_FIELDOPS_MVP_HARDENING.md)
- [FieldOps Developer Setup](./FIELDOPS_DEVELOPER_SETUP.md)
- [FieldOps Validation Reference](./FIELDOPS_VALIDATION_REFERENCE.md)
- [FieldOps Manual Test Checklist](./FIELDOPS_MANUAL_TEST_CHECKLIST.md)
