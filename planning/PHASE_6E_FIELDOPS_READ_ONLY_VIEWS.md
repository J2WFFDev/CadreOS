# Phase 6E — FieldOps Read-Only Views

## Goal

Expose read-only FieldOps views for `Facility`, `FacilityResource`, and `ResourceBooking` data while preserving existing CadreOS auth and organization-scoping behavior.

This phase intentionally does **not** add booking request creation, conflict detection, or approval workflow behavior.

---

## Routes Added

- `/field-ops` — redirects to the Facility list
- `/field-ops/facilities` — read-only Facility list
- `/field-ops/facilities/[facilityId]` — read-only Facility detail with related resources
- `/field-ops/resources/[resourceId]` — read-only Resource detail with related bookings
- `/field-ops/bookings` — read-only Booking list

---

## Navigation Updates

- Added **FieldOps** to the dashboard sidebar navigation.
- Added a **FieldOps** quick-link card on the dashboard so the route remains reachable on mobile where the sidebar is hidden.
- Added an in-section FieldOps sub-navigation for Facilities and Bookings.

---

## Read-Only Data Shown

### Facility list

Each Facility card shows:

- name
- description
- status
- address summary
- resource count
- booking count

### Facility detail

Each Facility detail page shows:

- facility name, description, status, and address
- related `FacilityResource` records
- resource type
- capacity
- booking count per resource

### Resource detail

Each Resource detail page shows:

- resource name, type, status, description, and capacity
- parent Facility
- related bookings

### Booking list

Each Booking card shows:

- title
- facility and resource
- start/end time
- status
- precheckStatus
- approvalStatus
- linked program/team/event where available

The booking list also supports read-only filtering by `facilityId` and `resourceId`.

---

## Empty / Loading / Error Behavior

- Empty state shown when no Facilities exist.
- Empty state shown when a Facility has no Resources.
- Empty state shown when a Resource has no Bookings.
- Empty state shown when no Bookings exist or when filters return no matches.
- Existing dashboard-style error handling is reused for database/schema failures and missing organization context.

---

## Seed / Demo Data Updates

Phase 6E extends the idempotent demo seed with:

- 1 published demo Event linked to FieldOps usage
- 2 demo `ResourceBooking` records
  - 1 approved booking linked to program, team, and event
  - 1 requested booking linked to program and team without an event

This keeps the phase read-only while giving the new views representative data to render.

---

## Explicitly Deferred

- No create/edit/delete actions in FieldOps views
- No booking request workflow (**Phase 6F**)
- No conflict detection logic (**Phase 6G**)
- No approval workflow actions/history (**Phase 6H**)

---

## Validation

Validated with:

```bash
npm run lint
npm run typecheck
npm run build
```

Additional checks performed:

- Verified all FieldOps queries include `organizationId` scoping.
- Verified the new UI exposes read-only navigation and detail/list views only.
- Verified seeded demo FieldOps bookings have linked program/team/event coverage for display validation.

---

## Phase 6E Output Summary

1. **Files changed**
   - `app/(dashboard)/field-ops/page.tsx`
   - `app/(dashboard)/field-ops/facilities/page.tsx`
   - `app/(dashboard)/field-ops/facilities/[facilityId]/page.tsx`
   - `app/(dashboard)/field-ops/resources/[resourceId]/page.tsx`
   - `app/(dashboard)/field-ops/bookings/page.tsx`
   - `components/field-ops/subnav.tsx`
   - `components/field-ops/booking-card.tsx`
   - `components/nav-sidebar.tsx`
   - `app/(dashboard)/dashboard/page.tsx`
   - `lib/field-ops.ts`
   - `prisma/seed.mjs`
   - `planning/PHASE_6E_FIELDOPS_READ_ONLY_VIEWS.md`
   - `planning/README.md`

2. **User-visible additions**
   - FieldOps navigation entry
   - Facility list
   - Facility detail
   - Resource detail with bookings
   - Booking list with linked context and read-only filters

3. **What remains for Phase 6F**
   - Booking request create flow
   - Input validation and submission UX for new bookings
   - Any workflow states or actions required to move from read-only browsing into request creation
