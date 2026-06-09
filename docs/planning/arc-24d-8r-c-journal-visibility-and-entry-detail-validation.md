# Arc 24D.8R-C Journal Visibility And Entry Detail Validation

## Root Causes

- All Work Items explicitly filtered out `EntryType.JOURNAL`, so actor-owned
  Journals could appear in Inbox or a List but never in All Work Items.
- Generic EntryOps visibility loaded `AthleteGuardianRelationship` records only
  when the actor also had a direct `PARENT_GUARDIAN` RoleAssignment. Journal
  policy correctly used the relationship itself, so generic EntryOps routes and
  Journal routes disagreed for relationship-derived Guardians.
- Entry detail rendered body text twice: once in a read-only Details card and
  again in the editable body field. The right-side metadata panel was also
  labeled Details.
- Entry detail had Status and List editing but no role-authorized reassignment
  or generic visibility controls.

## Privacy Boundaries

- Guardian Journal access still requires a linked dependent author, Final/Done
  workflow state, and Guardian visibility (`ORGANIZATION_SCOPED`).
- Draft/Open, unrelated, Staff-only, and Team-staff Journals remain hidden from
  Guardians.
- Coach, Program, and Team visibility are unchanged.
- No Guardian RoleAssignment records are created.

## Manual Validation Checklist

- JRN-C-001: Athlete creates Journal.
- JRN-C-002: Athlete sees Journal in Inbox.
- JRN-C-003: Athlete sees Journal in its selected personal list.
- JRN-C-004: Athlete sees Journal in All Work Items.
- JRN-C-005: Guardian does not see Draft/Open Journal.
- JRN-C-006: Guardian sees linked dependent Guardian-visible Final/Done Journal.
- JRN-C-007: Guardian direct links open eligible Journal from `/journals/:id` and `/entries/:id`.
- JRN-C-008: Guardian cannot see unrelated member Journal.
- JRN-C-009: Org Admin behavior remains unchanged.
- JRN-C-010: Reopen returns to Journal detail.
- JRN-C-011: Reopened Journal becomes Draft/Open and is hidden from Guardian.
- JRN-C-012: Quick Capture title remains separate from Details/body.
- JRN-C-013: Entry detail/edit shows one editable Details/body field.
- JRN-C-014: Right-side metadata panel is labeled Entry Metadata.
- JRN-C-015: Quick Capture has no Assign field.
- JRN-C-016: Role-authorized editor can reassign on Entry detail.
- JRN-C-017: Authorized Status, List, and Visibility controls are available on Entry detail.
- JRN-C-018: `/prompts` shows New Journal Entry for actors allowed to create Journals.
- JRN-C-019: New Journal Entry creates a Journal, not a Task.
- JRN-C-020: No Dev Persona behavior is introduced.
- JRN-C-021: No fake Guardian roles are created.
