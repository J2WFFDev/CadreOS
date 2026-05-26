# CadreOS MVP Roadmap (Phase 7A Recenter)

## Purpose

This roadmap re-centers CadreOS after FieldOps MVP completion and identifies the next highest-value MVP slice.

### Phase 7A constraints (planning only)
- No new runtime product features in this phase.
- No Prisma schema changes in this phase.
- FieldOps is treated as completed MVP with future enhancements parked.
- Do not expand into recurring bookings, notifications, calendar sync, GearOps integration, or advanced FieldOps recommendations.

---

## Current Build Snapshot

### Phase 7E clarification: active vs deferred tracks
- **Active implementation track now:** Team/Member Management hardening and usability (Phase 7B–7E).
- **Future deferred track:** Entry/Inbox/Journal architecture and migration work.
- `ObservationNote` and `FollowUpTask` remain the implemented runtime workflows today.
- Unified `Entry` migration is intentionally deferred and remains planning-only.
- Feed/Journal/Messaging runtime implementation remains deferred in the active Team/Member slice; athlete journaling requirements are captured as planning-only scope for a later Entry/Task/Feed arc.

### Built now (active MVP surface)
- Organization/program/team/person records with scoped role assignments.
- Team roster operations (season-scoped) and person profile views.
- Events with RSVP and attendance capture.
- Observation notes and follow-up task workflows.
- FieldOps MVP booking lifecycle (request, precheck/conflicts, approve/deny, dashboard views).
- Dashboard summaries and navigation across implemented modules.

### Built but intentionally limited
- Parent/guardian relationship records are represented and visible in person detail, but relationship-aware guardian workflows are not complete.
- Notes exist as `ObservationNote`; unified inbox/journal/entry model is planning-only.
- Reporting is basic operational summary, not full analytics/dashboarding.

### Not built yet (planned/future)
- Communications/announcements runtime module.
- Athlete development plans/goals/progress workflows.
- Athlete journaling runtime workflows (first-class `JOURNAL` entry type, prompt lifecycle, assignment, and policy-aware feed visibility).
- GearOps equipment lifecycle.
- Advanced reporting/analytics and cross-module intelligence.

---

## Domain-by-Domain MVP Roadmap

| Domain | Current status | User value | Dependency on existing data model | Implementation complexity | MVP risk | Suggested first small PR |
| --- | --- | --- | --- | --- | --- | --- |
| Core organization/team/person model | **Implemented and in active use** (Organization, Program, Team, Person, UserAccount, RoleAssignment). | Establishes secure, scoped operating context for every workflow. | Strong: already backed by current Prisma models and auth/permission helpers. | Medium | Medium | Harden organization context guardrails and add focused planning acceptance checks for person-role-scope consistency. |
| FieldOps | **MVP complete (Phase 6K closeout); expansion paused.** | Provides facility/resource booking with conflict-aware approval flow. | Strong: Facility/Resource/Booking/Conflict models are implemented. | Medium for maintenance; High for next feature expansion | Medium if expanded too early | Planning-only backlog hygiene PR: move recurring/notifications/calendar/recommendations to deferred backlog and keep FieldOps in maintenance mode. |
| Team/member management | **Partially implemented** (team CRUD + roster add flows exist; member lifecycle and richer role workflows are limited). | Direct coach value: keep squads accurate, role ownership clear, and season operations reliable. | Strong: Team, RosterMembership, RoleAssignment, Season already support incremental improvements. | Medium | Low-Medium | Add planning + acceptance criteria for roster/member lifecycle actions (join, move, inactive, season rollover) using existing models only. |
| Parent/guardian relationships | **Partially implemented** (AthleteGuardianRelationship modeled; read visibility constraints documented; full guardian workflow deferred). | High trust/safety value for family-aware operations and controlled visibility. | Strong: AthleteGuardianRelationship + Person/UserAccount link patterns already exist. | Medium | Medium-High (privacy/authorization leakage risk) | Define minimal relationship-management slice boundaries and authorization rules in planning/AC docs without new runtime surfaces. |
| Athlete development | **Planning defined; runtime not implemented** (goals/plans/progress and athlete journaling remain planned). | Long-term program differentiation and athlete progress continuity. | Moderate: Person/Team/Event/Task/guardian relationship foundations exist; dedicated journaling/prompt/version models are still missing. | High | High | Prioritize planning-first athlete journaling roadmap with phased delivery (`JOURNAL` entry type, prompt/task integration, guardian-safe visibility, and version history) before runtime build starts. |
| Attendance/events | **Implemented core workflow** (event CRUD + RSVP + attendance capture). | Core daily operations and participation accountability. | Strong: Event, RSVP, AttendanceRecord are established and used. | Medium | Low-Medium | Document incremental polish backlog for attendance/event reliability (data consistency/reporting UX) without broad scope growth. |
| Task/action tracking | **Implemented core workflow** (FollowUpTask create/list/detail/edit with source links). | Ensures follow-through from coaching and operational work. | Strong: FollowUpTask links into notes/events and person assignments. | Medium | Low | Plan a focused backlog PR for task-state ergonomics and ownership clarity using current schema. |
| Notes/observations/journal entries | **Partially implemented** (`ObservationNote` live; unified Entry/Inbox/Journal is planning-only). | Captures coaching memory and creates downstream action context. | Strong for notes today; moderate for future unified model (requires migration strategy). | Medium-High | Medium | Tighten Phase 7 planning docs to separate “current notes flow” from “future unified entry model” and define migration guardrails. |
| Communications/announcements | **Not implemented** (explicitly future-only concept). | Important for broad coordination, but not required to unlock next MVP value slice. | Weak: no dedicated runtime model/surfaces yet. | High | High | Add a parked concept note defining boundaries and explicit non-goals for MVP to prevent accidental scope creep. |
| GearOps/equipment | **Not implemented** (module is defined but deferred). | Useful for operations that track inventory/custody, but not core to immediate MVP recenter. | Weak: no GearOps runtime schema/workflows yet. | High | Medium-High | Keep GearOps in deferred module roadmap; add dependency notes tied to stable team/member and task foundations. |
| Reporting/dashboarding | **Partially implemented** (dashboard has summary counts and recent-work views). | Gives coaches/operators fast operational awareness. | Moderate: current queryable data exists across people/events/notes/tasks/bookings. | Medium | Medium | Define minimal MVP reporting slice criteria (role-safe summary views, no advanced analytics) and map to existing entities. |

---

## Recommended Next Slice (Phase 7B)

### Phase 7B recommendation: **Team/Member Management Hardening**

### Why this is next
- Best aligns with coach operating system vision by improving the daily “who is on which team and in what role” workflow.
- Delivers clear team-member management value immediately.
- Leverages existing schema (`Team`, `RosterMembership`, `RoleAssignment`, `AthleteGuardianRelationship`) with no large redesign required.
- Can be delivered in small PRs (policy/acceptance criteria first, then narrowly scoped runtime increments in later phases).
- Useful without notifications/mobile app/native messaging.

### Proposed small-PR delivery shape (for later implementation phases)
1. Finalize scope + acceptance criteria for member lifecycle states and season transitions.
2. Add guardrail-focused workflow improvements for roster and role assignment consistency.
3. Add relationship-aware checks where team member visibility touches guardian-linked athletes.

---

## Alternate Phase 7B Options (with trade-offs)

1. **Notes/Observations workflow hardening before Entry migration**
   - **Pros:** Improves daily staff capture quality quickly; low migration risk if staying on `ObservationNote`.
   - **Cons:** Delays team-member lifecycle improvements; may postpone guardian-related complexity validation.

2. **Parent/Guardian relationship management foundation**
   - **Pros:** Addresses high-value trust/authorization complexity directly.
   - **Cons:** Higher privacy/permission risk early; needs careful policy sequencing before broad rollout.

3. **MVP reporting/dashboarding uplift**
   - **Pros:** Immediate cross-role visibility using already-collected data.
   - **Cons:** Dashboard improvements can mask underlying workflow gaps if team/member data quality is not hardened first.

---

## Do Not Build Yet (parked until after Phase 7B maturity)

- FieldOps recurring bookings
- FieldOps notifications/reminders
- FieldOps external calendar sync
- GearOps runtime integration work
- Advanced FieldOps recommendation/optimization logic
- Native messaging/DM/announcement runtime channels
- Large Entry/Inbox schema migration into production runtime

---

## Build Order After Recenter (planning-level)

1. **Phase 7B:** Team/Member Management Hardening (recommended)
2. **Phase 7C–7E:** Team/Member follow-on hardening slices, including guardian relationship visibility clarity and authorization boundaries
3. **Phase 7F:** Operational Notes workflow hardening — notes list filtering, visibility labeling, readability improvements, relationship clarity between notes/tasks/events, and documentation separating current `ObservationNote` workflow from future Entry direction
4. **Phase 7G:** FollowUpTask operational clarity — task list/detail readability, lightweight filtering, overdue/blocked visibility, and relationship clarity with notes/events/inbox references while staying on the current task model
5. **Phase 7H:** Team/Member + Notes/Tasks operational hardening closeout — validate implemented behavior, document deferred scope, define manual checklist coverage, and formalize next-track decision options
6. **Later (deferred Entry/Inbox track):** Entry/Inbox schema implementation and migration planning under a separate track label to avoid overlap with Team/Member phase IDs
7. **Deferred athlete development journaling track:** Implement first-class athlete journaling in phases (entry type, prompt workflows, task scheduling, feed visibility controls, and version history) under Entry/Feed readiness gates
8. **Then:** Reporting uplift, then deferred FieldOps/GearOps expansions as separate module tracks

---

## Phase 8A output summary (implemented guardrail slice)

- Parent/guardian workflow foundation is now clarified as an authorization/visibility slice using existing models.
- Team/person guardian diagnostics are explicitly staff-facing and hidden for non-staff viewers.
- Safe operational indicators now distinguish:
  - linked guardian relationship
  - missing guardian relationship
  - inactive guardian account signal (linked user account but missing parent/guardian role assignment)
  - pending/incomplete relationship support
- Existing organization-scoped auth patterns remain intact.

### Still deferred after 8A

- Parent messaging/notifications/announcements.
- Guardian onboarding/invitations and parent portal runtime.
- Consent and attendance approval workflows.
- Unified Entry runtime migration.
- FieldOps expansion.

## Phase 8B output summary (implemented operational context slice)

- Team/Member roster workflows now include additional low-risk staff-facing guardian-context filters for:
  - athletes missing guardian linkage
  - inactive guardian account signals
  - pending/incomplete relationship support
- Notes and FollowUpTask list/detail workflows now surface guardian-aware operational context for athlete-linked records while preserving staff-gated visibility controls.
- Task creation now provides source-note guardian context signals to improve operational follow-up decisions without adding communication features.
- Relationship visibility between ObservationNote, FollowUpTask, athlete/person records, and guardian relationship state is improved using existing models and organization-scoped reads.

### Still deferred after 8B

- Messaging/DM/notification workflows and guardian communication channels.
- Parent/guardian portal runtime and onboarding/invitation flows.
- Consent and attendance approval workflows.
- Entry/Inbox/Feed runtime migration and unified Entry implementation.
- FieldOps runtime expansion.

## Phase 8D output summary (implemented event/attendance operational alignment slice)

- `/events` list now surfaces operational attendance coverage and event-linked note/task visibility with lightweight filters for status, team, attendance coverage, and follow-up-linked context.
- `/events/[eventId]` now surfaces attendance capture/missing indicators, related event-linked notes, and filtered attendance views to improve coach/admin operational readability.
- Attendance-to-person and event-linked note/task relationships are more visible through direct links and per-event operational summaries.
- The current workflow remains operational and coach-focused on existing models (`Event`, `AttendanceRecord`, `ObservationNote`, `FollowUpTask`) with no schema redesign.

### Still deferred after 8D

- Notifications, reminders, messaging/chat, Feed, and Journal behavior.
- Parent portal, consent, and attendance approval workflows.
- Entry/Inbox migration implementation.
- FieldOps expansion.
- Advanced attendance/event analytics and reporting.

## Phase 8E output summary (implemented lightweight coach operational dashboard slice)

- `/dashboard` now consolidates lightweight operational summaries using existing workflows for:
  - upcoming events
  - attendance needing review
  - overdue follow-up tasks
  - recent operational notes
  - athletes missing guardian linkage (staff-gated visibility)
  - roster/assignment gaps
  - pending FieldOps approvals
- Dashboard sections include safe links into existing routes and existing low-risk filters (events/tasks/teams/FieldOps booking views).
- Dashboard empty states were updated for coach/admin operational clarity and immediate next-step navigation.
- Implementation remains organization-scoped and uses existing auth/data access patterns with no schema redesign.

### Still deferred after 8E

- Messaging/chat/notifications/reminders and other communication runtime behavior.
- Parent-facing portal/dashboard behavior.
- Feed/Inbox/Journal runtime behavior and Entry migration implementation.
- FieldOps functional expansion beyond existing approval workflow visibility.
- Advanced BI/reporting infrastructure and predictive analytics.

## Phase 8F output summary (implemented operational workflow continuity slice)

- Event detail workflow now includes clearer continuity between attendance, related notes, related tasks, and follow-up create actions.
- Attendance concern visibility now includes lightweight operational concern signals (missing/late/unexcused absent) and unresolved-item guidance.
- Dashboard attendance-review cards now route to existing event attendance workflow context and event-note context links.
- Note detail now exposes stronger operational continuity signals (follow-up pending status, event attendance link context).
- Task detail now exposes clearer operational context for why a task exists and whether unresolved/guardian-linkage follow-up risk is present.

### Still deferred after 8F

- Messaging/chat/notifications/reminders and communication runtime behavior.
- Parent/guardian portal runtime behavior.
- Feed/Inbox/Journal runtime behavior and Entry migration implementation.
- Workflow automation/orchestration behavior.
- FieldOps functional expansion.
- Advanced reporting/analytics infrastructure.

## Phase 8I output summary (implemented operational history visibility slice)

- Added shared operational history visibility derived from existing task, note, attendance, event, roster membership, and role assignment timestamps.
- `/dashboard` now includes richer recent and unresolved operational history panels with contextual team/event/person links where derivable.
- `/events/[eventId]`, `/teams/[teamId]`, and `/people/[personId]` now expose scoped operational history views to preserve continuity into existing workflows.
- Note/task detail pages now link into related person/team/event history views without introducing Feed, Entry migration, or audit-log redesign.

### Still deferred after 8I

- Feed/Journal/Entry runtime behavior and Entry migration work.
- Messaging/chat/notification/reminder runtime behavior.
- Full audit-event-backed change reconstruction and deletion history.
- Parent-facing workflow/portal behavior.
- Workflow automation/orchestration engines.
- FieldOps expansion and advanced reporting/analytics infrastructure.

---

## PR Summary (directional)

This Phase 7A roadmap update formally marks FieldOps as MVP-complete and shifts immediate priority to Team/Member Management Hardening for Phase 7B. The recommendation emphasizes high day-to-day coach value, parent/guardian-adjacent complexity readiness, and low redesign risk by building on existing models in small PRs. Future module expansion items are explicitly parked to prevent scope creep while keeping a clear, decision-ready backlog.
