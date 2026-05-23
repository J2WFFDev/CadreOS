# Phase 6G — FieldOps Conflict Prechecks

## Goal

Add MVP precheck/conflict detection for FieldOps booking requests while preserving organization scoping and existing auth/data-access patterns.

This phase intentionally does **not** implement approval/deny actions (Phase 6H), recurring bookings, external calendar sync, recommendation engines, or GearOps dependency checks.

---

## Precheck Behavior Added

On booking request creation:

- validates `endsAt` is after `startsAt` (existing server schema validation)
- verifies selected facility is active
- verifies selected resource is active
- detects overlap conflicts against existing bookings scoped to the same:
  - organization
  - resource
- overlap detection targets:
  - approved bookings (blocking)
  - pending/requested bookings (warning)

---

## Conflict Persistence and Status Mapping

Detected conflicts are now persisted to `BookingConflict` for each new booking.

Conflict severity and booking state mapping:

- **no conflicts**
  - `precheckStatus: PASSED`
  - `status: PRECHECK_PASSED`
- **warning conflicts**
  - `precheckStatus: WARNING`
  - `status: REQUESTED`
- **blocking conflicts**
  - `precheckStatus: FAILED`
  - `status: CONFLICT_FOUND`

Approval status remains request-time pending behavior; no approval workflow actions were added in this phase.

---

## UI Updates

- Booking cards now include clear conflict warnings when conflicts exist.
- Booking cards link to a new booking detail route.
- Added `/field-ops/bookings/[bookingId]` detail view with:
  - booking precheck/approval status summary
  - conflict warning banner
  - conflict list with severity/type/message
  - related booking links when available

---

## Files Changed

- `lib/field-ops-booking-precheck.ts`
- `app/(dashboard)/field-ops/bookings/create/route.ts`
- `app/(dashboard)/field-ops/bookings/page.tsx`
- `app/(dashboard)/field-ops/resources/[resourceId]/page.tsx`
- `components/field-ops/booking-card.tsx`
- `app/(dashboard)/field-ops/bookings/[bookingId]/page.tsx`
- `app/(dashboard)/field-ops/bookings/new/page.tsx`
- `planning/PHASE_6G_FIELDOPS_CONFLICT_PRECHECKS.md`
- `planning/README.md`

---

## Validation Performed

Validated with:

```bash
npm run lint
npm run typecheck
npm run build
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cadreos ./node_modules/.bin/prisma validate
```

Manual verification targets for this phase:

- non-overlapping booking request yields `precheckStatus: PASSED`
- overlapping booking persists `BookingConflict`
- overlap checks are scoped to same organization + resource
- different-resource bookings do not conflict
- inactive facility/resource produce blocking precheck conflict
- conflict results surface in booking list/detail UI
- no Phase 6H approval/deny action workflow added
- no recurring booking workflow added

---

## What Remains for Phase 6H

- approval/deny actions and action history
- assignment/escalation workflow for approvals
- post-approval transitions beyond request/precheck lifecycle
