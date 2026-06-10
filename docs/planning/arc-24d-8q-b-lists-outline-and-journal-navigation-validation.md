# Arc 24D.8Q-B Lists Outline And Journal Navigation Validation

## Implementation Summary

- EntryOps sidebar now links to `Inbox`, `Lists`, `All Work Items`, `Habits`,
  and `Journals` in that order.
- `Journals` opens `/journals`; Journal Prompts remains reachable from the
  Journals page and existing `/prompts` functionality is unchanged.
- `/lists` renders `Org`, `Personal`, and authorized `Admin` sections in that
  order.
- Program and Team outline rows link to their existing protected context
  routes. Existing scoped custom lists remain available as links without empty
  folder messaging.
- Personal defaults are lazily ensured using the existing EntryList model:
  Inbox, Outbox, Knowledge, Practice, and Skills.
- Inbox remains backed by the existing inbox-routing working view at
  `/lists/inbox`, so entries can remain findable after assignment to another
  personal list.
- Inbox is protected from rename/archive through list detail, edit page, and
  update action guards.
- Authorized organization admins receive FieldOps, GearOps, and ResourceOps
  shared lists. Unauthorized users do not receive organization shared lists.
- Normal `/lists` visibility no longer includes unrelated users' personal lists
  for organization admins.

## Security Boundaries

- Navigation does not grant route access.
- Program/Team context visibility does not grant Entry visibility.
- List detail continues intersecting list access with the existing type-aware
  EntryOps visibility predicate.
- Guardian Journal visibility remains linked-dependent + Final/Done +
  Guardian-visible only. Draft/Open, Private, and unrelated Journals remain
  hidden.
- No fake Guardian roles, Dev Personas, schema changes, or dependency changes.

## Manual Validation Checklist

- LIST-B-001: EntryOps sidebar shows Journals.
- LIST-B-002: Journals opens `/journals`.
- LIST-B-003: `/journals` includes New Journal Entry.
- LIST-B-004: Journal Prompts remains reachable from `/journals`.
- LIST-B-005: Lists page shows Org, Personal, Admin in order.
- LIST-B-006: Org shows allowed Program/Team context.
- LIST-B-007: Program row opens its protected Program route.
- LIST-B-008: Team row opens its protected Team route.
- LIST-B-009: Program/Team rows do not show empty-folder messaging.
- LIST-B-010: Personal shows Inbox first.
- LIST-B-011: Inbox cannot be edited or removed.
- LIST-B-012: Sidebar Inbox opens `/lists/inbox`.
- LIST-B-013: Personal includes Outbox, Knowledge, Practice, Skills.
- LIST-B-014: User-created personal lists appear after defaults.
- LIST-B-015: Org Admin `/lists` excludes unrelated personal lists.
- LIST-B-016: Authorized Admin shows FieldOps, GearOps, ResourceOps.
- LIST-B-017: Guardian sees only allowed dependent context/items.
- LIST-B-018: Guardian does not see unrelated athlete items.
- LIST-B-019: Guardian does not see Draft/Open or Private Journals.
- LIST-B-020: Program/Team context does not grant Entry visibility.
- LIST-B-021: Direct URL route protection remains unchanged.
- LIST-B-022: No Dev Persona behavior is introduced.
