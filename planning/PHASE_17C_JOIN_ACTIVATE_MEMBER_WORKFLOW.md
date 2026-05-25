# Phase 17C — Join and Activate Member Workflow

## Goal

Add staff-scoped join and activate workflows that allow an operator to create or activate a person/member into the lifecycle model without disrupting existing people, roles, roster, guardian, FieldOps, or GearOps behavior.

## Scope

- Add lifecycle status selection to the person create form (join path).
- Add member activation workflow for PROSPECT, INACTIVE, and ALUMNI persons.
- Expose current lifecycle status on the person detail page.
- Expose lifecycle status on the people list page.
- Add `person.activate` permission action gated to ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, and COACH roles.
- Preserve all existing people, role assignment, roster membership, guardian, FieldOps, and GearOps behavior.
- Do not add team/program move, inactive/archive, season rollover, or guardian maintenance workflows.

---

## Workflow Surfaces

### 1. Join — Create Person with Lifecycle Status

**Entry point:** `/people/new` (existing)

**Change:** The new person form now includes a **Member status** select field with all `MemberLifecycleStatus` values:
- `ACTIVE` (default) — joins the person directly as active
- `PROSPECT` — adds the person as a prospect pending activation
- `INACTIVE` — adds the person in an inactive state
- `ARCHIVED` — adds the person in an archived state
- `ALUMNI` — adds the person as an alumni

**Route:** `POST /people/create`

**Behavior:**
- Validates all fields using `joinPersonWorkflowSchema` (extends existing validation with `lifecycleStatus`).
- Uses existing `person.create` permission action — no new permission required for the create path.
- Creates the person with the selected `lifecycleStatus`.
- Redirects to the person detail page on success (changed from list redirect, to immediately show the created person).
- Preserves existing field validation and error redirect behavior.

### 2. Activate — Transition Person to ACTIVE

**Entry point:** Person detail page (`/people/[personId]`) → "Member lifecycle status" section → "Activate member" button

**Route:** `POST /people/[personId]/activate`

**Behavior:**
- Only shows the "Activate member" button if the person's `lifecycleStatus` is PROSPECT, INACTIVE, or ALUMNI.
- ACTIVE and ARCHIVED persons do not show the activate button.
- Validates a `confirm=1` field to prevent accidental form submission.
- Requires `person.activate` permission (ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH).
- Validates the person belongs to the current organization.
- Validates the current `lifecycleStatus` is activatable before updating.
- Updates `lifecycleStatus` to `ACTIVE`.
- Redirects to the person detail page on success.
- Redirects with `activateError` search param on failure.
- Does not modify roles, roster memberships, or guardian relationships.

### 3. Lifecycle Status Visibility

**Person list page (`/people`):**
- Displays a **Status** column showing the person's current lifecycle status.

**Person detail page (`/people/[personId]`):**
- Displays a **Member lifecycle status** card with:
  - Current status label (color-coded: green for Active, blue for Prospect, neutral for others).
  - Activation error message if `activateError` is present in search params.
  - "Activate member" button with confirmation note for eligible persons.

---

## Authorization

| Action | ORGANIZATION_ADMIN | PROGRAM_DIRECTOR | COACH | ASSISTANT_COACH | ATHLETE | PARENT_GUARDIAN |
|--------|--------------------|------------------|-------|-----------------|---------|-----------------|
| `person.create` (join) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `person.activate` (activate) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

Notes:
- `person.create` permission remains unchanged from Arc 17B (ORGANIZATION_ADMIN only).
- `person.activate` is a new permission action added to the `SupportedAction` union in `lib/permissions/index.ts`.
- COACH and PROGRAM_DIRECTOR gain `person.activate` for lifecycle activation.
- No parallel authorization model introduced; uses `requirePhase1CMutationPermission` for all route writes.

---

## Implementation

### lib/permissions/index.ts

- Added `"person.activate"` to the `SupportedAction` union type.
- Added `"person.activate"` to ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, and COACH role action sets.
- Added `"person.activate"` to `SUPPORTED_ACTIONS`.

### lib/workflows/index.ts

- Added `MemberLifecycleStatus` to Prisma client imports.
- Added `joinPersonWorkflowSchema`: extends person field validation with `lifecycleStatus` as a required enum field.
- Added `memberLifecycleActivateSchema`: validates `confirm=1` to confirm activation intent.
- Added `"person.activate"` to the `requirePhase1CMutationPermission` action union.

### app/(dashboard)/people/new/page.tsx

- Added `MemberLifecycleStatus` import.
- Added `LIFECYCLE_STATUS_LABELS` map for human-readable status labels.
- Added `lifecycleStatus` select field defaulting to `ACTIVE`.
- Preserves all existing field rendering and error display patterns.

### app/(dashboard)/people/create/route.ts

- Switched from `personWorkflowSchema` to `joinPersonWorkflowSchema`.
- Accepts `lifecycleStatus` from form data (defaults to `"ACTIVE"` if blank).
- Passes `lifecycleStatus` to `db.person.create`.
- Redirects to person detail page on success (was: people list).
- Preserves all existing error redirect and permission check patterns.

### app/(dashboard)/people/[personId]/activate/route.ts (NEW)

- POST handler for `person.activate` workflow.
- Organization-scoped person lookup before update.
- Guards against activating already-ACTIVE or ARCHIVED persons.
- Uses `person.lifecycleStatus` update via `db.person.update` with org-scoped where clause.

### app/(dashboard)/people/[personId]/page.tsx

- Added `MemberLifecycleStatus` import.
- Added `lifecycleStatus` to person type annotation.
- Added `activateError` search param read.
- Added **Member lifecycle status** card above the operational summary section.
- Shows color-coded status label.
- Shows error message when `activateError` is set.
- Shows "Activate member" form for PROSPECT, INACTIVE, ALUMNI persons.

### app/(dashboard)/people/page.tsx

- Added `lifecycleStatus` to person type annotation.
- Added **Status** column to the people list table.

---

## Backward Compatibility

- Existing `personWorkflowSchema` is preserved and unchanged.
- `joinPersonWorkflowSchema` is a new export; the existing `personWorkflowSchema` export is not removed.
- Create route previously redirected to `/people`; now redirects to `/people/${person.id}`. This is a UX improvement consistent with the detail-page-first pattern in other create workflows.
- All existing role assignment, roster membership, guardian, FieldOps, and GearOps behavior is unchanged.
- Existing `Person` records without explicit lifecycle status default to `ACTIVE` via the schema default, so no data migration is needed.

---

## Deferred by Design (Not in 17C)

- Team/program move workflows
- Inactive/archive execution workflows
- Season rollover workflows
- Guardian relationship maintenance workflows
- Roster readiness dashboards
- Reporting, messaging, and communications
- Parent portal behavior
- Payments/dues/billing

---

## Arc 17C Output Summary

Arc 17C adds staff-scoped join and activate workflow surfaces. Staff with `person.create` permission can create a person with any lifecycle status (join as PROSPECT for a staged onboarding, or join directly as ACTIVE). Staff with `person.activate` permission (ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH) can activate PROSPECT, INACTIVE, or ALUMNI persons to ACTIVE from the person detail page. Lifecycle status is now visible on the people list and person detail pages. All existing runtime behavior is preserved.
