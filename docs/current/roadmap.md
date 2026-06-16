# Current Roadmap

## Current Build State

CadreOS has an implemented operational foundation spanning organization,
programs, seasons, teams, people, roles, events, attendance, EntryOps,
FieldOps/ResourceOps, GearOps, reporting/review foundations, and role-aware
access. Recent repository work includes actor-scoped Inbox, All Entries,
personal and Guardian-visible Lists, Quick Capture, habits, Guardian-derived
context, Journal workflow/access improvements, and app-shell usability work.
Historical Arc 24D/25/26 labels remain useful references, while new work uses
the simplified `ARC-[DOMAIN]-[NN] — Title` naming scheme.

This summary is intentionally conservative. Detailed capability status should
be verified against the linked arc documents and current code before scope is
committed.

## Completed Major Arcs

- Operational Foundation/Core MVP and FieldOps MVP are documented as closed.
- GearOps MVP is documented as closed, with later GearOps audit, readiness, and
  role-validation work also delivered.
- Arc 21 MemberOps/Roster Lifecycle is marked complete in the planning index.
- Arc 22A-22G Entry Completion is marked complete.
- Arc 23A-23E and 23I Journals, Habits, visibility, and Entry consolidation are
  marked complete.
- Arc 24D.10.4 Entry Type Consistency, 24D.11 EntryOps Navigation, and 24D.12
  Role Experience/Permission Alignment are marked complete.
- Arc 24D.8Q-C All Entries, Guardian Lists, and movement validation is complete.
  It established actor-scoped Inbox, All Entries oversight, related Athlete
  list visibility for Guardians, and role-safe list movement boundaries.
- Arc 24D.8Q-D Guardian grouping, context labels, destinations, and active
  Habits is complete.
- Arc 24D.8R Journal workflow/access UX is complete, including Final/Done
  Guardian-visible Journal access and bounded reopen behavior.
- Arc 24D.8U Creator/Owner/Author/Assignee terminology cleanup is complete,
  separating system history, Journal author context, responsibility,
  organization, and access language without behavior changes.
- Arc 24D.8S EntryOps lifecycle cleanup is complete, normalizing non-archived
  working views and generic Entry archive/restore while preserving existing
  permissions and Journal/Habit policy.
- ARC-HABIT-01 — Habit Management Foundation (historical: Arc 24D.8T) is complete,
  clarifying the separate Habit definition/check-in model, active and archived
  management behavior, direct creation, detail/history, and All Entries
  lifecycle alignment.
- ARC-HABIT-02 — Habit Terminology, Ownership, and Lifecycle Cleanup
  (historical: Arc 24D.8T-A) is complete, establishing My Habits, Athlete
  self-service assignment limits, simplified lifecycle presentation, and
  controlled tracking units.
- ARC-HABIT-03 — My Habits Scope and Guardian Summary (historical: Arc 24D.8T-B) is
  complete, establishing actor-subject My Habits scope, Coach/Admin
  self-creation, and relationship-derived Guardian summary visibility.
- ARC-UI-01 — Header Account Name Display (historical: UI.0-A) and
  ARC-UI-02 — Collapsible Sidebar and Independent Scrolling (historical: UI.1)
  are complete.
- ARC-ENTRY-07 — Relationship Labels and Direction Semantics is complete. It
  normalized Guardian-derived user-facing language to related athlete /
  Guardian relationship wording, clarified Journal Guardian visibility copy,
  and preserved permissions, roles, auth, schema, routes, lifecycle,
  archive/restore, Journal privacy, Habit behavior, and Dev Persona behavior.
- The GearOps CSV `asset_id` baseline fix is complete.

See [`arc-log.md`](./arc-log.md) for conflicts and detailed links.

## Current / Next Arc Area

No active product arc is currently committed in `docs/current/`.

The next product decision point requires product-owner confirmation. Candidate
areas should be selected from documented unresolved or future work without
promoting any one option to committed scope here.

## Future Roadmap

- Continue EntryOps coherence work: lifecycle policy, relationships,
  terminology, Journal/Habit integration, and role-safe visibility.
- Habit team recurrence/fan-out, compliance dashboards, and advanced streak
  analytics remain future work requiring explicit product and access policy.
- Habit Library is a future template catalog. It may provide known templates
  that users can add to My Habits and that authorized staff can assign.
- Habit Context/List placement remains future work. The current
  `assignedToTeamId` assignment field is not Context/List, and future
  Program/Team placement must not imply visibility, assignment, or fan-out.
- A mature Habit lifecycle concept for achieved routines or goals remains
  future work; Active, Paused, and Archived remain the current user-facing
  lifecycle.
- Treat additional Today redesign/integration as future roadmap work; current
  EntryOps/List work must not imply generated Habit check-in Entries or a new
  Today model.
- Reconcile MemberOps RC1 capability audits with later Arc 26 validation docs.
- Continue operational reporting/review only where role-safe scope and source
  data are reliable.
- Keep communications delivery, AI/automation, and broad cross-module
  orchestration gated behind explicit product decisions.
- Use GearOps as a design-system and field-workflow proving ground without
  treating every deferred platform capability as GearOps-owned.

## Release 2 / Deferred

- Full communications delivery, messaging, reminders, and external channels.
- AI recommendations and autonomous workflow automation.
- Full native mobile app and full offline sync/replication.
- Advanced GearOps procurement/accounting, predictive maintenance, enterprise
  rules/schema engines, and enterprise BI/warehouse analytics.
- Full guardian approval workflow UX and approval audit capture.
- Bulk import and other high-risk mass mutation tooling.

## Historical Roadmap References

Old Arc 24D/25/26 and UI labels remain valid historical references in these
documents. See [`arc-log.md`](./arc-log.md) for the recent old-to-new
crosswalk.

- [`planning/README.md`](../../planning/README.md)
- [`planning/ROADMAP.md`](../../planning/ROADMAP.md)
- [`planning/ROADMAP_POST_GEAROPS_DECISION.md`](../../planning/ROADMAP_POST_GEAROPS_DECISION.md)
- [`planning/ROADMAP_DEFERRED_GEAROPS_CAPABILITIES.md`](../../planning/ROADMAP_DEFERRED_GEAROPS_CAPABILITIES.md)
- [`planning/ROADMAP_CORE_FIELDOPS_GEAROPS.md`](../../planning/ROADMAP_CORE_FIELDOPS_GEAROPS.md)
- [`docs/future/`](../future/)
