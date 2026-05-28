# Arc 23A — Journals & Habits Manual QA Checklist Scaffold

This is a manual QA checklist scaffold for Arc 23 test verification. Items are placeholders for future sub-arc implementations (Arc 23B–23H). Each item should be checked off during QA after the relevant sub-arc is complete.

---

## Journal Workflow

### Create Journal Draft (Arc 23B)

- [ ] Athlete can navigate to the journal create page
- [ ] Athlete can enter a title and body text
- [ ] Journal is created with `JournalStatus = DRAFT`
- [ ] Journal is created with `JournalSource = FREEFORM`
- [ ] Journal is created with the correct `athletePersonId` and `organizationId`
- [ ] Journal is created with `EntryVisibility = ATHLETE_PRIVATE` by default
- [ ] Non-athlete users cannot create journals on behalf of athletes without authorization
- [ ] Draft journal body text is not visible to guardian users
- [ ] Draft journal body text is not visible to coach users
- [ ] Draft journal body text is not visible in feed activity events

### Edit Journal Draft (Arc 23B)

- [ ] Athlete can edit the body text of a draft journal entry
- [ ] Edit updates the `updatedAt` timestamp and `updatedByPersonId`
- [ ] Edit does not change the `JournalStatus` from `DRAFT`
- [ ] Non-author staff cannot edit an athlete's draft journal body
- [ ] Edit action is recorded in `EntryActivity`

### Finalize / Submit Journal (Arc 23B)

- [ ] Athlete can submit/finalize a draft journal
- [ ] Status transitions from `DRAFT` to `SUBMITTED`
- [ ] `finalizedAt` timestamp is set
- [ ] Finalized journal is visible to athlete
- [ ] Finalized journal visibility follows the `EntryVisibility` policy (guardian-visible only if `GUARDIAN_VISIBLE`)
- [ ] Submit action is recorded in `EntryActivity`
- [ ] Feed shows a safe activity summary: "journal submitted" (no body text)

### Archive Journal (Arc 23B)

- [ ] Athlete or authorized staff can archive a journal entry
- [ ] Status transitions to `ARCHIVED`
- [ ] `archivedAt` timestamp is set
- [ ] Archived journal does not appear in default active journal views
- [ ] Archived journal is still retrievable by athlete in archive view
- [ ] Archive action is recorded in `EntryActivity`

---

## Prompt Library (Arc 23C)

### Create Prompt

- [ ] Staff/admin can create a new prompt in the prompt library
- [ ] Prompt requires `title` and `promptText`
- [ ] Prompt is created with `active = true` by default
- [ ] Prompt is scoped to the organization (`organizationId`)
- [ ] Prompt is visible in the prompt library list

### Manage Prompt (Arc 23C)

- [ ] Staff/admin can edit an existing prompt
- [ ] Staff/admin can deactivate a prompt (sets `active = false`)
- [ ] Inactive prompts do not appear in athlete prompt selection UI
- [ ] Inactive prompts do appear in staff prompt management views (with inactive label)

### Assign Prompt to Athlete (Arc 23C)

- [ ] Staff/coach can assign an active prompt to an individual athlete
- [ ] Staff/coach can assign an active prompt to a team (bulk assignment)
- [ ] Assignment creates a `JournalAssignment` record with `status = PENDING` or `ACTIVE`
- [ ] Assignment due date (`dueAt`) is correctly stored
- [ ] Athlete receives the assignment (visible in their journal dashboard)
- [ ] Assigning staff cannot see the athlete's draft freeform content
- [ ] Assignment metadata (prompt title, due date, status) is visible to assigning staff

### Complete Assigned Journal Prompt (Arc 23C)

- [ ] Athlete can open an assigned prompt and write a journal response
- [ ] Journal response is linked to the `JournalAssignment` (`assignmentId`)
- [ ] `JournalSource` is set to `PROMPT_ASSIGNED`
- [ ] Completing the journal marks the `JournalAssignment` as `COMPLETED`
- [ ] Completion is visible to the assigning staff (assignment status only, not body text by default)

---

## Habit Tracking (Arc 23D)

### Create Habit

- [ ] Athlete (or authorized staff) can create a new habit
- [ ] Habit requires a `title`
- [ ] Habit is created with `active = true`
- [ ] Habit is scoped to the athlete and organization

### Complete Habit Check-In

- [ ] Athlete can record a habit check-in for today's date
- [ ] `HabitCompletion` record is created with the correct `completedOn` date
- [ ] Duplicate check-in on the same date is prevented or handled gracefully
- [ ] Streak count is correctly computed from consecutive completions
- [ ] Check-in is recorded in `EntryActivity`

### View Habit Summary

- [ ] Athlete can view their habit history (completion calendar or list)
- [ ] Streak count is displayed correctly
- [ ] Coach/guardian see only summary counts and streak, not per-entry detail notes (by default)

---

## Guardian Visibility (Arc 23E)

### Guardian Cannot See Draft Content

- [ ] Guardian user cannot see draft journal body text for a linked athlete
- [ ] Guardian user cannot see draft journal entries in their feed

### Guardian Can See Safe Metadata

- [ ] Guardian user can see that a linked athlete submitted a journal (metadata only: title, date, status)
- [ ] Guardian user can see prompt assignment metadata for a linked athlete

### Guardian Can See Submitted Content When Policy Allows

- [ ] When `EntryVisibility = GUARDIAN_VISIBLE`, guardian with a valid `AthleteGuardianRelationship` can see submitted journal body
- [ ] Guardian without a valid relationship cannot see journal content even if `GUARDIAN_VISIBLE`
- [ ] Guardian from a different organization cannot see journal content

---

## Coach Visibility (Arc 23E)

### Coach Cannot See Draft Content

- [ ] Coach user cannot see draft journal body text
- [ ] Coach user cannot see private athlete journals with `ATHLETE_PRIVATE` visibility

### Coach Can See Assignment Metadata

- [ ] Coach can see prompt assignment status for athletes on their assigned team/program
- [ ] Coach can see whether an athlete has submitted a response (status only)

### Coach Can See Submitted Content When Policy Allows

- [ ] When `EntryVisibility = COACH_VISIBLE`, team-assigned coach can see submitted journal body
- [ ] Coach outside the athlete's team/program cannot see journal content

---

## Feed and Activity Safety (Arc 23E)

### Feed Does Not Leak Journal Body Text

- [ ] Feed activity events for journal actions contain only metadata (title, status, date)
- [ ] Feed activity event payload does not include journal body text
- [ ] Feed item for `JOURNAL` entry type shows "Journal" label but no body preview by default
- [ ] `EntryActivity.metadataJson` for journal events does not contain body text

### Role-Aware Feed Rendering

- [ ] Guardian user's feed shows only journal activity summaries for linked athletes, no body text
- [ ] Coach user's feed shows only assignment completion summaries, no body text
- [ ] Staff user's feed shows safe journal activity summaries
- [ ] Admin user's feed shows full activity detail where policy allows

---

## Role-Aware Access Boundaries (General)

- [ ] Athlete cannot access journal detail pages for other athletes
- [ ] Guardian can only see journal activity for their linked athletes, not for unrelated athletes
- [ ] Coach can only see journal activity for athletes in their assigned team/program
- [ ] Staff without explicit policy cannot read journal body text
- [ ] Org admin can access journal records for compliance purposes
- [ ] All journal routes return 403 for unauthenticated requests
- [ ] All journal routes return 403 for authenticated users with insufficient role/relationship

---

## Notes

- This checklist is a **scaffold for future manual QA**. Items should be marked complete during QA execution in Arc 23B–23H.
- Each sub-arc should produce a corresponding validation checklist document (e.g., `ARC_23B_JOURNAL_WORKFLOW_VALIDATION_CHECKLIST.md`) following the pattern established in Arc 22.
- Security and authorization boundary checks must be completed before any journal or habit feature is marked ready for release.
