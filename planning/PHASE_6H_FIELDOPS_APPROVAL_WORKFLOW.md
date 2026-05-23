# Phase 6H — FieldOps Booking Approval Workflow

## Goal

Add human approve/deny actions for FieldOps booking requests while preserving existing organization scoping, auth patterns, and Phase 6G conflict behavior.

This phase intentionally does **not** add recurring bookings, external calendar sync, recommendation engines, GearOps dependency checks, or expanded conflict detection logic.

---

## Workflow Added

- Added booking decision mutation route: `POST /field-ops/bookings/[bookingId]/decision`
- Added booking detail controls for:
  - **Approve booking**
  - **Deny booking**
- Decisions are only allowed when booking `approvalStatus` is `PENDING`.

Approval behavior:

- sets `approvalStatus = APPROVED`
- sets `status = APPROVED`
- sets `approvedByPersonId` using current actor attribution resolution

Denial behavior:

- sets `approvalStatus = DENIED`
- sets `status = DENIED`

Existing `precheckStatus` and persisted `BookingConflict` rows are preserved.

---

## Authorization Policy Applied

- `ORGANIZATION_ADMIN` can approve/deny booking requests.
- `PROGRAM_DIRECTOR` can approve/deny within resolved program/team/event scope.
- `COACH` remains request-only (`booking.create`) and cannot approve/deny in MVP.
- `ASSISTANT_COACH`, `PARENT_GUARDIAN`, and `ATHLETE` cannot approve/deny in MVP.

Authorization is enforced with existing centralized permission checks (`requirePhase1CMutationPermission` / `lib/permissions`).

---

## Conflict Guardrail

Approval is blocked when unresolved `BookingConflict` entries contain `severity = BLOCKING`.

No override path was added in this phase because no explicit schema/policy support exists for override in current MVP.

---

## UI Updates

- Booking detail now surfaces:
  - success/error banners for decision actions
  - explicit decision controls for authorized users
  - clear “requested by” and “decision by” attribution
- Booking list cards now show clearly labeled status and approval badges.
- Booking request form copy now references approval/deny availability in booking detail.

---

## Schema-Conditional Notes

- `BookingApprovalHistory` is not present in current Prisma schema, so no approval history writes were added.
- Denial note/reason persistence is not present in current booking schema, so denial notes were not stored in this phase.

---

## Files Changed

- `lib/permissions/index.ts`
- `lib/workflows/index.ts`
- `app/(dashboard)/field-ops/bookings/[bookingId]/decision/route.ts`
- `app/(dashboard)/field-ops/bookings/[bookingId]/page.tsx`
- `components/field-ops/booking-card.tsx`
- `app/(dashboard)/field-ops/bookings/new/page.tsx`
- `planning/PHASE_6H_FIELDOPS_APPROVAL_WORKFLOW.md`
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

Manual validation checklist:

- authorized users can approve pending bookings
- authorized users can deny pending bookings
- unauthorized roles cannot approve/deny
- approval/denial updates are visible in booking detail and booking list
- approval attribution is captured for approval actions
- bookings with blocking conflicts cannot be approved
- no recurring booking, external calendar sync, or GearOps logic was added
