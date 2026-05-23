# Phase 7H — Team/Member + Notes/Tasks Operational Hardening Closeout

## Goal

Validate and close out the current Team/Member + Notes/Tasks operational hardening sequence (Phase 7B through 7G) before opening a new product track.

## Scope Guardrails (re-affirmed)

- No unified Entry model implementation.
- No migration of Notes or Tasks into Entry.
- No FieldOps expansion.
- No messaging, notifications, Feed, Journal, chat, payments, fundraising, or mobile-native behavior.
- No new major dependencies.
- Focus remains on validation, documentation, and readiness.

---

## What is implemented now (validated Phase 7B–7G state)

### Team/Member operations

- Team and people surfaces are organization-scoped and include roster/role readability improvements.
- Team detail supports roster add/remove and team role assignment add/remove workflows with permission checks.
- Team roster views expose role assignment gaps and guardian-relationship diagnostics for athlete rows.
- Person detail shows guardian relationship visibility signals and deferred workflow boundaries.

### Notes operations

- `ObservationNote` remains the live note model (no Entry migration).
- Notes support create/list/detail/edit workflows with organization-scoped filtering by team, athlete/person, event, and author.
- Notes retain staff-only visibility and link to related follow-up tasks.

### Tasks operations

- `FollowUpTask` remains the live task model (no Entry migration).
- Tasks support create/list/detail/edit with status, assignee, team-context, and due-window filtering.
- Task detail and related note/event views preserve note↔task and event↔task cross-link visibility.

### Authorization and organization scoping

- Team/roster/role, notes, and tasks write flows enforce existing permission checks.
- Organization scoping is preserved in reads/writes across the hardened Team/Member + Notes/Tasks surfaces.

---

## What was intentionally deferred

- Unified Entry runtime schema and migration work.
- Inbox triage workflows.
- Feed behavior.
- Journal/private diary behavior.
- Messaging/DM/chat behavior.
- Notification systems.
- Parent portal runtime workflows.
- Guardian onboarding/invitation and full guardian relationship management UI.
- FieldOps expansion beyond completed MVP scope.

---

## Known limitations

- Guardian relationship diagnostics are staff-facing indicators, not full guardian workflow tooling.
- Member lifecycle ergonomics remain limited (for example: richer inactive/move/season-rollover flows are not complete).
- Role/roster consistency guardrails are improved but still not full lifecycle automation.
- Notes visibility is currently staff-only and not relationship-routed.
- Task and note workflows are still separate models pending future Entry-track architecture work.
- Reporting remains operational/basic versus full dashboard analytics.

---

## Open product decisions

1. Sequence for deferred Entry-track architecture versus continuing incremental operational polish.
2. Earliest acceptable scope for parent/guardian workflow foundation without exposing staff-only data.
3. Whether attendance/event polish should precede reporting uplift or vice versa.
4. Required MVP evidence threshold for a pause-and-validate cycle before new runtime scope.
5. How to stage any future Entry migration to preserve note/task/event relationship integrity.

---

## Manual validation checklist (Phase 7 closeout)

- [ ] Team roster visibility: verify team list/detail shows roster and role context clearly.
- [ ] Member assignment: add/remove roster membership from team detail and verify success/error feedback.
- [ ] Role assignment: add/remove team-scoped role assignments and verify duplicate guards.
- [ ] Guardian relationship visibility: verify athlete-row guardian status signals and staff-only diagnostic copy.
- [ ] Observation note creation/review: create note, view note detail, confirm staff-only visibility and linked context.
- [ ] Task creation/review/update: create/edit task, verify status/assignee/due behavior and detail readability.
- [ ] Notes-to-task relationships: create task from note and verify bidirectional links (note detail ↔ task detail).
- [ ] Event-to-task relationships: create task from event and verify bidirectional links (event detail ↔ task detail).
- [ ] Organization scoping: verify cross-org records are not readable/selectable in team/note/task flows.
- [ ] Unauthorized access guardrails: verify restricted roles cannot perform protected roster/role/note/task write actions.

---

## Do Not Build Yet

- Entry migration
- Inbox triage
- Feed
- Journal
- Messaging/DM
- notifications
- parent portal
- FieldOps expansion

---

## Recommended next-step decision options

### Option A: Entry/Inbox architecture review

Run a focused architecture/design review for eventual Entry/Inbox migration sequencing, migration safety, and rollout guardrails without runtime implementation.

### Option B: Parent/Guardian workflow foundation

Define a minimal, privacy-safe guardian workflow foundation (relationship management boundaries, access policy, and validation criteria) before any broad guardian-facing UI.

### Option C: Attendance/Event polish

Prioritize operational attendance/event usability and consistency improvements using existing models and organization-scope guardrails.

### Option D: Reporting/dashboard uplift

Improve role-safe operational reporting and dashboard clarity on top of existing team/member/note/task/event data.

### Option E: Pause features and run MVP validation/testing

Pause feature expansion and execute a structured MVP validation cycle to measure workflow clarity, guardrail effectiveness, and readiness before selecting the next build track.

---

## Planning link/index closeout

- Phase 7 sequence should be navigable in order from 7B to 7H in planning index docs.
- This closeout keeps Team/Member + Notes/Tasks hardening complete and decision-ready before any new product track.

---

## PR summary (what was validated, clarified, and recommended)

- Validated that Phase 7B–7G outputs align with current Team/Member + Notes/Tasks runtime behavior and organization-scoped guardrails.
- Clarified implemented scope versus intentionally deferred scope, including explicit non-goals and “Do Not Build Yet” boundaries.
- Added a manual validation checklist and decision-ready next-step options (A–E) to select the next product track intentionally.
