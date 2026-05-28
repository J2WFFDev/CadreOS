# Arc 23A — Journals & Habits Inventory, Privacy Model, and Gap Plan

## Purpose

Arc 23A establishes the Release 1 baseline for the Journals & Habits domain before any runtime build begins.

This arc is inventory-first and documentation-first:

- no broad destructive schema rewrites
- no breaking changes to Entry, MemberOps, GearOps, FieldOps, or ResourceOps workflows
- no runtime journal or habit feature builds in this arc
- no Communications delivery, email/SMS/push notifications, or AI recommendations
- no weakening of guardian/athlete privacy rules

## Roadmap Correction (Canonical)

Journals & Habits work is now tracked in **Arc 23**.

- Historical labels:
  - old Arc J = Journals & Habits (pre-Arc 23 roadmap; do not use)
  - old Phase 21A = Athlete Journaling Capability Roadmap (planning doc, superseded by Arc 23 numbering)
- Canonical Release 1 mapping going forward:
  - **Arc 23A** — Inventory, privacy model, and gap plan (this document)
  - **Arc 23B** — Journal Entry Type and Draft/Final Workflow
  - **Arc 23C** — Prompt Library and Prompt Assignment
  - **Arc 23D** — Habit Model, Recurrence, and Completion Tracking
  - **Arc 23E** — Guardian-Safe Visibility and Feed Integration
  - **Arc 23F** — Journal Version History and Trust/Audit Model
  - **Arc 23G** — Journals & Habits Views, Filters, and Readiness UX
  - **Arc 23H** — Journals & Habits Closeout, Auth Audit, QA, Seed Data, and Docs

Do not use "Arc J" for new roadmap work. Do not use Phase 21A numbering for new implementation work.

---

## Arc 23A Inventory Outputs

Arc 23A output artifacts in this PR:

- `ARC_23A_JOURNALS_HABITS_INVENTORY_REPORT.md` — codebase inventory
- `ARC_23A_JOURNALS_HABITS_QA_CHECKLIST.md` — manual QA checklist scaffold
- this Arc 23A roadmap + privacy model + gap plan document

---

## Journals & Habits Domain Model (Release 1 Intended Direction)

### Entry (existing, unchanged)

The unified operational capture model. Journals extend Entry as a specialized subtype. The `JOURNAL` and `HABIT` values already exist in `EntryType`. Entry remains the shared capture and activity foundation.

### JournalEntry (new — Arc 23B)

Specialized journal record linked to a parent `Entry` of type `JOURNAL`.

Fields:
- `id`
- `organizationId`
- `entryId` — foreign key to the parent `Entry`
- `athletePersonId` — the athlete author
- `source` — `JournalSource` enum (see below)
- `status` — `JournalStatus` enum (see below)
- `promptId` — nullable foreign key to `JournalPrompt`
- `assignmentId` — nullable foreign key to `JournalAssignment`
- `version` — current version number
- `finalizedAt` — nullable timestamp
- `archivedAt` — nullable timestamp
- `createdAt`, `updatedAt`

### JournalSource (new enum — Arc 23B)

Represents how the journal entry was initiated:

| Value | Meaning |
|---|---|
| `FREEFORM` | Self-initiated, no prompt |
| `PROMPT_SELF_SELECTED` | Athlete chose a prompt from library |
| `PROMPT_ASSIGNED` | Staff/coach assigned a prompt to the athlete |
| `PROMPT_SCHEDULED` | System-scheduled recurring prompt |

### JournalStatus (new enum — Arc 23B)

Journal lifecycle state:

| Value | Meaning |
|---|---|
| `DRAFT` | Editable by athlete; not yet submitted |
| `SUBMITTED` | Athlete has finalized and submitted |
| `ARCHIVED` | Retained but hidden from active views |

Status transitions: `DRAFT` → `SUBMITTED` → `ARCHIVED`

Draft content must not be visible to coaches or guardians unless explicitly policy-allowed.

### JournalPrompt (new — Arc 23C)

Reusable prompt from the prompt library. Can be self-selected by athletes or assigned by staff/coaches.

Fields:
- `id`
- `organizationId`
- `title`
- `promptText`
- `category`
- `audienceLevel`
- `tags` — string array
- `active` — boolean; inactive prompts are hidden from selection UI
- `createdByPersonId`
- `createdAt`, `updatedAt`

Sample categories: Pre-practice reflection, Post-practice reflection, Match preparation, Match review, Goal setting, Confidence check, Equipment readiness, Teamwork / sportsmanship, Recovery from mistakes.

### JournalAssignment (new — Arc 23C)

Staff/coach-assigned prompt with a due window. Uses existing task architecture patterns.

Fields:
- `id`
- `organizationId`
- `promptId`
- `assignedToAthletePersonId` — nullable (single athlete)
- `assignedToTeamId` — nullable (entire team/group)
- `assignedByPersonId`
- `scheduledFor` — nullable future activation date
- `dueAt` — nullable due date
- `entryTaskId` — nullable linkage to an `Entry` of type `TASK` for task-architecture integration
- `status` — `JournalAssignmentStatus` enum
- `createdAt`, `updatedAt`

`JournalAssignmentStatus` values: `PENDING`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `EXPIRED`

### JournalVersion (new — Arc 23F)

Immutable content snapshot for trust and audit purposes. Deferred to Arc 23F.

Fields:
- `id`
- `journalEntryId`
- `versionNumber`
- `contentSnapshot` — serialized body text at the time of capture
- `statusAtVersion` — `JournalStatus` value at snapshot time
- `editedByPersonId`
- `editedAt`
- `changeReason` — nullable

Design rule: Content must not be overwritten without preserving a snapshot for audit/trust continuity.

### Habit (new — Arc 23D)

A recurring behavior or check-in tracked over time. May be self-defined by an athlete or assigned by staff.

Fields:
- `id`
- `organizationId`
- `athletePersonId`
- `title`
- `description` — nullable
- `active` — boolean
- `createdByPersonId`
- `createdAt`, `updatedAt`

### HabitSchedule (new — Arc 23D)

Recurrence rule or schedule definition for a `Habit`.

Fields:
- `id`
- `habitId`
- `frequency` — `HabitFrequency` enum
- `daysOfWeek` — optional JSON array for weekly schedules
- `startDate`
- `endDate` — nullable
- `createdAt`, `updatedAt`

`HabitFrequency` values: `DAILY`, `WEEKLY`, `CUSTOM`

### HabitCompletion (new — Arc 23D)

A dated completion/check-in record for a `Habit`.

Fields:
- `id`
- `habitId`
- `athletePersonId`
- `completedOn` — date
- `note` — nullable freeform note
- `createdAt`

Streak and summary aggregations are computed from `HabitCompletion` records.

---

## Privacy and Visibility Policy

### Principle: Journal Content is Sensitive by Default

Athlete-authored journal content (body text, freeform reflection) must be treated as sensitive personal data by default. The default policy is that journal body text is **not** visible outside of the athlete and authorized admin/staff unless explicit policy overrides are in place.

### EntryVisibility Extension (Arc 23B)

The current `EntryVisibility` enum must be extended for journal needs. Proposed additive values:

| New Value | Meaning |
|---|---|
| `ATHLETE_PRIVATE` | Visible only to the authoring athlete and organization admin |
| `GUARDIAN_VISIBLE` | Visible to authoring athlete + linked guardians (relationship-gated) + admin |
| `COACH_VISIBLE` | Visible to authoring athlete + assigned coach/staff + admin |

These additions are non-breaking. Existing entry records default to `STAFF_ONLY` and are unaffected.

### Role-Aware Visibility Matrix

| Content | Athlete (author) | Guardian | Assigned Coach | Other Staff | Org Admin |
|---|---|---|---|---|---|
| Journal draft body | ✅ Visible | ❌ No (safe default) | ❌ No (safe default) | ❌ No | ✅ Policy-allowed |
| Journal submitted body | ✅ Visible | Policy-controlled | Policy-controlled | ❌ No | ✅ Policy-allowed |
| Journal activity summary (metadata) | ✅ Visible | ✅ Safe summary only | ✅ Safe summary only | Limited | ✅ |
| Journal prompt assignment | ✅ Visible | ✅ Can see prompt title | ✅ Can see assignment | Limited | ✅ |
| Habit completion summary | ✅ Visible | ✅ Summary (count/streak) | ✅ Summary (count/streak) | Limited | ✅ |
| Habit completion detail | ✅ Visible | Policy-controlled | Policy-controlled | ❌ No | ✅ |

### Guardian Visibility Rules

Guardian access to athlete journal content must follow these safe defaults:

1. Guardians can see that an athlete has submitted a journal entry (metadata: title, date, status).
2. Guardians cannot see journal draft body content by default.
3. Guardians can see submitted journal body content only if:
   - The `EntryVisibility` value is `GUARDIAN_VISIBLE`, AND
   - A valid `AthleteGuardianRelationship` exists for this athlete-guardian pair in the same organization.
4. Guardian access is always relationship-scoped (`AthleteGuardianRelationship`) — no org-wide guardian visibility.
5. Existing `resolveGuardianRelationshipAccess()` pattern must be extended to journal policy checks.

### Coach Visibility Rules

Coach access to athlete journal content must follow these safe defaults:

1. Coaches can see prompt assignment metadata (which prompts were assigned and whether they were completed).
2. Coaches cannot see journal draft content.
3. Coaches can see submitted journal body content only if:
   - The `EntryVisibility` value is `COACH_VISIBLE` or higher, AND
   - The coach is assigned to the athlete's team or program.
4. Coach access is team/program-scoped — coaches should not see journals of athletes outside their assignment.

### Admin / Staff Visibility

Org admin and program directors may see all journal records for compliance purposes. This must be:
- Intentional, not accidental
- Documented as policy, not assumed
- Implemented with the same authorization helper pattern as notes (`requirePermission`, `resolveGuardianRelationshipAccess`)

### Feed Activity Safety

The activity feed must never expose journal body text in activity event payloads unless the viewer's role and relationship authorize full content access:

- Safe activity event: `"athlete submitted journal entry"` (no body text)
- Safe activity event: `"journal prompt assigned to athlete"` (no body text)
- Safe activity event: `"habit check-in recorded"` (count/date only)
- Unsafe (must be prevented): activity event payload that includes journal body text visible to broad role audiences

The `EntryActivity` record should store only metadata references and action types for journal events. Body text must never appear in `EntryActivity.metadataJson` unless the payload is policy-filtered at read time.

---

## Required Policy Decisions (Recommended Defaults)

The following policy decisions should be locked before Arc 23B runtime build begins:

| Policy Question | Recommended Default |
|---|---|
| Can guardians see full athlete journal body content? | **No by default.** Must be opted into via `GUARDIAN_VISIBLE` visibility value and explicit relationship check. |
| Can coaches see full athlete journal body content? | **No by default.** Must be opted into via `COACH_VISIBLE` and team/program assignment check. |
| Can athletes save drafts privately? | **Yes.** Draft status = visible only to athlete + admin. No coach or guardian visibility. |
| Can staff assign prompts without seeing draft freeform content? | **Yes.** Assignment metadata is visible to assigning staff; draft content is not. |
| What status values are needed? | `DRAFT`, `SUBMITTED`, `ARCHIVED` (see `JournalStatus` above) |
| Should deleted journal text be preserved in version history? | **Yes (deferred to Arc 23F).** Soft-delete with archived status; version snapshots for audit. |
| Should habits expose detailed check-in history or summary only? | **Summary visible to guardian/coach by default. Full history visible to athlete and admin.** |

---

## Gap List for Arc 23B–23H

### Arc 23B — Journal Entry Type and Draft/Final Workflow

Gaps to close:

- [ ] Add `JournalEntry` Prisma model
- [ ] Add `JournalStatus` enum (`DRAFT`, `SUBMITTED`, `ARCHIVED`)
- [ ] Add `JournalSource` enum
- [ ] Add `ATHLETE_PRIVATE`, `GUARDIAN_VISIBLE`, `COACH_VISIBLE` to `EntryVisibility` enum
- [ ] Add journal create/draft route (`/journals/create`)
- [ ] Add journal edit route (`/journals/[journalId]/edit`)
- [ ] Add journal finalize/submit route (`/journals/[journalId]/submit`)
- [ ] Add journal archive route (`/journals/[journalId]/archive`)
- [ ] Add journal detail page (`/journals/[journalId]`)
- [ ] Add journal list page (`/journals`)
- [ ] Wire `createdByPersonId` attribution via existing actor helpers
- [ ] Enforce `ATHLETE_PRIVATE` default for new journal entries

### Arc 23C — Prompt Library and Prompt Assignment

Gaps to close:

- [ ] Add `JournalPrompt` Prisma model
- [ ] Add `JournalAssignment` Prisma model
- [ ] Add `JournalAssignmentStatus` enum
- [ ] Add prompt library list/detail pages
- [ ] Add prompt create/edit/activate/deactivate routes
- [ ] Add assignment create route (staff assigns prompt to athlete or team)
- [ ] Add athlete self-select flow (athlete picks from active prompt library)
- [ ] Add assignment completion tracking
- [ ] Wire assignment to `Entry` task architecture for due window tracking

### Arc 23D — Habit Model, Recurrence, and Completion Tracking

Gaps to close:

- [ ] Add `Habit` Prisma model
- [ ] Add `HabitSchedule` Prisma model
- [ ] Add `HabitCompletion` Prisma model
- [ ] Add `HabitFrequency` enum
- [ ] Add habit create/edit/archive routes
- [ ] Add habit check-in route (`/habits/[habitId]/check-in`)
- [ ] Add habit list page
- [ ] Add streak/completion summary aggregation logic
- [ ] Evaluate whether `Entry.taskRecurrenceRule` is reused or `HabitSchedule` is standalone

### Arc 23E — Guardian-Safe Visibility and Feed Integration

Gaps to close:

- [ ] Extend `resolveGuardianRelationshipAccess()` to journal/habit policy checks
- [ ] Add journal visibility evaluation to entry authorization helpers
- [ ] Add feed content-safety guards for `JOURNAL` and `HABIT` entry types
- [ ] Add journal activity action definitions (`journal.draft_created`, `journal.submitted`, etc.)
- [ ] Add habit activity action definitions (`habit.checked_in`, etc.)
- [ ] Verify feed payloads never include journal body text for unauthorized viewers
- [ ] Add guardian-scoped journal visibility page or indicator

### Arc 23F — Journal Version History and Trust/Audit Model

Gaps to close:

- [ ] Add `JournalVersion` Prisma model
- [ ] Add snapshot capture on journal submit and on significant edit
- [ ] Add version retrieval endpoint (admin/audit use)
- [ ] Define version retention policy
- [ ] Document soft-delete behavior for archived journals

### Arc 23G — Journals & Habits Views, Filters, and Readiness UX

Gaps to close:

- [ ] Add athlete journal history view with status filters
- [ ] Add guardian-safe journal summary view
- [ ] Add coach/staff prompt assignment dashboard
- [ ] Add habit streak/calendar UI surface
- [ ] Add feed rendering for safe journal/habit activity items
- [ ] Add journal and habit filters to entries/feed list surfaces

### Arc 23H — Journals & Habits Closeout, Auth Audit, QA, Seed Data, and Docs

Gaps to close:

- [ ] Add journal and habit seed data records
- [ ] Add automated tests for journal CRUD, status transitions, and visibility rules
- [ ] Add automated tests for guardian/coach visibility boundaries
- [ ] Audit all journal and habit routes for authorization completeness
- [ ] Final QA pass using manual QA checklist
- [ ] Update planning README and roadmap to mark Arc 23 complete

---

## Deferred Scope

The following capabilities are explicitly deferred from Arc 23 and should not be built:

- AI prompt recommendations or prompt relevance scoring
- Athlete readiness scoring derived from journal sentiment or habit streaks
- Mood/sentiment analysis of journal content
- Advanced privacy consent workflows or parental consent management
- External notifications (email, SMS, push) for journal assignments or habit reminders
- Mobile push reminders for habits
- Offline journaling with sync
- Rich media journal entries (photo, audio, video)
- Full parent portal with dedicated journal view UI
- Advanced analytics, export, or cross-cohort journal insights
- Scheduled recurring prompt delivery (system-automated activation; manual assignment is in scope)

---

## Arc 23A Outputs Summary

| Artifact | File | Status |
|---|---|---|
| Inventory report | `ARC_23A_JOURNALS_HABITS_INVENTORY_REPORT.md` | ✅ Complete |
| Domain model + privacy policy + gap plan | `ARC_23A_JOURNALS_HABITS_INVENTORY_PRIVACY_MODEL_AND_GAP_PLAN.md` | ✅ Complete |
| Manual QA checklist scaffold | `ARC_23A_JOURNALS_HABITS_QA_CHECKLIST.md` | ✅ Complete |
| Planning README update | `README.md` | ✅ Complete |
