# Phase 17F — Season Rollover Workflow

## Goal

Add controlled staff-scoped season rollover support so an operator can transition roster memberships from one season to another while preserving historical roster membership records, lifecycle status integrity, guardian relationships, role assignments, FieldOps, and GearOps behavior.

## Scope

- Add staff-only season rollover entry point from the program detail page.
- Add season rollover form page: `GET /programs/[programId]/seasons/[seasonId]/rollover`.
- Add season rollover execute route: `POST /programs/[programId]/seasons/[seasonId]/rollover/execute`.
- Add `season.rollover` permission action.
- Reuse existing organization scoping and authorization patterns.
- Validate source season belongs to current organization and program.
- Validate target season belongs to current organization and program.
- Prevent source and target season from being the same.
- Validate program belongs to current organization.
- Carry forward only eligible roster memberships (excluding ARCHIVED persons by default, excluding INACTIVE persons by default unless operator explicitly enables them).
- Preserve `Person.lifecycleStatus`; do not activate, deactivate, or archive members during rollover.
- Create new `RosterMembership` records for the target season; do not mutate or delete source season records.
- Skip duplicate target-season roster memberships (use `createMany` with `skipDuplicates: true`).
- Preserve guardian relationships, role assignments, attendance, notes, tasks, FieldOps, and GearOps records.
- Add safe redirect to program page with success indicator after rollover.
- Provide cancel/back links throughout the workflow.
- Add clear error states for invalid program/season IDs or invalid rollover attempts.

## Route Design Decision

The rollover entry point is placed at `/programs/[programId]/seasons/[seasonId]/rollover`. This path is consistent with the existing season-level routing pattern (`/programs/[programId]/seasons/[seasonId]/edit`) and keeps rollover scoped to a specific source season within a specific program. This is the smallest consistent path that preserves program and season context without introducing a new top-level route segment.

The execute sub-route lives at `rollover/execute` to match the move workflow pattern (`/people/[personId]/move/update`).

## Authorization

### New permission action

- `season.rollover` — executes a season roster rollover.

Granted to:
- `ORGANIZATION_ADMIN`
- `PROGRAM_DIRECTOR`

Not granted to:
- `COACH`
- `ASSISTANT_COACH`
- `ATHLETE`
- `PARENT_GUARDIAN`

Per Phase 17A architecture, season rollover is an org/program-level operation, not team-scoped. COACH is excluded from this action.

### Scope behavior

`season.rollover` is added to `SCOPED_ACTIONS` (same as `season.create` and `season.update`), meaning:
- `ORGANIZATION_ADMIN` with `ORGANIZATION` scope can always execute rollover.
- `PROGRAM_DIRECTOR` with `PROGRAM` scope for the relevant program can execute rollover.
- Program scope is resolved from the `programId` route parameter passed to `requirePhase1CMutationPermission`.

### Runtime enforcement

- Rollover page uses `evaluateStaffOnlyContentAccess` for display-level access check.
- Execute route uses `requirePhase1CMutationPermission` with action `season.rollover` and `programId`.

## Workflow Surfaces

### Program detail page (`/programs/[programId]`)

- Added **Rollover** link next to each season in the seasons list.
- Added `rolloverSuccess` query parameter display: shown as a green success banner when rollover completes.
- Existing **Edit** link per season is unchanged.
- Existing program-level actions (Edit program, New season) are unchanged.

### Season rollover page (`/programs/[programId]/seasons/[seasonId]/rollover`)

**Content:**
- Source season context (program name, season name).
- Description of what rollover does and what is preserved.
- Preview filter form (GET, same page) with:
  - `targetSeasonId` select — all seasons in the same program excluding the source season.
  - `includeInactive` checkbox — default unchecked (INACTIVE persons excluded by default).
  - "Refresh preview" button.
- Eligible members preview list showing name, team, roster role, and lifecycle status.
- Confirm and execute form (POST to `/execute`) with:
  - Hidden `targetSeasonId`, `includeInactive`, and `confirm=1` fields.
  - Description of rollover scope.
  - "Execute rollover" button.
  - "Cancel" link back to program page.
- Error display via `?error=` query parameter.

## Route Behavior

### GET `/programs/[programId]/seasons/[seasonId]/rollover`

- Loads source season (validates it belongs to current org and program).
- Loads available target seasons (same program, excludes source season).
- Loads eligible roster memberships based on `targetSeasonId` and `includeInactive` query params.
- Staff-only content access check via `evaluateStaffOnlyContentAccess`.
- Returns 404-like not-found state if source season is not found in current org and program.

### POST `/programs/[programId]/seasons/[seasonId]/rollover/execute`

- Validates `targetSeasonId` and `confirm=1` via `seasonRolloverWorkflowSchema`.
- Requires `season.rollover` permission via `requirePhase1CMutationPermission` with `programId`.
- Validates source season exists in current org and program.
- Validates `targetSeasonId !== seasonId`.
- Validates target season exists in current org and same program.
- Queries eligible roster memberships from source season:
  - Always excludes ARCHIVED persons.
  - Excludes INACTIVE persons unless `includeInactive=1`.
- Creates new `RosterMembership` records for target season using `createMany` with `skipDuplicates: true`.
- Redirects to `/programs/[programId]?rolloverSuccess=...` on success.
- Redirects to rollover page with `?error=...` on failure.
- Does not delete or modify source-season memberships.
- Does not change `Person.lifecycleStatus`.
- Does not modify role assignments, guardian relationships, notes, tasks, attendance, FieldOps, or GearOps records.

## Implementation

### lib/permissions/index.ts

- Added `"season.rollover"` to the `SupportedAction` union type.
- Added `"season.rollover"` to `ORGANIZATION_ADMIN` and `PROGRAM_DIRECTOR` role action sets.
- Added `"season.rollover"` to `SCOPED_ACTIONS`.
- Added `"season.rollover"` to `SUPPORTED_ACTIONS`.
- `COACH` does not receive `season.rollover` (per Phase 17A authorization matrix).

### lib/workflows/index.ts

- Added `seasonRolloverWorkflowSchema`: validates `targetSeasonId` (required), `includeInactive` (optional string), and `confirm=1`.
- Added `SeasonRolloverWorkflowInput` type export.
- Added `"season.rollover"` to the `requirePhase1CMutationPermission` action union.

### app/(dashboard)/programs/[programId]/seasons/[seasonId]/rollover/page.tsx (NEW)

- GET handler for season rollover workflow display.
- Staff-only access check via `evaluateStaffOnlyContentAccess`.
- Loads source season, available target seasons, and eligible member preview.
- Preview filter form (GET) and confirmation/execute form (POST).
- Error display via `?error=` query param.

### app/(dashboard)/programs/[programId]/seasons/[seasonId]/rollover/execute/route.ts (NEW)

- POST handler for season rollover execution.
- Organization-scoped season lookups before write.
- Guards same-season rollover attempts.
- Uses `createMany` with `skipDuplicates: true` for safe duplicate handling.
- Redirects to program page with `rolloverSuccess` message on success.

### app/(dashboard)/programs/[programId]/page.tsx

- Added `searchParams` prop.
- Added `rolloverSuccess` query param display as green success banner.
- Added **Rollover** link next to each season in the seasons list.

## Eligible Membership Filter

| Person lifecycle status | Default (includeInactive=false) | With includeInactive=1 |
|---|---|---|
| `ACTIVE` | ✅ included | ✅ included |
| `PROSPECT` | ✅ included | ✅ included |
| `ALUMNI` | ✅ included | ✅ included |
| `INACTIVE` | ❌ excluded | ✅ included |
| `ARCHIVED` | ❌ excluded | ❌ excluded (always) |

## Referential Safety

All historical data is preserved on rollover:

| Record type | Behavior during rollover |
|---|---|
| Source `RosterMembership` | Preserved without modification |
| Target `RosterMembership` | New records created; duplicates skipped |
| `RoleAssignment` | Preserved without modification |
| `AthleteGuardianRelationship` | Preserved without modification |
| `AttendanceRecord` | Preserved without modification |
| `ObservationNote` | Preserved without modification |
| `FollowUpTask` | Preserved without modification |
| `GearAssignment` | Preserved without modification |
| `GearCheckout` | Preserved without modification |
| FieldOps booking references | Preserved without modification |
| `Person.lifecycleStatus` | Preserved without modification |

No cascade operations are triggered. No records are deleted. No lifecycle states are changed.

## Backward Compatibility

- Existing `personWorkflowSchema`, `memberLifecycleActivateSchema`, `memberLifecycleInactiveSchema`, `memberLifecycleArchiveSchema`, and `memberMoveWorkflowSchema` are unchanged.
- Activate, inactive, archive, and move workflows are unchanged.
- Role assignment behavior is unchanged.
- Guardian relationship behavior is unchanged.
- No Prisma schema changes in Arc 17F.
- No FieldOps or GearOps behavior changes in Arc 17F.

## Deferred (Not in 17F)

- Guardian relationship maintenance workflows
- Roster readiness dashboards
- Per-member selection UI (rollover rolls all eligible members in one operation)
- Season status model (PLANNED/ACTIVE/COMPLETED/ARCHIVED lifecycle for seasons)
- Reporting, messaging, and communications
- Parent portal behavior
- Payments/dues/billing

## Arc 17F Output Summary

Arc 17F introduces staff-scoped season rollover workflow for ORGANIZATION_ADMIN and PROGRAM_DIRECTOR roles. Staff navigate to a source season's rollover page from the program detail view, select a target season (in the same program), optionally include INACTIVE persons, preview eligible members, and execute the rollover. The execute route creates new RosterMembership records in the target season using `createMany` with `skipDuplicates: true`, preserving all source-season records and all historical data without lifecycle or referential side effects. All existing join, activate, move, inactive, and archive behavior is preserved.
