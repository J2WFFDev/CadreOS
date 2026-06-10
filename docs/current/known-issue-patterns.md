# Known Issue Patterns

These recurring patterns are supported by repository documentation and should
be checked during planning, implementation, and validation.

## Schema Detection And Query Complexity

- Old and new relationship representations can overlap, duplicate display, or
  drift when mirrored writes partially fail.
- Query helpers must apply actor, organization, program/team, ownership,
  assignment, and guardian-derived scope consistently.
- Historical planning can describe models or capabilities that later arcs
  changed; verify current schema/code before relying on an older audit.

Sources: [`Arc 24D.9A`](../planning/arc-24d-9a-entry-relationships-foundation-audit.md)
and [`Arc 24D.8X-F`](../planning/arc-24d-8x-f-entryops-role-visibility-design.md).

## Database Setup Confusion

- Existing databases may need baseline/inventory workflows, while routine
  future changes use committed Prisma migrations.
- Pooled versus direct database URLs and incomplete migration history can
  create misleading setup failures.

Source: [`README.md`](../../README.md).

## Deployment And Build Confusion

- `main` and non-`main` branches have different Vercel deployment behavior.
- Local validation has known warnings that should not be mistaken for new
  failures.
- Build/release identity should remain visible in screenshots.

Sources: [`README.md`](../../README.md),
[`Local Agent Validation Baseline`](../dev/local-agent-validation-baseline.md),
and [`Current Product Decisions`](../product/CURRENT_PRODUCT_DECISIONS.md).

## Role, Permission, And Visibility Validation

- Navigation visibility is not action permission.
- Broad module access must not replace per-record visibility and scoped
  mutation checks.
- Guardian-derived access, self-service owner flows, and staff/admin scope
  frequently require separate policies and tests.
- List/context placement is organization only. It must not be treated as an
  Entry visibility grant, assignment change, or ownership change.
- Guardian-visible linked Athlete list containers do not imply access to every
  Entry in those containers. Journal visibility is narrower still.
- Inbox queries must remain actor-scoped even for organization admins;
  cross-user oversight belongs in All Entries/Admin views.
- Habit definitions, Habit check-ins, and Habit activity are different record
  classes. Do not render check-ins/activity as Entries unless explicitly
  modeled that way.
- Habit `assignedToTeamId` is a legacy assignment field, not Entry Context/List
  placement. Do not describe it as team fan-out or infer a general
  Program/Team context visibility rule from it.
- Creator, Owner, Author, and Assignee are distinct concepts. UI copy that
  calls an Assignee an Owner, calls a Journal Author an Assignee, or presents
  Creator as mutable can imply unsupported policy changes.
- Technical `scope` labels can blur organization with access. Prefer
  Context/List for organization and Visibility for who can see an Entry.
- Completion and archive are separate lifecycle concepts. Default working
  views should exclude archived records without hiding completed non-archived
  records, and explicit archived views must retain existing visibility checks.
- Do not combine archive with soft deletion. Historical generic Entries may
  have both `ARCHIVED` status and `deletedAt`; lifecycle reads and restore must
  account for them without weakening authorization.
- Archive and restore mutations must not rewrite Creator, Author, Assignee,
  Context/List, Visibility, or relationships.

Sources: [`Sidebar Taxonomy`](../navigation/sidebar-taxonomy.md) and
[`Arc 24D.8X-F`](../planning/arc-24d-8x-f-entryops-role-visibility-design.md).

## GearOps Readiness And Operational Truth

- Custody, maintenance, readiness, pending actions, and event requirements can
  make an item appear unavailable or make dashboard counts look unexpected.
- Server-confirmed activity remains authoritative; pending/offline actions can
  explain temporary discrepancies.

Sources: [`GearOps Troubleshooting`](../product/gear-ops/troubleshooting.md) and
[`GearOps Known Limitations`](../product/gear-ops/known-limitations-and-deferred-scope.md).

## Mobile And Offline Limitations

- Mobile web readiness is current direction; full native/offline capability is
  deferred.
- Offline-safe field capture must remain separate from high-conflict admin,
  security, and custody-sensitive actions.

Sources: [`Mobile App Roadmap`](../future/mobile-app-roadmap.md),
[`Offline Sync Roadmap`](../future/offline-sync-roadmap.md), and
[`UI/UX Decision Log`](../product/design-system/ui-ux-decision-log.md).

## Needs Confirmation

- Whether the current MemberOps runtime fully resolves all Arc 24C/26A gaps.
- Whether Arc 24D.9B relationship normalization is the next EntryOps priority
  after Arc 24D.8U terminology cleanup.
