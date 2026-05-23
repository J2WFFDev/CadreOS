# Phase 7E — Guardian Relationship Visibility and Roadmap Realignment

## Goal

Improve coach/admin clarity for guardian relationship visibility in existing team/person roster surfaces and remove roadmap ambiguity between active Team/Member phases and future Entry/Inbox work.

## Scope guardrails

- No FieldOps expansion.
- No communications/messaging/notifications.
- No payments, fundraising, sponsorship, or mobile-native behavior.
- No guardian onboarding/invitation workflows.
- No unified Entry schema implementation.
- No major dependency additions.
- Preserve organization-scoped data access and existing auth patterns.

## Runtime output

### Team detail (`/teams/[teamId]`)
- Added athlete-row guardian relationship diagnostics:
  - linked guardian relationship detected
  - missing guardian relationship
  - guardian relationship exists but linked guardian account is missing
  - intentionally limited visibility for non-athlete rows
- Added season summary signal for athlete rows with guardian account-link gaps.
- Added staff-only boundary copy explaining these are diagnostics, not guardian access grants.

### Person detail (`/people/[personId]`)
- Added athlete-profile relationship status summary:
  - missing guardian relationship
  - relationship exists with account-link gap
  - relationship exists with linked guardian account
- Added per-relationship guardian account-link status labels.
- Added explicit deferred-scope notes for onboarding/invitation and relationship management workflows.

## Authorization/visibility clarification output

- Updated permissions documentation to clearly separate:
  - staff-only visibility boundaries
  - guardian relationship-scoped visibility assumptions
  - athlete vs guardian access assumptions
- Reinforced that guardian relationship indicators are staff-facing diagnostics only.

## Roadmap realignment output

- Added explicit active-vs-deferred track clarification in roadmap docs:
  - active: Team/Member hardening phases
  - deferred: Entry/Inbox/Journal migration track
- Relabeled future Entry/Inbox phase sequence to `Entry Track Ex` naming in planning docs to avoid confusion with active Phase 7B/7C/7D/7E team/member work.
- Clarified that current implemented workflows remain `ObservationNote` + `FollowUpTask`, while unified Entry migration remains deferred.
- Kept Feed/Journal/Messaging concepts explicitly deferred.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Deferred future scope (unchanged)

- Guardian onboarding/invitation flows
- Direct guardian-editing workflows
- Guardian messaging/portals
- Unified Entry runtime migration
- Feed/Journal/messaging runtime surfaces
