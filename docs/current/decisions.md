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
- All Work Items is named **All Entries**. All Entries is the authorized
  oversight/browse surface and displays each Entry's list/context placement.
- Inbox is always actor-scoped, including for organization admins.
- Quick Capture is actor-scoped and does not provide dependent-Athlete
  assignment. Low-context captures route to the actor's Inbox under current
  routing policy.

Sources: [`Sidebar Taxonomy`](../navigation/sidebar-taxonomy.md),
[`CURRENT_PRODUCT_DECISIONS.md`](../product/CURRENT_PRODUCT_DECISIONS.md), and
[`UI/UX Decision Log`](../product/design-system/ui-ux-decision-log.md).

## Roles, Visibility, And Archive Behavior

- Guardian app visibility is derived from active Guardian relationships;
  unrelated athlete/member data must remain denied.
- Guardians may see linked Athlete personal list context, but list visibility
  does not grant visibility to every Entry in that list.
- Linked Guardians may read Final/Done Guardian-visible dependent Journals.
  Draft, Private, and staff-only Journals remain hidden. Reopen behavior must
  preserve these visibility boundaries.
- Navigation exposure does not grant mutation rights.
- Entry owners can self-edit within bounded policy, while conversion,
  reassignment, ownership changes, cross-person assignment, and scope changes
  remain elevated actions.
- Generic Entry archive/restore rights and normalized restore behavior are not
  fully decided. This remains an open decision, not an implied permission.

Sources: [`Arc 24D.8X-N`](../planning/arc-24d-8x-n-owner-assignee-lifecycle-controls.md)
and [`Arc 26E`](../../planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md).

## Entry Organization, Visibility, And Responsibility

- **Creator** is system history and is shown as **Created by**. Reassignment,
  movement, completion, archive, restore, and reopen do not change Creator.
- **Owner** is the mostly internal record/work-object ownership concept.
  Owner transfer is not implemented, and Owner must not be presented as an
  editable substitute for Creator or Assignee.
- **Author** is Journal-specific writer/subject context. It is not assignment
  or ownership transfer.
- **Assignee** is the person responsible for completing task-like work.
- List/context placement is **organization**.
- Visibility is **sharing**.
- Assignment is **responsibility**.
- Moving an Entry among Personal, Admin, Program, or Team contexts must not
  change its visibility, assignment, creator/owner, or team responsibility.
- Program/Team placement does not grant Entry visibility or assignment.
- Organization-admin cross-user oversight belongs in All Entries/Admin views,
  not in another person's Inbox.
- Program/Team context placement does not share or assign work.

## Habits In EntryOps

- Active Habit definitions or assigned Habit records may appear in All Entries
  when presented as Entry-like work objects.
- Habit check-ins and Habit activity remain activity/history unless explicitly
  modeled as Entries.
- Current All Entries/Habit work does not create generated Habit occurrence
  Entries. Additional Today redesign/integration remains future roadmap work.

## Platform Direction

- Desktop web precedes mobile web, optional PWA, and future offline-capable
  mobile app.
- Offline capability is bounded to suitable field capture, not full offline
  administration.
- Append-only operational events are preferred for future sync-safe workflows.
- Shared status language should be reused across modules.

Source: [`UI/UX Decision Log`](../product/design-system/ui-ux-decision-log.md).
