# Arc 24D.8Q-C All Entries, Guardian Lists, And Movement Validation

## Implementation Summary

- Normal Inbox is always scoped to the authenticated actor's open
  `InboxRoutingItem` records, including for organization admins.
- The `/entries` route remains unchanged and is now labeled **All Entries**.
- All Entries retains existing role-aware Entry visibility and shows a safe
  List column. Organization-admin oversight can label lists attached to Entries
  already visible in All Entries; other unauthorized list names render as
  `Restricted list`.
- GuardianRelationship-derived visibility includes linked active athletes'
  personal list context and Entries stored in those personal lists.
- Unrelated personal lists and Entries remain hidden.
- List read visibility and list movement destinations are separate policies.
  Guardian-derived personal, Program, and Team context is readable but is not
  writable solely because of the GuardianRelationship.
- Entry movement accepts the actor's personal lists and directly authorized
  Program, Team, and Admin/shared lists. Moving into Program/Team context does
  not grant Entry visibility.

## Journal Privacy Exception

Journals remain Entries, but the existing Journal-specific policy is retained
as an explicit privacy exception. A linked Guardian can read a dependent
Athlete Journal only when it is Final (`DONE`) and Guardian-visible
(`ORGANIZATION_SCOPED`). Draft/Open, Private, and staff-only Journals remain
hidden. Guardian relationship visibility does not grant Journal edit access.

## Habit Model Decision

Current Habit definitions, completions, and check-in activity are separate
`Habit`, `HabitCompletion`, and `HabitActivity` records. They are not added to
All Entries. Legacy/internal `EntryType.HABIT` records remain visible through
the normal Entry query if any exist. Habit check-ins remain activity/history,
not Entries.

## Manual Validation Checklist

- ENTRY-LIST-C-001: Org Admin Inbox shows only the admin's Inbox items.
- ENTRY-LIST-C-002: Org Admin All Entries shows authorized cross-user Entries.
- ENTRY-LIST-C-003: Sidebar and page say All Entries.
- ENTRY-LIST-C-004: All Entries shows a List column.
- ENTRY-LIST-C-005: Athlete sees own Entries in All Entries.
- ENTRY-LIST-C-006: Guardian sees linked Athlete personal lists.
- ENTRY-LIST-C-007: Guardian sees linked Athlete personal Entries.
- ENTRY-LIST-C-008: Guardian does not see unrelated personal lists.
- ENTRY-LIST-C-009: Guardian does not see unrelated Entries.
- ENTRY-LIST-C-010: Entry edit can move to an authorized personal list.
- ENTRY-LIST-C-011: Authorized admin can move to Admin/shared lists.
- ENTRY-LIST-C-012: Directly scoped roles can move to authorized Program/Team lists.
- ENTRY-LIST-C-013: Unauthorized destinations are hidden.
- ENTRY-LIST-C-014: Program/Team placement does not grant Entry visibility.
- ENTRY-LIST-C-015: Habit check-ins remain activity/history, not Entries.
- ENTRY-LIST-C-016: No Dev Persona behavior is introduced.
- ENTRY-LIST-C-017: No fake Guardian roles are created.
