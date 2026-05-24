# Phase 16E: GearOps Assignment Workflows

## Overview

Arc 16E adds staff-scoped assignment workflows for GearOps. These workflows allow staff to create and update `GearAssignment` records linking gear items to operational contexts (person, team, or event) within the organization. The implementation builds directly on the Arc 16B Prisma schema, Arc 16C read-only catalog views, and Arc 16D create/edit workflows, using the same organization scoping, staff authorization, and form/route patterns established across prior arcs.

Checkout/check-in workflows, maintenance write workflows, and consumable transaction write workflows remain deferred to later Arc 16 phases.

---

## Routes Added

| Route | Method | Description |
|-------|--------|-------------|
| `/gear-ops/items/[itemId]/assign` | GET | Assignment create form page |
| `/gear-ops/items/[itemId]/assign/create` | POST | Create assignment route handler |
| `/gear-ops/items/[itemId]/assignments/[assignmentId]/edit` | GET | Edit assignment form page |
| `/gear-ops/items/[itemId]/assignments/[assignmentId]/edit/update` | POST | Update assignment route handler |

---

## Assignment Visibility on Item Detail Page

The existing `GearItem` detail page (`/gear-ops/items/[itemId]`) already displayed assignment records in read-only form. Arc 16E enhances this section to:

- Add an **"Assign gear"** button (top-right of the Assignments section header) linking to the create form.
- Add an **"Edit"** link on each assignment card linking to the edit form.
- Split assignment visibility into **Current assignments** and **Assignment history** sections.
- Show labeled assignment context values for person/team/event and program (when derivable from assignment/item context).

These entry points are visible to all staff users who have read access to the item.

---

## Authorization

### Read-gate on form pages

Both the assign form and the edit form call `resolveGearOpsReadAccess()` to gate access before rendering. Staff-only read access is required. Denied access shows the standard denial message.

### Write-gate on route handlers

Both route handlers call `requirePhase1CMutationPermission()` with the appropriate GearOps assignment action:

| Role | `gearAssignment.create` | `gearAssignment.update` |
|------|-------------------------|-------------------------|
| ORGANIZATION_ADMIN | ✓ | ✓ |
| PROGRAM_DIRECTOR | ✓ | ✓ |
| COACH | ✓ | ✓ |
| ASSISTANT_COACH | — | — |

`gearAssignment.create` and `gearAssignment.update` are org-scoped (not in `SCOPED_ACTIONS`), consistent with `gearItem.create` and `gearItem.update`.

---

## Validation

### GearAssignment fields

| Field | Required | Constraints |
|-------|----------|-------------|
| `status` | Yes | Must be a valid `GearAssignmentStatus` enum value |
| `assignedToPersonId` | Conditional | Must exist in the same organization if provided |
| `assignedToTeamId` | Conditional | Must exist in the same organization if provided |
| `assignedToEventId` | Conditional | Must exist in the same organization if provided |
| `expectedReturnAt` | No | Must use YYYY-MM-DDTHH:mm format if provided |
| `returnedAt` | No | Must use YYYY-MM-DDTHH:mm format if provided |
| `notes` | No | Max 4000 characters |

Server-side workflow validation enforces exactly one assignment context selection among person/team/event. Empty context submissions and multi-context submissions are both rejected with field-level errors.

---

## Cross-Organization Protection

Both create and update route handlers explicitly verify that `assignedToPersonId`, `assignedToTeamId`, and `assignedToEventId` (when provided) belong to the same organization as the authenticated scope before committing changes. This prevents cross-organization reference injection.

The create handler also verifies that `gearItemId` belongs to the authenticated organization scope.

---

## Actor Attribution

The create handler resolves `assignedByPersonId` via `resolveActorPersonId()` using the authenticated user's linked person. If no person attribution can be resolved, the create handler returns an error redirect. The `assignedByPersonId` field is immutable on update — the update handler does not modify it.

---

## Error Handling

- All validation errors redirect back to the form page with field-level error parameters and preserved input values.
- Permission denied errors display the existing `PermissionDeniedError` message.
- Schema unavailable errors display a schema setup message.
- A not-found item on the create or edit page displays a clear "not found" message with a back link.
- A not-found assignment on the edit page displays a clear "not found" message with a back link to the item.
- If the update handler finds no matching assignment row (by id + gearItemId + organizationId), it returns an error redirect rather than silently succeeding.

---

## Redirect Flow

| Trigger | Redirect Target |
|---------|----------------|
| Successful assignment create | `/gear-ops/items/[itemId]` |
| Successful assignment update | `/gear-ops/items/[itemId]` |
| Cancel on assign form | `/gear-ops/items/[itemId]` |
| Cancel on edit assignment form | `/gear-ops/items/[itemId]` |

---

## Entry Points Added to Existing Pages

| Page | Change |
|------|--------|
| `/gear-ops/items/[itemId]` | Added "Assign gear" button in Assignments section header |
| `/gear-ops/items/[itemId]` (assignment cards) | Added "Edit" link on each assignment card |

---

## Permissions Added (`lib/permissions/index.ts`)

New `SupportedAction` entries:
- `gearAssignment.create`
- `gearAssignment.update`

Both are added to `SUPPORTED_ACTIONS`. Neither is added to `SCOPED_ACTIONS` — they follow the same org-scoped pattern as `gearItem.create` and `gearItem.update`.

---

## Workflow Schema Added (`lib/workflows/index.ts`)

- `gearAssignmentWorkflowSchema`: Validates and transforms status, three context fields (personId/teamId/eventId) with exact-one selection enforcement, two optional datetime fields (expectedReturnAt/returnedAt), and notes.
- `GearAssignmentWorkflowInput`: Type export for `gearAssignmentWorkflowSchema` output.

The `GearAssignmentStatus` enum import was added to the workflows module.

---

## Constraints Preserved

- No checkout/check-in workflows added.
- No maintenance write workflows added.
- No consumable transaction write workflows added.
- No messaging/notifications added.
- No purchasing/finance/depreciation added.
- No barcode/QR scanning added.
- Prisma schema is unchanged.
- All Arc 16C read-only routes are preserved intact.
- All Arc 16D category/item create/edit workflows are preserved intact.
- All Core and FieldOps behavior is preserved.
