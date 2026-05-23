# Phase 8A — Parent/Guardian Workflow Foundation (Authorization + Visibility)

## Goal

Establish a safe, understandable parent/guardian workflow foundation using the existing relationship and authorization model before any messaging, notification, or Entry/Inbox expansion.

## Scope guardrails

- No messaging/chat/DM/announcements/notifications.
- No parent portal runtime.
- No billing/payments/fundraising.
- No unified Entry model runtime implementation.
- No Notes/Tasks migration into Entry.
- No FieldOps expansion.
- No full Person schema redesign.
- No major dependency additions.
- Preserve organization scoping and existing CadreOS auth/data-access patterns.

## Current runtime model assumptions (reviewed)

### Person
- Parent/guardian identities are represented as `Person` records first.
- Athlete and guardian are both persons and can hold multiple role assignments.

### AthleteGuardianRelationship
- Relationship linkage is modeled explicitly between athlete person and guardian person.
- Relationship type is stored when present (`PARENT` or `GUARDIAN`).

### RoleAssignment
- Staff access is role+scope based and remains the authorization basis for write actions.
- Parent/guardian role assignment is distinct from staff roles and must not inherit staff-wide visibility.

### UserAccount linkage
- `UserAccount` linkage to `Person` is optional and can be incomplete.
- Guardian operational diagnostics should distinguish missing account links from linked-but-incomplete setup.

### Team/roster visibility assumptions
- Team and person surfaces are organization-scoped.
- Guardian linkage diagnostics are staff-facing visibility diagnostics, not guardian-access grants.

## Phase 8A runtime output summary

- Added staff-only guardian relationship visibility guardrails on people/team/person diagnostics.
- Clarified authorized visibility boundaries for guardian linkage details.
- Preserved existing staff write authorization routes for person/roster/role assignment workflows.
- Added safe operational indicators:
  - linked guardian relationship
  - missing guardian relationship
  - inactive guardian account signal (linked user account but missing parent/guardian role assignment)
  - pending/incomplete relationship support signal
- Kept relationship type visibility where available for authorized staff viewers.

## Authorization and visibility clarification

- **Who can view guardian linkage diagnostics:** staff role assignments (Org Admin, Program Director, Coach, Assistant Coach).
- **Who can edit linkage-adjacent records where currently supported:** staff users with existing write permissions on person/roster/role assignment workflows.
- **Who should not see private relationship details:** non-staff viewers; guardian relationship diagnostics are hidden to avoid private relationship leakage.

## Explicit deferred scope (unchanged)

- Parent messaging and communications workflows.
- Guardian onboarding and invitation workflows.
- Attendance approval and consent workflows.
- Parent portal UX/runtime.
- Entry/Inbox runtime migration.
- FieldOps runtime changes.

## Future roadmap direction (post-8A)

1. Add explicit guardian relationship management workflows with policy-first authorization checks.
2. Introduce consent-aware and communication-boundary-aware policies before any parent messaging.
3. Sequence future Entry/Inbox expansion only after guardian privacy boundaries are operationally validated.

## Future concerns

### Privacy
- Guardian linkage and relationship type are sensitive and should remain role-gated.
- Staff diagnostics should avoid exposing unnecessary personal context.

### Youth data visibility
- Youth-linked relationship data should remain minimum-necessary and context-bound.
- Non-staff users should not receive broad guardian relationship visibility.

### Consent handling
- Consent policy/workflow is not implemented yet and must be defined before parent-facing communication features.
- Future consent capture and revocation states should be explicit and auditable.

### Communication boundaries
- Relationship linkage alone must not imply communication permission.
- Future communication channels must enforce explicit role, scope, and consent boundaries.

### Multi-household edge cases
- Multiple guardians across households require conflict-safe visibility and notification rules.
- Future workflows should support split custody/primary contact nuances without leaking household-private details.
