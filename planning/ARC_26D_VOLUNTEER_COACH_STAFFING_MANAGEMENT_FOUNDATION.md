# ARC 26D — Volunteer, Coach, and Staffing Management Foundation

## Staffing Model

CadreOS MemberOps staffing foundation introduces explicit staffing role definitions and member staffing assignments while preserving existing lifecycle, household, qualification, and role-assignment models.

Staffing role model fields:

- `name`
- `category`
- `description`
- `requiredQualificationType`
- `requiredQualificationName`
- `active`
- `isSystemDefined`

Staffing assignment model fields:

- `personId`
- `staffingRoleId`
- `organizationId`
- `programId`
- `teamId`
- `startDate`
- `endDate`
- `status`
- `coverage` (`PRACTICE`, `MATCH`, `CLINIC`, `MEETING`)

Staffing assignment statuses:

- `ACTIVE`
- `INACTIVE`
- `PENDING`
- `SUSPENDED`

System-defined staffing roles seeded per organization:

- Coach
- Assistant Coach
- Head Coach
- Volunteer
- Board Member
- Range Officer
- Match Staff
- GearOps Staff
- Program Admin
- Organization Admin

Organizations can create additional staffing roles from the staffing foundation page.

## Volunteer Model

Volunteer staffing is represented as a first-class staffing role category (`VOLUNTEER`) and assignment state tracked through `StaffingAssignment`.

Implementation notes:

- Volunteer roles can be assigned at organization, program, or team scope.
- Volunteer assignments can include event coverage foundations (`Practices`, `Matches`, `Clinics`, `Meetings`).
- Qualification compatibility for Volunteer defaults to `Background Check` where configured.

## Coach Model

Coaching staffing is represented by `COACHING` role category assignments.

Implementation notes:

- Coach, Assistant Coach, and Head Coach are seeded as coaching roles.
- Qualification compatibility is surfaced alongside assignment status (for example, `SASP Coach Certification`).
- Assignment history is preserved and visible in member detail.

## Staffing Visibility and Member Detail Integration

MemberOps now exposes staffing visibility in two places:

- `/people/staffing` shows active staffing assignments and staffing role inventory.
- `/people/[personId]` shows staffing, volunteer, and coaching assignments with:
  - status
  - scope
  - qualification compatibility
  - event coverage foundation
  - assignment history

## Activity History Tracking

Staffing assignment activity is audit-tracked through:

- `staffing.assignment.assigned`
- `staffing.assignment.updated`
- `staffing.assignment.activated`
- `staffing.assignment.ended`
- `staffing.assignment.removed`

Operational history now includes staffing assignment audit records for person detail timelines.

## Manual Validation Checklist

- MEM-STAFF-001 Create staffing role.
- MEM-STAFF-002 Assign coach role.
- MEM-STAFF-003 Assign volunteer role.
- MEM-STAFF-004 Assign board role.
- MEM-STAFF-005 Qualification displays correctly.
- MEM-STAFF-006 Assignment history persists.
- MEM-STAFF-007 Team assignments remain functional.
- MEM-STAFF-008 Program assignments remain functional.
- MEM-STAFF-009 Member detail displays staffing assignments.
- MEM-STAFF-010 Existing permissions remain functional.

## Explicit Deferrals

- Full workforce scheduling
- Shift management
- Time tracking
- Volunteer hours
- Payroll concepts
