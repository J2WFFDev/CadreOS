# FieldOps Validation Reference

This document describes the validation rules enforced by the FieldOps booking
workflow. All validation is implemented in `lib/workflows/index.ts`
(`bookingRequestWorkflowSchema`) and `lib/field-ops-booking-precheck.ts`.

---

## Required booking fields

| Field | Required | Notes |
|---|---|---|
| `resourceId` | Yes | Must reference a `FacilityResource` in the current organization |
| `title` | Yes | 1–160 characters |
| `startsAt` | Yes | `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss` format |
| `endsAt` | Yes | `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss` format |
| `facilityId` | No | Optional; if provided, must match the facility that owns the selected resource |
| `description` | No | Up to 4,000 characters |
| `programId` | No | If provided, must reference a Program in the current organization |
| `teamId` | No | If provided, must belong to the current organization (and to the selected program if both are set) |
| `eventId` | No | If provided, must reference an Event in the current organization; if program/team are also set, the event must belong to the same program/team |

---

## Date/time validation

- `startsAt` and `endsAt` must match the pattern `YYYY-MM-DDTHH:mm` or
  `YYYY-MM-DDTHH:mm:ss`.
- `endsAt` must be **strictly after** `startsAt` (equal values are rejected).
- Date/time values are interpreted as UTC (`dateTimeInputToUtcDate` in
  `lib/workflows/index.ts` appends `Z`).
- The booking create form uses `<input type="datetime-local">` which produces
  the expected format on modern browsers.

---

## Active facility and resource requirements

The precheck (`evaluateFieldOpsBookingPrecheck` in
`lib/field-ops-booking-precheck.ts`) inspects facility and resource status
**at the time the booking request is submitted**.

| Condition | Conflict type | Severity | Effect |
|---|---|---|---|
| Facility status is not `ACTIVE` | `RESOURCE_UNAVAILABLE` | `BLOCKING` | Booking created with status `CONFLICT_FOUND`; precheck `FAILED` |
| Resource status is not `ACTIVE` | `RESOURCE_UNAVAILABLE` | `BLOCKING` | Booking created with status `CONFLICT_FOUND`; precheck `FAILED` |

> The new booking request form only offers facilities and resources with
> `ACTIVE` status in the dropdowns, so inactive selections are prevented in
> normal UI flows. The route validates at the server level regardless.

---

## Conflict detection assumptions

Overlap is detected using a half-open interval query:

```
startsAt < new.endsAt  AND  endsAt > new.startsAt
```

This means bookings that share an exact boundary (one ends exactly when the
other starts) are **not** considered overlapping.

Existing bookings are included in the overlap check if they match any of:

- `status = APPROVED`
- `status IN (REQUESTED, PRECHECK_PASSED, CONFLICT_FOUND, RECOMMENDED)`
- `approvalStatus = PENDING`

Completed, canceled, and denied bookings are excluded from overlap detection.

| Overlap condition | Conflict type | Severity | Effect |
|---|---|---|---|
| Overlaps an approved booking | `RESOURCE_TIME_OVERLAP` | `BLOCKING` | Booking created with status `CONFLICT_FOUND`; precheck `FAILED` |
| Overlaps a pending/requested booking | `RESOURCE_TIME_OVERLAP` | `WARNING` | Booking created with status `REQUESTED`; precheck `WARNING` |

Multiple conflicts can be recorded for the same booking. All are persisted as
`BookingConflict` rows in the same transaction as the booking creation.

---

## Approval authorization assumptions

The `booking.approve` and `booking.deny` actions are enforced by
`requirePhase1CMutationPermission` (which calls `requirePermission` in
`lib/permissions/index.ts`).

| Role | `booking.approve` | `booking.deny` | `booking.create` |
|---|---|---|---|
| `ORGANIZATION_ADMIN` | ✅ | ✅ | ✅ |
| `PROGRAM_DIRECTOR` | ✅ | ✅ | ✅ |
| `COACH` | ❌ | ❌ | ✅ |
| `ASSISTANT_COACH` | ❌ | ❌ | ❌ |
| `PARENT_GUARDIAN` | ❌ | ❌ | ❌ |
| `ATHLETE` | ❌ | ❌ | ❌ |

Scoping rules:

- `ORGANIZATION_ADMIN` at organization scope can approve/deny any booking in
  the organization.
- `PROGRAM_DIRECTOR` at program scope can approve/deny bookings linked to their
  program.
- `COACH` at program or team scope can create bookings linked to their
  program/team but cannot approve or deny.

Additional approval guards enforced at the route level:

- Only bookings with `approvalStatus = PENDING` can be approved or denied.
- Bookings with `status = COMPLETED`, `CANCELED`, or `DENIED` reject all
  approval actions.
- Approval is blocked if the booking has any unresolved `BookingConflict` rows
  with `severity = BLOCKING` and `resolvedAt = null`.

---

## Booking status lifecycle

The create route sets initial status based on precheck results:

| Precheck result | `status` | `precheckStatus` |
|---|---|---|
| No conflicts | `PRECHECK_PASSED` | `PASSED` |
| Warning conflicts only | `REQUESTED` | `WARNING` |
| Any blocking conflict | `CONFLICT_FOUND` | `FAILED` |

After an approval decision:

| Decision | `status` | `approvalStatus` |
|---|---|---|
| Approve | `APPROVED` | `APPROVED` |
| Deny | `DENIED` | `DENIED` |

---

## Naming conventions (UI and code)

| Concept | UI label | Prisma model | Notes |
|---|---|---|---|
| Facility | Facility | `Facility` | Physical location |
| Resource | Resource | `FacilityResource` | Bookable unit at a facility |
| Booking / Booking Request | Booking / Booking request | `ResourceBooking` | One model serves both states |
| Conflict | Conflict | `BookingConflict` | |
| Precheck | Precheck | `PrecheckStatus` enum | |
| Approval | Approval / Decision | `ApprovalStatus` enum | |
