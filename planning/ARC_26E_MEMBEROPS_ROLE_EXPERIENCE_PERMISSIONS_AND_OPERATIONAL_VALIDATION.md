# ARC 26E — MemberOps Role Experience, Permissions, and Operational Validation

## Goal

Validate MemberOps role experience, permissions, visibility, and operational workflow consistency across supported roles without major feature expansion, module renaming, or UI redesign.

## Role Mapping for Validation

CadreOS runtime auth personas use `ADMIN`, `PROGRAM_MANAGER`, `COACH`, `ASSISTANT_COACH`, `GUARDIAN`, and `ATHLETE`. Arc 26E role validation maps requested operational labels as follows:

- Athlete → `ATHLETE`
- Guardian → `GUARDIAN`
- Volunteer → staffing assignment role; no standalone auth persona
- Coach → `COACH`
- GearOps Admin → staffing assignment role (`GearOps Staff`) plus staff auth persona
- Program Admin → `PROGRAM_MANAGER`
- Organization Admin → `ADMIN`

## MemberOps Role Matrix

| Role | Can View | Can Create | Can Edit | Can Assign | Can Approve | Can Manage Qualifications | Can Manage Staffing | Can Manage Households | Can Manage Members |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Athlete | Own dashboard/work views only | No | No | No | No | No | No | No | No |
| Guardian | Guardian/linked-member scoped views | No | No | No | No | No | No | Linked athlete visibility only (no relationship mutation) | No |
| Volunteer | Role-scoped staffing visibility when combined with staff auth; no standalone MemberOps auth persona | No | No | No | No | No | No | No | No |
| Coach | Team/program-scoped MemberOps views | Scoped member actions | Scoped member actions | Scoped roster/staffing assignment actions | No | Yes (assignment/update) | Yes (role/staffing assignment in scope) | No | Scoped member lifecycle actions |
| GearOps Admin | Operationally modeled via staffing role assignment; MemberOps authority depends on assigned auth persona scope | Depends on persona | Depends on persona | Depends on persona | Depends on persona | Depends on persona | Depends on persona | Depends on persona | Depends on persona |
| Program Admin (`PROGRAM_MANAGER`) | Program-scoped MemberOps | Yes (program scope) | Yes (program scope) | Yes (program scope) | Yes (`booking.approve`/`booking.deny`) | Yes | Yes | Yes | Yes |
| Organization Admin (`ADMIN`) | Organization-wide MemberOps | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

## MemberOps Workflow Matrix

| Workflow | Athlete | Guardian | Volunteer | Coach | Program Admin | Organization Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Household relationships | Linked athlete visibility only | Linked athlete visibility; unrelated athlete denied | N/A unless also guardian/staff | View in scope | Full create/update in scope | Full create/update |
| Lifecycle transitions | Read-only personal context | Read-only linked context | N/A standalone | Scoped activation/deactivation/archive | Scoped lifecycle management | Org-wide lifecycle management |
| Qualification assignment/expiration | Read-only assigned state | Linked-member visibility where permitted | N/A standalone | Scoped assignment/update | Scoped definition + assignment management | Full definition + assignment management |
| Staffing assignments | Read-only where exposed | Read-only where exposed | Participates as assignee | Scoped assignment/update | Scoped assignment/update | Org-wide assignment/update |
| Member creation/profile management | No | No | No | Scoped operations in team/program context | Program scope | Organization scope |
| Dashboard relevance | Personal work views | Household/linked visibility context | Role-specific staffing context | Team/program operational context | Program operational context | Organization operational context |

## Validation Summary

### 1) Household Validation

Validated against existing relationship model and guardian-access helpers:

- Guardian visibility requires `AthleteGuardianRelationship` linkage.
- Multiple guardian support is present.
- Athlete visibility is denied for unrelated guardians.
- Emergency contact support exists via `GuardianRelationshipRole.EMERGENCY_CONTACT`.
- Household relationships remain relationship-graph based (no separate household entity in this phase).

### 2) Lifecycle Validation

`MemberLifecycleStatus` supports required states:

- Prospect
- Applicant
- Active Member
- Inactive Member
- Alumni
- Former Member

### 3) Qualification Validation

Validation covers qualification/certification/eligibility foundations for:

- assignment
- expiration handling
- eligibility summary derivation
- visibility in member detail and readiness contexts

### 4) Staffing Validation

Validation covers staffing foundation coverage for:

- coach assignments
- volunteer assignments
- board assignments
- admin assignments

### 5) Permission Validation

Validation enforces role boundaries:

- Athletes cannot access MemberOps/admin mutation actions.
- Guardians cannot access unrelated athletes.
- Coaches are constrained to scoped staff actions.
- Program Admins are configured for program-scoped administration.
- Organization Admins retain organization-wide administration.

### 6) Dashboard Validation

Validation reviews dashboard/member surfaces for role relevance:

- Athletes and guardians remain excluded from staff-only MemberOps module navigation.
- Staff roles retain MemberOps views aligned to scope.
- Qualification/staffing/household indicators remain within staff-led operational surfaces.

## MemberOps RC1 Readiness Report

| RC1 Area | Status | Notes |
| --- | --- | --- |
| Role visibility and boundary controls | ✅ Ready | MemberOps and action maps enforce staff-only mutation boundaries for non-staff personas. |
| Household relationship validation | ✅ Ready | Guardian linkage and cross-guardian visibility boundaries validated. |
| Lifecycle workflow validation | ✅ Ready | Required lifecycle states are present and covered in domain logic/tests. |
| Qualification and eligibility workflows | ✅ Ready | Qualification/certification/eligibility models and helper logic validated. |
| Staffing assignment workflows | ✅ Ready | Staffing foundations and seeded role coverage validated. |
| Role-focused validation coverage | ✅ Ready | Focused Arc 26E tests added for role matrix and permission expectations. |
| Known non-blocking constraints | ⚠️ Not expanded by design | Volunteer and GearOps Admin are staffing constructs, not standalone auth personas in current RC1 model. |

## Manual Validation Checklist (MEM-ROLE-001 through MEM-ROLE-050)

- [ ] MEM-ROLE-001 Athlete cannot open MemberOps navigation group.
- [ ] MEM-ROLE-002 Athlete cannot create members.
- [ ] MEM-ROLE-003 Athlete cannot edit members.
- [ ] MEM-ROLE-004 Athlete cannot assign roles.
- [ ] MEM-ROLE-005 Athlete cannot approve bookings.
- [ ] MEM-ROLE-006 Guardian sees linked athlete in household context.
- [ ] MEM-ROLE-007 Guardian cannot see unrelated athlete.
- [ ] MEM-ROLE-008 Guardian cannot create household relationship links.
- [ ] MEM-ROLE-009 Guardian cannot manage member lifecycle states.
- [ ] MEM-ROLE-010 Guardian cannot manage staffing.
- [ ] MEM-ROLE-011 Volunteer assignment appears in staffing views.
- [ ] MEM-ROLE-012 Volunteer does not gain admin rights without staff persona.
- [ ] MEM-ROLE-013 Coach sees assigned/team-scoped members.
- [ ] MEM-ROLE-014 Coach can perform scoped roster assignment.
- [ ] MEM-ROLE-015 Coach cannot perform organization-wide program creation.
- [ ] MEM-ROLE-016 Coach can manage scoped qualification assignment.
- [ ] MEM-ROLE-017 Coach cannot approve booking decisions.
- [ ] MEM-ROLE-018 GearOps staffing role appears in staffing role inventory.
- [ ] MEM-ROLE-019 GearOps staffing assignment does not bypass MemberOps auth scope.
- [ ] MEM-ROLE-020 Program Admin sees program-scoped MemberOps records.
- [ ] MEM-ROLE-021 Program Admin can create and update scoped members.
- [ ] MEM-ROLE-022 Program Admin can manage guardian relationships in scope.
- [ ] MEM-ROLE-023 Program Admin can manage qualification definitions.
- [ ] MEM-ROLE-024 Program Admin can manage staffing assignments in scope.
- [ ] MEM-ROLE-025 Program Admin can approve and deny bookings.
- [ ] MEM-ROLE-026 Organization Admin sees org-wide MemberOps records.
- [ ] MEM-ROLE-027 Organization Admin can create members.
- [ ] MEM-ROLE-028 Organization Admin can edit members.
- [ ] MEM-ROLE-029 Organization Admin can assign staffing/roles.
- [ ] MEM-ROLE-030 Organization Admin can manage households.
- [ ] MEM-ROLE-031 Lifecycle Prospect state is selectable and persists.
- [ ] MEM-ROLE-032 Lifecycle Applicant state is selectable and persists.
- [ ] MEM-ROLE-033 Lifecycle Active Member state is selectable and persists.
- [ ] MEM-ROLE-034 Lifecycle Inactive Member state is selectable and persists.
- [ ] MEM-ROLE-035 Lifecycle Alumni state is selectable and persists.
- [ ] MEM-ROLE-036 Lifecycle Former Member state is selectable and persists.
- [ ] MEM-ROLE-037 Qualification assignment appears on member detail.
- [ ] MEM-ROLE-038 Qualification expiration state updates correctly.
- [ ] MEM-ROLE-039 Certification assignment appears on member detail.
- [ ] MEM-ROLE-040 Eligibility summary reflects current qualification/certification state.
- [ ] MEM-ROLE-041 Coach assignment appears on member staffing timeline.
- [ ] MEM-ROLE-042 Volunteer assignment appears on member staffing timeline.
- [ ] MEM-ROLE-043 Board assignment appears on member staffing timeline.
- [ ] MEM-ROLE-044 Program Admin staffing assignment appears on member staffing timeline.
- [ ] MEM-ROLE-045 Organization Admin staffing assignment appears on member staffing timeline.
- [ ] MEM-ROLE-046 Dashboard member views align with role scope.
- [ ] MEM-ROLE-047 Dashboard household views align with role scope.
- [ ] MEM-ROLE-048 Dashboard qualification views align with role scope.
- [ ] MEM-ROLE-049 Dashboard staffing views align with role scope.
- [ ] MEM-ROLE-050 Audit/history records capture role-relevant MemberOps changes.
