# Current Decisions

This file consolidates active decisions and points back to their source docs.
When it conflicts with a newer explicit decision, update this file.

## Product And Module Naming

- CadreOS is an Athlete Program Operating System.
- Sidebar/module taxonomy uses Home, MemberOps, EntryOps,
  FieldOps/ResourceOps, GearOps, and AdminOps/Admin.
- MemberOps is the selected name, not TeamOps or PeopleOps.
- EntryOps remains the active name and is feed/filter/context-first; SignalOps
  is only a possible future name.
- FieldOps and ResourceOps are conceptually separate, although current
  `/field-ops` routes still contain ResourceOps infrastructure.
- GearOps remains its own module.
- Programs and Seasons belong under MemberOps, not AdminOps.

Source: [`CURRENT_PRODUCT_DECISIONS.md`](../product/CURRENT_PRODUCT_DECISIONS.md).

## Navigation And Experience

- The approved sidebar taxonomy and order must not be changed incidentally.
- Navigation visibility is separate from action permission.
- Account/Profile should move toward top-right header ownership.
- Build/release identity must be visible in screenshots.
- Admin/operator visibility is a permanent first-class mode; guided/field
  experiences are additive.
- Product experience should be Today-first and role-filtered while remaining
  module-backed.

Sources: [`Sidebar Taxonomy`](../navigation/sidebar-taxonomy.md),
[`CURRENT_PRODUCT_DECISIONS.md`](../product/CURRENT_PRODUCT_DECISIONS.md), and
[`UI/UX Decision Log`](../product/design-system/ui-ux-decision-log.md).

## Roles, Visibility, And Archive Behavior

- Guardian access is relationship-scoped; unrelated athlete/member data must
  remain denied.
- Navigation exposure does not grant mutation rights.
- Entry owners can self-edit within bounded policy, while conversion,
  reassignment, ownership changes, cross-person assignment, and scope changes
  remain elevated actions.
- Generic Entry archive/restore rights and normalized restore behavior are not
  fully decided. This remains an open decision, not an implied permission.

Sources: [`Arc 24D.8X-N`](../planning/arc-24d-8x-n-owner-assignee-lifecycle-controls.md)
and [`Arc 26E`](../../planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md).

## Platform Direction

- Desktop web precedes mobile web, optional PWA, and future offline-capable
  mobile app.
- Offline capability is bounded to suitable field capture, not full offline
  administration.
- Append-only operational events are preferred for future sync-safe workflows.
- Shared status language should be reused across modules.

Source: [`UI/UX Decision Log`](../product/design-system/ui-ux-decision-log.md).
