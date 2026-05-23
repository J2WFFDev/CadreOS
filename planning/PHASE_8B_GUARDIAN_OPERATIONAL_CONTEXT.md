# Phase 8B — Guardian-Aware Operational Context (Team/Member + Notes/Tasks)

## Goal

Improve guardian-aware operational context across Team/Member, Notes, and FollowUpTask workflows using existing models and authorization guardrails.

## Scope guardrails (enforced)

- No messaging/chat/DM/notifications/Feed/Journal behavior.
- No parent portal runtime.
- No guardian onboarding or invitation workflows.
- No attendance approval or consent workflow implementation.
- No unified Entry model implementation.
- No ObservationNote/FollowUpTask migration into Entry.
- No FieldOps runtime expansion.
- No full Person schema redesign.
- No new major dependencies.
- Preserve organization scoping and existing auth/data-access patterns.

## Runtime model review references

- `Person` remains the shared identity model for athletes, guardians, and staff.
- `AthleteGuardianRelationship` remains the relationship source of truth.
- `ObservationNote` remains the current note runtime model.
- `FollowUpTask` remains the current operational action model.
- Team roster/detail workflows remain season-scoped and org-scoped.

## Phase 8B runtime output summary

- Added reusable guardian operational-context derivation for:
  - guardian-linked athlete
  - no guardian on file
  - inactive guardian account signal
  - incomplete guardian relationship support
- Extended Team roster operational filtering with low-risk staff-facing guardian filters:
  - athletes missing guardian linkage
  - inactive guardian account signal
  - pending/incomplete support
- Extended Notes list/detail with staff-gated guardian-context indicators and filter options.
- Extended Tasks list/detail/new with staff-gated guardian follow-up dependency context linked to source-note athlete relationship state.
- Improved relationship visibility between note/task/athlete/guardian-state without adding guardian-facing communication features.

## Operational assumptions

- Guardian relationship diagnostics are operational aids for staff decision-making, not access grants.
- Relationship linkage does not imply communication permission.
- Missing guardian linkage can block or delay guardian-dependent follow-up.
- Inactive guardian account signals indicate operational risk, not permission bypass.

## Privacy and authorization boundaries

- Detailed guardian relationship context remains staff-role-gated.
- Non-staff viewers receive restricted/limited diagnostic output to reduce private relationship data leakage risk.
- All relationship reads remain organization-scoped.

## Deferred future scope (explicit)

- Consent capture, approval, and revocation workflows.
- Guardian onboarding/invitation lifecycle.
- Messaging/notification delivery channels.
- Parent/guardian portal runtime.
- Entry/Inbox/Feed migration and unified Entry workflow runtime.

## Validation checklist applied in Phase 8B

- Typecheck/build/lint and Prisma validate run.
- Organization scoping preserved for new relationship-context reads/filters.
- Team/Note/Task workflows remain on existing runtime models.
- No guardian messaging/portal/onboarding behavior introduced.
- No Entry migration or FieldOps behavior changes introduced.
