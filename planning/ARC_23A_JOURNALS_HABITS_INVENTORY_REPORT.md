# Arc 23A — Journals & Habits Inventory Report

## Executive Summary

CadreOS does **not** yet have a runtime Journals & Habits implementation. The inventory confirms that foundational schema stubs are present in the Entry layer (`JOURNAL` and `HABIT` as `EntryType` enum values, `taskRecurrenceRule` on `Entry`), and a detailed planning document (`PHASE_21A_ATHLETE_JOURNALING_CAPABILITY_ROADMAP.md`) already exists. No dedicated `JournalEntry`, `JournalPrompt`, `JournalAssignment`, `JournalVersion`, `Habit`, `HabitSchedule`, or `HabitCompletion` models are present in the Prisma schema. No journal or habit routes, pages, components, seed data, or automated tests exist today.

The Entry domain (Arc 22) is the operational capture foundation that Journals & Habits will extend. Privacy and guardian visibility rules are partially defined for the Entry/Note layers but have not been extended to journal-specific sensitivity requirements. Feed rendering labels exist for `JOURNAL` and `HABIT` entry types but no feed filtering or content-safety guards are in place for these types.

Arc 23 can safely proceed to build because:

- The Entry schema stub is in place and non-breaking additions are low-risk.
- The existing privacy architecture (`EntryVisibility`, `AthleteGuardianRelationship`, `resolveGuardianRelationshipAccess`) provides the foundation for journal visibility controls.
- No existing runtime feature depends on `JOURNAL` or `HABIT` entry types.

---

## File Inventory

### Prisma schema — journal/habit-relevant artifacts

**Existing stubs (schema-only, no runtime behavior):**

- `prisma/schema.prisma`
  - `enum EntryType` — includes `JOURNAL` and `HABIT` values (lines 88–101)
  - `model Entry` — includes `taskRecurrenceRule String?` field (line 1092)
  - `enum EntryVisibility` — `STAFF_ONLY`, `TEAM_STAFF`, `ORGANIZATION_SCOPED` (lines 164–168)
  - `enum EntryStatus` — `OPEN`, `IN_PROGRESS`, `DONE`, `CANCELLED`, `ARCHIVED` (lines 170–176)
  - `model AthleteGuardianRelationship` — relationship-scoped guardian record (lines 975–995)
  - `model EntryActivity` — activity/audit stream (lines 1170+)
  - `model EntryStatusHistory` — status transition audit log (lines 1229+)

**Missing (not present anywhere in schema):**

- `JournalEntry` model
- `JournalPrompt` model
- `JournalAssignment` model
- `JournalVersion` model
- `JournalStatus` enum
- `JournalSource` enum
- `Habit` model
- `HabitSchedule` model
- `HabitCompletion` model
- `HabitFrequency` or recurrence enum specific to habits
- Any guardian-visible journal visibility policy field

---

### Lib/service layer

**Journal/habit references:**

- `lib/operational-feed/render.ts`
  - `JOURNAL: "Journal"` and `HABIT: "Habit"` in `ENTRY_TYPE_LABELS` (display labels only, no content safety logic)
- `lib/operational-entry/types.ts`
  - `"JOURNAL"` and `"HABIT"` included in `OPERATIONAL_ENTRY_TYPES` constant
- `lib/entries/types.ts`
  - `"JOURNAL"` and `"HABIT"` included in `ENTRY_TYPES` constant

**Visibility/access helpers (relevant but not journal-specific):**

- `lib/guardian-relationship-access.ts` — `resolveGuardianRelationshipAccess()` gates guardian diagnostic indicators to staff roles
- `lib/guardian-operational-context.ts` — derives guardian operational status indicators for team/notes/tasks
- `lib/operational-entry/authorization.ts` — entry-level authorization helpers
- `lib/operational-entry/service.ts` — entry CRUD operations

**No journal or habit service modules exist.**

---

### App routes and pages

**Journal/habit-specific routes: none.**

**Notes pages referencing deferred journal scope:**

- `app/(dashboard)/notes/page.tsx` — inline comment: "journal entries, and messaging are intentionally not implemented yet"
- `app/(dashboard)/notes/[noteId]/page.tsx` — same inline comment

**Feed/entry surfaces that would serve journals:**

- `app/(dashboard)/feed/page.tsx`
- `app/(dashboard)/today/page.tsx`
- `app/(dashboard)/upcoming/page.tsx`
- `app/(dashboard)/entries/page.tsx`
- `app/(dashboard)/entries/[entryId]/page.tsx`
- `app/(dashboard)/entry-runtime/[entryRuntimeRefId]/page.tsx`

---

### Seed data

- `prisma/seed.mjs` — no `JOURNAL` or `HABIT` entry seed records exist
- No `JournalPrompt`, `JournalAssignment`, or `Habit` seed data exists

---

### Automated tests

- `__tests__/` directory — no journal, habit, prompt, or recurring check-in test files exist
- No tests for `EntryType.JOURNAL` or `EntryType.HABIT` query paths
- No tests for guardian visibility of journal content

---

### Planning documents

**Directly relevant:**

- `planning/PHASE_21A_ATHLETE_JOURNALING_CAPABILITY_ROADMAP.md` — detailed journaling domain planning; now remapped under Arc 23 numbering
- `planning/PHASE_6B_ENTRY_INBOX_FEED_JOURNAL_PLAN.md` — early Entry/Inbox/Feed/Journal architecture sketch
- `planning/PHASE_9D_ENTRY_VISIBILITY_ACCESS_POLICY.md` — visibility policy architecture (Entry-level, not journal-specific)

**Guardian/visibility context:**

- `planning/PHASE_7E_GUARDIAN_RELATIONSHIP_VISIBILITY_AND_ROADMAP_REALIGNMENT.md`
- `planning/PHASE_8A_GUARDIAN_WORKFLOW_FOUNDATION.md`
- `planning/PHASE_8B_GUARDIAN_OPERATIONAL_CONTEXT.md`
- `planning/ARC_21C_GUARDIAN_HOUSEHOLD_READINESS.md`

**Entry foundation:**

- `planning/ARC_22A_ENTRY_COMPLETION_INVENTORY_STABILIZATION_AND_GAP_PLAN.md`
- `planning/ARC_22A_ENTRY_INVENTORY_REPORT.md`
- `planning/PHASE_9A_ENTRY_ARCHITECTURE_REVIEW.md`
- `planning/NOTES_INBOX_ENTRY_MODEL.md`

---

## Existing Recurring / Due-Date Logic

The Entry model includes:

- `dueDate DateTime?` — standard due-date field used by tasks
- `taskRecurrenceRule String?` — JSON string for task recurrence rules (not yet enforced by any runtime logic; stored but not processed)
- No `HabitSchedule`, `HabitFrequency`, or recurrence evaluation service exists

The `FollowUpTask` model does not have recurrence fields; recurrence is only on `Entry.taskRecurrenceRule`.

---

## Existing EntryVisibility Values

Current `EntryVisibility` enum has three values:

| Value | Meaning |
|---|---|
| `STAFF_ONLY` | Visible to staff roles only (default) |
| `TEAM_STAFF` | Visible to team-scoped staff |
| `ORGANIZATION_SCOPED` | Visible to all org-scoped authenticated users |

**Journal-required values missing:**

- `ATHLETE_PRIVATE` — visible only to the authoring athlete and admin
- `GUARDIAN_VISIBLE` — visible to authoring athlete and their linked guardians
- `COACH_VISIBLE` — visible to authoring athlete, assigned coach, and admin

These values are not yet in the schema. Adding them in Arc 23B will be a non-breaking additive schema change.

---

## Existing Feed Activity Actions

`lib/operational-feed/render.ts` maps these action strings for the activity stream. No journal-specific actions are registered:

- `entry.created`, `entry.updated`, `entry.completed`, `entry.archived`, `entry.deleted` — generic actions
- No `journal.draft_created`, `journal.submitted`, `habit.checked_in`, `prompt.assigned` actions exist

---

## Gap Summary

| Area | Current State | Gap for Arc 23 |
|---|---|---|
| Schema: journal models | `JOURNAL` in `EntryType` only | Need `JournalEntry`, `JournalPrompt`, `JournalAssignment`, `JournalVersion`, `JournalStatus`, `JournalSource` |
| Schema: habit models | `HABIT` in `EntryType` only | Need `Habit`, `HabitSchedule`, `HabitCompletion` |
| Schema: visibility values | `STAFF_ONLY`, `TEAM_STAFF`, `ORGANIZATION_SCOPED` | Need `ATHLETE_PRIVATE`, `GUARDIAN_VISIBLE`, `COACH_VISIBLE` |
| Schema: recurrence | `taskRecurrenceRule String?` (unprocessed) | Need recurrence evaluation service and `HabitSchedule` model |
| Privacy policy | Entry-level policy (Phase 9D) | Need journal-specific sensitivity and guardian/coach access rules |
| Routes/pages | None | Need create/edit/finalize/archive journal routes; habit check-in routes |
| Prompt library | None | Need `JournalPrompt` CRUD and assignment workflow |
| Feed guards | Labels only | Need content-safety guards preventing journal body text leakage |
| Guardian visibility | `AthleteGuardianRelationship` exists | Need journal-specific guardian access policy evaluation |
| Tests | None | Need journal, habit, prompt, and visibility test coverage |
| Seed data | None | Need sample prompts, sample journal entries in seed |
| Activity actions | Generic entry actions | Need journal and habit activity action definitions |
