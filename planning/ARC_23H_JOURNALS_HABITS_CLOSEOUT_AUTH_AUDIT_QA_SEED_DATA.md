# Arc 23H — Journals & Habits Closeout, Auth Audit, QA, Seed Data, and Documentation

## Purpose

Arc 23H closes Arc 23 (Journals & Habits) for Release 1 by validating implementation readiness, privacy boundaries, and operational fit with Entry and MemberOps.

This is a closeout arc:

- no Communications delivery
- no email/SMS/push notifications
- no AI recommendations, readiness scoring, sentiment analysis, or advanced analytics
- no broad destructive schema rewrites

---

## Arc 23 Completion Summary

| Arc | Title | Status |
|-----|-------|--------|
| Arc 23A | Journals & Habits inventory, privacy model, and gap planning | ✅ Complete |
| Arc 23B | Journal Entry Type and Draft/Final Workflow | ✅ Complete |
| Arc 23C | Prompt Library and Prompt Assignment | ✅ Complete |
| Arc 23D | Habit Model, Recurrence, and Completion Tracking | ✅ Complete |
| Arc 23E | Guardian-Safe Visibility and Feed Integration | ✅ Complete |
| Arc 23F | Journal Version History and Trust/Audit Model (Entry-backed) | ✅ Covered for Release 1 |
| Arc 23G | Journals & Habits views, filters, and readiness UX | ✅ Covered for Release 1 |
| Arc 23H | Closeout, auth audit, QA, seed data, and docs | ✅ This arc |

---

## Canonical Domain Model (Release 1)

| Concept | Canonical definition |
|---------|----------------------|
| **Journal** | Reflective/private Entry-backed record (`Entry.type = JOURNAL`). |
| **JournalPrompt** | Reusable reflective prompt template (`JournalPrompt`). |
| **PromptAssignment** | Prompt assignment workflow concept (implemented by `JournalAssignment`). |
| **Habit** | Recurring behavior/check-in workflow (`Habit`). |
| **HabitSchedule** | Recurrence/cadence definition for a Habit (`HabitSchedule`). |
| **HabitCompletion** | Dated completion/check-in record (`HabitCompletion`). |
| **JournalVersion** | Release 1 trust/audit support is Entry-backed (`Entry.version`, `EntryActivity`); dedicated snapshot model is deferred. |
| **Entry** | Shared operational capture foundation used across notes/tasks/decisions/follow-ups/journals. |

---

## Authorization and Visibility Audit

### Journal access

- Athlete can read/edit/submit own draft journals.
- Guardian can read only linked-athlete submitted/archived guardian-visible journals.
- Unrelated guardian cannot read journals and receives no sensitive content.
- Coach access requires submitted state + scoped assignment + TEAM_STAFF visibility.
- Admin/program director has override access.

### Prompt access

- Prompt library management is admin/program-director scoped.
- Staff can assign prompts.
- Athletes can respond only to open assignments targeted to them/their team.
- Guardian assignment visibility is relationship-scoped to linked athletes.

### Habit access

- Athletes can read own habits and check in only ACTIVE assigned habits.
- Guardians can read linked-athlete habit summaries only (no completion-note detail).
- Coaches can read scoped habits; completion detail remains restricted.
- Admin/program director can fully manage and inspect.

### Feed/dashboard leakage hardening

- Journal activity text is sanitized to safe labels.
- Habit activity text is sanitized to safe labels.
- Inbox/Assigned broad lists exclude Journal records.
- Today/Upcoming are restricted to operational actionable Entry types and do not expose Journal body content.
- Direct URL access on journal/habit detail routes enforces role-aware authorization.

---

## Functional QA Coverage (Release 1)

Validated in Arc 23 docs, route behavior, and tests:

- create/edit/submit/archive journal
- create/edit/archive prompt
- assign prompt and create prompted response
- create/assign/pause/archive habit
- habit check-in and completion history
- recurrence/cadence handling and streak/count helper behavior
- guardian-safe summary rendering
- feed sanitization and private-content masking
- Today/Upcoming integration boundaries (operational entries only)
- mobile-safe page/table patterns in journal/habit/prompt pages (responsive utility classes present)

Full manual matrix: `ARC_23H_JOURNALS_HABITS_QA_CHECKLIST.md`.

---

## Seed/Test Data Coverage

Arc 23H seed coverage includes:

- athlete with journal draft
- athlete with submitted journal
- archived journal
- prompted journal assignment
- completed prompt response
- active habit
- paused habit
- archived habit
- overdue habit cadence sample
- habit completion history with streak/count sample
- guardian-visible athlete summary inputs
- unrelated guardian denial case
- coach-scoped athlete case

---

## Focused Regression Tests

Arc 23H includes focused tests for:

- journal access boundaries (including coach scope and guardian relationship scoping)
- prompt assignment/read/respond policy boundaries
- habit access boundaries
- habit recurrence/completion helpers (`computeCurrentStreak`, `computeCompletionCount`, normalization)
- feed activity sanitization for journals/habits
- protected-data leakage prevention in activity labels

---

## Deferred Scope (Post-Release 1)

- AI prompt recommendations
- readiness scoring
- sentiment/mood analysis
- reminders and notifications
- email/SMS/push delivery
- gamification
- coach review workflows
- advanced analytics/export
- custom dashboards
- wearable/device integrations
- offline journaling/habits
- granular sharing controls
- rich media journal entries
- dedicated `JournalVersion` snapshot table and restore workflow

---

## Release 1 Readiness Conclusion

Journals & Habits are Release 1 foundation-ready as an Entry-backed extension with role-aware visibility and privacy-safe feed behavior.

No Communications delivery was introduced, and no broad destructive migration was introduced.

---

## Recommended Next Arc

**Arc 23I — Entry + Journals/Habits Consolidation Validation**

Goal:

Validate that notes, tasks, decisions, journals, habits, prompts, follow-ups, Inbox, Today, Upcoming, Assigned-to-me, and Feed behave as one coherent Entry-based operational system rather than disconnected feature islands.

