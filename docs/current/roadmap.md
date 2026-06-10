# Current Roadmap

## Current Build State

CadreOS has an implemented operational foundation spanning organization,
programs, seasons, teams, people, roles, events, attendance, EntryOps,
FieldOps/ResourceOps, GearOps, reporting/review foundations, and role-aware
access. Recent repository work is concentrated in the Arc 24D EntryOps family,
including actor-scoped Inbox, All Entries, personal and Guardian-visible Lists,
Quick Capture, habits, Guardian-derived context, and Journal workflow/access
improvements.

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
  It established actor-scoped Inbox, All Entries oversight, Guardian-linked
  Athlete list visibility, and role-safe list movement boundaries.
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
- The GearOps CSV `asset_id` baseline fix and UI.1 collapsible
  sidebar/independent scrolling work are complete.

See [`arc-log.md`](./arc-log.md) for conflicts and detailed links.

## Active / Next Arc Area

The latest merged EntryOps implementation work on `main` includes Arc
24D.8Q-C, Arc 24D.8Q-D, and Arc 24D.8R. The latest merged cross-module work
also fixes the GearOps CSV `asset_id` baseline and completes UI.1 collapsible
sidebar and independent content/sidebar scrolling.

The next EntryOps slice after Arc 24D.8S is **needs product-owner
confirmation**. Current candidates include:

- Arc 24D.9B: normalize relationship labels and direction semantics.

## Future Roadmap

- Continue EntryOps coherence work: lifecycle policy, relationships,
  terminology, Journal/Habit integration, and role-safe visibility.
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

- [`planning/README.md`](../../planning/README.md)
- [`planning/ROADMAP.md`](../../planning/ROADMAP.md)
- [`planning/ROADMAP_POST_GEAROPS_DECISION.md`](../../planning/ROADMAP_POST_GEAROPS_DECISION.md)
- [`planning/ROADMAP_DEFERRED_GEAROPS_CAPABILITIES.md`](../../planning/ROADMAP_DEFERRED_GEAROPS_CAPABILITIES.md)
- [`planning/ROADMAP_CORE_FIELDOPS_GEAROPS.md`](../../planning/ROADMAP_CORE_FIELDOPS_GEAROPS.md)
- [`docs/future/`](../future/)
