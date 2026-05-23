# Phase 6F — FieldOps Booking Request Workflow

## Goal

Add the first FieldOps write workflow so users can submit a booking request for an existing `FacilityResource` while preserving organization scoping and existing auth/data-access patterns.

This phase intentionally does **not** implement conflict detection (Phase 6G), approval/deny workflow actions (Phase 6H), recurring bookings, external calendar sync, or GearOps integration.

---

## Routes Added

- `/field-ops/bookings/new` — booking request form
- `/field-ops/bookings/create` — server mutation route for booking request creation

---

## Booking Request Form Inputs

The new form captures:

- facility (optional explicit selection; resource remains the source of truth)
- resource (**required**)
- title (**required**)
- description/notes (optional)
- startsAt (**required**)
- endsAt (**required**, must be after `startsAt`)
- optional program context
- optional team context
- optional event linkage

---

## Validation and Mutation Behavior

### Input validation

- `resourceId`, `title`, `startsAt`, and `endsAt` are required.
- `endsAt` must be strictly after `startsAt`.
- Datetime fields use the same existing local-datetime parsing pattern as other workflows.

### Organization-scoped reference checks

On submit, the route validates that selected references belong to the active organization:

- resource (required)
- program (optional)
- team (optional, and must match selected program when program is provided)
- event (optional, and must match selected program/team context when provided)

Facility/resource consistency is validated, and the booking `facilityId` is sourced from the selected resource to avoid cross-org/cross-facility mismatch.

### Record creation defaults

Creates a `ResourceBooking` with:

- `status: REQUESTED`
- `precheckStatus: NOT_RUN`
- `approvalStatus: PENDING`

Requester attribution uses the current logged-in user/person relationship via existing actor-person resolution.

No conflict detection and no approval action workflow are run in this phase.

---

## Navigation / Entry Points

New **New booking request** entry points were added from FieldOps read views:

- Facilities list
- Facility detail
- Resource detail
- Bookings list
- FieldOps sub-navigation

Existing read-only data views remain intact.

---

## Feedback and Redirect Behavior

- Validation and mutation errors redirect back to `/field-ops/bookings/new` with field-level errors and a general error message.
- Successful creation redirects to `/field-ops/bookings?created=1&resourceId=<id>`.
- Bookings list now shows a success banner when `created=1`.

---

## Files Changed

- `app/(dashboard)/field-ops/bookings/new/page.tsx`
- `app/(dashboard)/field-ops/bookings/create/route.ts`
- `app/(dashboard)/field-ops/bookings/page.tsx`
- `app/(dashboard)/field-ops/facilities/page.tsx`
- `app/(dashboard)/field-ops/facilities/[facilityId]/page.tsx`
- `app/(dashboard)/field-ops/resources/[resourceId]/page.tsx`
- `components/field-ops/subnav.tsx`
- `lib/workflows/index.ts`
- `lib/permissions/index.ts`
- `planning/PHASE_6F_FIELDOPS_BOOKING_REQUEST_WORKFLOW.md`
- `planning/README.md`

---

## Validation Performed

Validated with:

```bash
npm run lint
npm run typecheck
npm run build
```

Manual flow verification targets for Phase 6F:

- create booking request from seeded FieldOps data
- invalid date ranges blocked by form validation
- created records appear in Phase 6E booking list
- organization scoping enforced in all booking create references
- no Phase 6G conflict detection behavior present
- no Phase 6H approval/deny action workflow present

---

## What Remains for Phase 6G

- resource/facility conflict detection engine
- conflict record generation in `BookingConflict`
- precheck execution lifecycle beyond `NOT_RUN`
- conflict-aware user feedback and recommendations
