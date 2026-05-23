# FieldOps Manual Test Checklist

Use this checklist to verify the end-to-end FieldOps MVP workflow after
seeding demo data. All tests assume:

- Demo data has been seeded (`npm run prisma:seed`).
- The dev server is running (`npm run dev`).
- You are signed in as a user linked to an `ORGANIZATION_ADMIN` person
  (unless the test specifies a different role).

---

## Setup: verify seeded data is present

- [ ] Navigate to `/field-ops`. Confirm the dashboard shows:
  - **Total booking requests:** 2
  - **Pending approvals:** 1
  - **Approved bookings:** 1
  - **Upcoming approved:** 1 (if current date is before 2026-06-15)
- [ ] Navigate to `/field-ops/facilities`. Confirm "Demo Range Complex" is
  listed with status ACTIVE.
- [ ] Navigate to `/field-ops/resources`. Confirm Bay A and Bay B are listed
  with status ACTIVE.
- [ ] Navigate to `/field-ops/bookings`. Confirm two seeded bookings are listed.

---

## Test 1 — Create a valid booking request

- [ ] Navigate to `/field-ops/bookings/new`.
- [ ] Select a facility and resource (e.g., Demo Range Complex → Bay B).
- [ ] Enter a title (e.g., "Test Range Session").
- [ ] Set `startsAt` to a future date/time not overlapping any existing booking
  (e.g., `2026-07-01T09:00`).
- [ ] Set `endsAt` to a later time (e.g., `2026-07-01T10:00`).
- [ ] Optionally select a program.
- [ ] Submit.
- **Expected:** Redirect to `/field-ops/bookings` with a success indicator.
  New booking appears in the list with `status = PRECHECK_PASSED` and
  `approvalStatus = PENDING`.

---

## Test 2 — Reject invalid date range (end before start)

- [ ] Navigate to `/field-ops/bookings/new`.
- [ ] Select a resource.
- [ ] Enter a title.
- [ ] Set `startsAt` to `2026-07-01T10:00`.
- [ ] Set `endsAt` to `2026-07-01T09:00` (before startsAt).
- [ ] Submit.
- **Expected:** Form error on the `endsAt` field: "End date/time must be after
  start date/time." No booking is created.

---

## Test 3 — Reject missing required fields

- [ ] Navigate to `/field-ops/bookings/new`.
- [ ] Submit the form with no values entered.
- **Expected:** Field errors for at least `resourceId` ("Resource selection is
  required."), `title` ("Booking title is required."), `startsAt` ("Start
  date/time is required."), and `endsAt` ("End date/time is required.").

---

## Test 4 — Detect overlapping booking (warning)

- [ ] Navigate to `/field-ops/bookings/new`.
- [ ] Select Bay B (which has the seeded pending booking on 2026-06-17
  18:00–19:30).
- [ ] Set `startsAt` to `2026-06-17T18:30`.
- [ ] Set `endsAt` to `2026-06-17T19:00` (overlaps the pending booking).
- [ ] Enter a title and submit.
- **Expected:** Booking is created with `status = REQUESTED` and
  `precheckStatus = WARNING`. The booking detail page shows a conflict warning
  referencing the overlapping booking.

---

## Test 5 — Detect overlapping booking (blocking — approved overlap)

- [ ] Navigate to `/field-ops/bookings/new`.
- [ ] Select Bay A (which has the seeded approved booking on 2026-06-15
  14:00–16:00).
- [ ] Set `startsAt` to `2026-06-15T14:30`.
- [ ] Set `endsAt` to `2026-06-15T15:30` (overlaps the approved booking).
- [ ] Enter a title and submit.
- **Expected:** Booking is created with `status = CONFLICT_FOUND` and
  `precheckStatus = FAILED`. The booking detail page shows a blocking conflict.

---

## Test 6 — Approve a valid (non-blocking) booking request

- [ ] Use the booking created in Test 1 (no conflicts, PENDING approval).
- [ ] Navigate to its detail page.
- [ ] Click **Approve**.
- **Expected:** Booking `status` changes to `APPROVED` and `approvalStatus`
  changes to `APPROVED`. The approve/deny buttons are no longer shown.
  Dashboard "Approved bookings" count increments.

---

## Test 7 — Deny a booking request

- [ ] Use the seeded Bay B "Open Skills Bay Session" (REQUESTED, PENDING), or
  any other pending booking.
- [ ] Navigate to its detail page.
- [ ] Click **Deny**.
- **Expected:** Booking `status` changes to `DENIED` and `approvalStatus`
  changes to `DENIED`. The approve/deny buttons are no longer shown.

---

## Test 8 — Attempt to approve a booking with blocking conflicts

- [ ] Use the booking created in Test 5 (CONFLICT_FOUND, blocking conflict).
- [ ] Navigate to its detail page.
- [ ] Attempt to click **Approve** (if the button is visible).
- **Expected:** An error message is shown: "This booking has blocking conflicts
  and cannot be approved under current policy." The booking status does not
  change.

---

## Test 9 — Verify unauthorized users cannot approve or deny

- [ ] Sign in as a user linked to a person with `COACH` role only (no
  ORGANIZATION_ADMIN or PROGRAM_DIRECTOR assignment).
- [ ] Navigate to the detail page of any PENDING booking.
- [ ] Attempt to click **Approve** or **Deny**.
- **Expected:** An error redirect occurs with the message "You do not have
  permission for this write action in the requested scope." The booking status
  does not change.

---

## Test 10 — Verify dashboard counts

- [ ] After completing Tests 1–7, navigate to `/field-ops`.
- **Expected:** Summary counts reflect the current booking states:
  - Total requests includes all created bookings.
  - Pending approvals reflects only bookings still in PENDING state.
  - Approved bookings count includes those approved in testing.
  - "Bookings with conflicts" count includes the blocking-conflict booking from
    Test 5.

---

## Test 11 — Verify inactive resource block

- [ ] In a database client or seed override, set one resource to
  `status = INACTIVE`.
- [ ] Navigate to `/field-ops/bookings/new`.
- **Expected:** The inactive resource does not appear in the resource dropdown.
- [ ] (If testing server-side guard directly): submit a booking request
  pointing at the inactive resource via direct form manipulation.
- **Expected:** Booking is created with `precheckStatus = FAILED` and a
  `RESOURCE_UNAVAILABLE / BLOCKING` conflict recorded.

---

## Test 12 — Verify organization scoping

- [ ] Confirm that navigating to any FieldOps route with no organization
  context returns an appropriate "No organization context" message rather than
  exposing data from another organization.

---

## Acceptance criteria summary

| Scenario | Pass condition |
|---|---|
| Valid booking create | Booking saved, precheck runs, redirect to list |
| End before start | Field error, no booking created |
| Missing required fields | Field errors shown, no booking created |
| Warning overlap | Booking created with WARNING precheck and conflict row |
| Blocking overlap | Booking created with FAILED precheck and BLOCKING conflict row |
| Approve valid request | Status → APPROVED, buttons hidden |
| Deny request | Status → DENIED, buttons hidden |
| Approve with blocking conflict | Error shown, status unchanged |
| Unauthorized approve/deny | Permission error, status unchanged |
| Dashboard counts | Reflect actual database state |
