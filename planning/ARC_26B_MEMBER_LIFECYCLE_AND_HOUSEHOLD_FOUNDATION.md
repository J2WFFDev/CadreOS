# ARC 26B — Member Lifecycle and Household Foundation

## Member Lifecycle Model

CadreOS member lifecycle supports:

- Prospect
- Applicant
- Active Member
- Inactive Member
- Alumni
- Former Member

Implementation notes:

- `Person.lifecycleStatus` remains the canonical lifecycle field.
- `Person.lifecycleStatusChangedAt` tracks when the current lifecycle state was last updated.
- `Person.lifecycleStatusReason` stores optional transition context.
- Lifecycle transitions are audit-tracked through `AuditEvent` actions:
  - `person.lifecycle.create`
  - `person.lifecycle.update`
  - `person.lifecycle.activate`
  - `person.lifecycle.inactive`
  - `person.lifecycle.archive`

## Household Relationship Model

CadreOS household foundation uses linked relationships instead of a separate household table in this phase.

- `AthleteGuardianRelationship` remains the canonical link table.
- Multiple guardians per athlete are supported.
- Multiple athletes per guardian are supported.
- Household membership is represented as the visible graph of linked guardians and athletes from these records.

Guardian relationship fields:

- `relationshipType` (`PARENT` or `GUARDIAN`)
- `guardianRole` (`PRIMARY_GUARDIAN`, `SECONDARY_GUARDIAN`, `EMERGENCY_CONTACT`)

Relationship changes are audit-tracked through:

- `guardianRelationship.create`
- `guardianRelationship.update`

## Role Visibility Matrix

| Viewer role context | Linked athlete visibility | Unrelated athlete visibility | Team-assigned athlete visibility |
| --- | --- | --- | --- |
| Guardian | Allowed when linked through `AthleteGuardianRelationship` and workflow allows guardian-scoped access | Denied | Not implied unless separately assigned through staff/team role scope |
| Coach / Assistant Coach | Allowed for assigned team/program scope | Denied outside scope | Allowed |
| Program Director / Organization Admin | Allowed per configured staff scope | Allowed when in allowed staff scope | Allowed |

Notes:

- Staff-only views for guardian relationship diagnostics are preserved.
- Existing team/program/season assignments are unchanged by household relationship updates.

## Manual Validation Checklist

- MEM-LIFE-001 Create household.
- MEM-LIFE-002 Add guardian.
- MEM-LIFE-003 Add second guardian.
- MEM-LIFE-004 Add athlete.
- MEM-LIFE-005 Link athlete to guardian.
- MEM-LIFE-006 Guardian sees linked athlete.
- MEM-LIFE-007 Guardian cannot see unrelated athlete.
- MEM-LIFE-008 Member lifecycle state changes persist.
- MEM-LIFE-009 Team assignments remain functional.
- MEM-LIFE-010 Program assignments remain functional.
