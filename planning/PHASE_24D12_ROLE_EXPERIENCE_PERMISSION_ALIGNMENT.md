# Arc 24D.12 — Role Experience and Permission Alignment

## Scope

This arc validates role visibility, navigation, and permission consistency across:

- Dashboard
- EntryOps
- MemberOps
- GearOps
- FieldOps / ResourceOps
- Feed
- Schedule-oriented views (Today / Upcoming)

Guardrails preserved:

- EntryOps naming remains unchanged.
- No SignalOps activation.
- No WorkOps reintroduction.
- No visual theme redesign.
- No new modules or major feature expansion.

---

## Role Audit Summary

### Athlete
- Keeps access to: assigned work, today/upcoming schedule slices, journals, habits, feed, prompt assignments.
- Staff-only EntryOps surfaces removed from navigation: Inbox, Review, Lists, All, Prompt Library.
- Feed now runs in limited mode for non-staff roles (assigned/schedule/habit activity only).

### Guardian
- Keeps access to: linked-athlete journal/habit visibility, assigned work, today/upcoming schedule slices, feed (limited mode), prompt assignments.
- Staff-only EntryOps surfaces removed from navigation.
- Feed and schedule avoid organization-wide operational exposure for non-staff.

### Coach
- Keeps staff workflow visibility across EntryOps, MemberOps, GearOps, FieldOps/ResourceOps.
- Full workflow navigation remains intact.

### Program Admin (Program Director / PROGRAM_MANAGER app role)
- Keeps broad scoped operations, assignment, review, and program-level management.
- Full staff EntryOps navigation remains intact.

### Organization Admin
- Retains full administration, management, and cross-module visibility.

### Volunteer (if supported)
- Current runtime role equivalent is `LIMITED_VIEWER` (home-only navigation).
- Volunteer flows remain read-constrained and outside staff operational routes.

---

## Navigation Alignment Corrections

Updated EntryOps item-level visibility:

- Staff-only: Inbox, Review, Lists, All, Prompt Library
- Shared with athlete/guardian: My Work, Today, Upcoming, Activity Feed, Habits, Journals, Prompt Assignments

This removes dead-end links for limited roles and aligns visible navigation with practical role capabilities.

---

## Feed / Visibility Alignment

For non-staff self-service roles (Athlete/Guardian):

- Feed runs in limited mode.
- Inbox and quick-capture controls are hidden.
- Entries shown are constrained to assigned-work derived slices (assigned/today/upcoming).
- Habit activity remains role-filtered.

This prevents organization-wide activity leakage while preserving role-relevant awareness.

---

## Empty-State and Limited-Access Messaging

Updated role-aware messaging in:

- `/assigned`
- `/today`
- `/upcoming`
- `/feed`

Limited roles now receive guidance-oriented empty states instead of generic permission dead ends where self-service access is intended.

---

## Arc 24D.12 Role Matrix

| Role | Can View | Can Create | Can Edit | Can Complete | Can Archive | Can Assign | Can Manage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Athlete | Own/assigned EntryOps slices, own role journals/habits, schedule slices, limited feed | Journal/habit content where allowed by policy | Own role-scoped entries/journals/habits where policy allows | Assigned actionable entries/habit check-ins | No | No | No |
| Guardian | Linked-athlete journals/habits, assigned EntryOps slices, schedule slices, limited feed | No staff workflow creation | No staff workflow edit | Assigned actionable entries where visible | No | No | No |
| Coach | Team-scoped EntryOps, MemberOps roster views, GearOps, FieldOps/ResourceOps, feed | Tasks/notes/events/entry workflows (scoped) | Scoped operational records | Scoped actionable work | Scoped lifecycle/archive actions where allowed | Team assignment workflows | Team-level operational management |
| Program Admin | Program-scoped and org-scoped operations across modules | Program operations and scoped staff workflows | Program-scoped operational data | Yes | Yes (scoped) | Yes | Program-level management |
| Organization Admin | Full cross-module visibility | Full | Full | Full | Full | Full | Full organization administration |
| Volunteer (`LIMITED_VIEWER`) | Home group only (dashboard + notifications) | No | No | No | No | No | No |

---

## Regression Protection Targets

Regression validation remains focused on:

- EntryOps
- MemberOps
- GearOps
- Habits
- Journals
- Relationships
- Navigation
- Feed
