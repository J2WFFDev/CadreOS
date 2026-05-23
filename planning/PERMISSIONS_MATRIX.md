# Permissions Matrix and Visibility Boundaries

CadreOS relies on role-aware authorization plus relationship-aware visibility boundaries.

## Baseline action examples

| Action | Admin | Program Director | Coach | Parent/Guardian | Athlete |
| --- | --- | --- | --- | --- | --- |
| Create team | Yes | Yes (scoped) | No | No | No |
| View athlete notes | Yes | Yes (scoped) | Team only | Own linked athlete only, limited | Own only, limited |
| Create attendance | Yes | Yes (scoped) | Team only | No | No |
| RSVP to event | Yes | Yes (scoped) | Yes (scoped) | Own linked athlete only | Self |
| Assign task | Yes | Yes (scoped) | Team only | No | No |

## Decided access model rules

- A `Person` can hold multiple `RoleAssignment` records simultaneously.
- Roles are assignments, not fixed identities.
- Access is determined by **Person + RoleAssignment + Scope**.
- A person may simultaneously hold staff roles and a parent/guardian role.
- Parent/guardian access remains relationship-scoped and must not automatically inherit staff access or team-wide access.
- Parent/guardian-linked users must not see `STAFF_ONLY` notes by default.

## Phase 7E visibility clarification

- Guardian relationship indicators shown in team/person roster views are **staff-facing diagnostics** for coach/admin workflows.
- These indicators do **not** grant data access to guardian users.
- Relationship visibility can be intentionally limited by context (for example, non-athlete roster rows).
- Athlete-facing assumptions and guardian-facing assumptions are separate:
  - Athlete view assumptions are based on self-access and role/scope.
  - Guardian view assumptions require `AthleteGuardianRelationship` linkage plus explicit visibility policy.
- Guardian onboarding/invitation and messaging workflows remain deferred and out of scope.

## Phase 8A guardrail clarification

- Guardian relationship details are visible only to staff-role viewers (`ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, `COACH`, `ASSISTANT_COACH`).
- Non-staff viewers should not see private guardian linkage diagnostics.
- Linkage-adjacent edits remain limited to existing authorized write routes (person, roster, role assignment) and are not a dedicated guardian-management runtime.
- Operational status indicators should remain diagnostic-only:
  - linked guardian
  - missing guardian
  - inactive guardian account signal
  - pending/incomplete relationship support
