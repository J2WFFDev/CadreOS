# Current Roadmap

## Current Build State

CadreOS has an implemented operational foundation spanning organization,
programs, seasons, teams, people, roles, events, attendance, EntryOps,
FieldOps/ResourceOps, GearOps, reporting/review foundations, and role-aware
access. Recent repository work is concentrated in the Arc 24D EntryOps family,
including visibility, personal Inbox/Lists, habits, guardian context, and
Journal workflow/access improvements.

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

See [`arc-log.md`](./arc-log.md) for conflicts and detailed links.

## Active / Next Arc Area

The latest merged implementation work on `main` as of June 9, 2026 is in the
Arc 24D EntryOps/Journal/visibility family. Several documents recommend
different next slices:

- Arc 24D.8X-P: shared List hierarchy and scoped list visibility.
- Arc 24D.9B: normalize relationship labels and direction semantics.
- Recent merged work continues Arc 24D.8Q/8R guardian context and Journal flows.

The single active next arc is **needs product-owner confirmation**.

## Future Roadmap

- Continue EntryOps coherence work: lifecycle policy, Lists, relationships,
  Journal/Habit integration, and role-safe visibility.
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
