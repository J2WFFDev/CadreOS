# Arc 24D.11 — EntryOps Navigation, Views, and Review Loops

## Status: Complete

## Goal

Organize EntryOps around user workflows instead of Entry types.

Users think in terms of **Capture → Organize → Execute → Review**, not in terms of
Task / Note / Decision / Event / Journal / Habit.

## What Changed

### Navigation (`lib/navigation/cadreos-nav.ts`)

**HOME group** — removed the legacy FYP ("For You Page") item. HOME now contains only:
- Personal Dashboard
- Notifications

**ENTRYOPS group** — reorganized into a workflow-oriented sequence:

| Position | Key | Label | Route |
|----------|-----|-------|-------|
| 1 | `ENTRY_INBOX` | Inbox | `/entries/inbox` |
| 2 | `ENTRY_MY_WORK` | My Work | `/assigned` |
| 3 | `ENTRY_TODAY` | Today | `/today` |
| 4 | `ENTRY_UPCOMING` | Upcoming | `/upcoming` |
| 5 | `ENTRY_REVIEW` | Review | `/entries/review` |
| 6 | `ENTRY_LISTS` | Lists | `/lists` |
| 7 | `ENTRY_ACTIVITY` | Activity Feed | `/feed` |
| 8 | `ENTRY_ALL` | All | `/entries` |
| 9 | `ENTRY_HABITS` | Habits | `/habits` |
| 10 | `ENTRY_JOURNALS` | Journals | `/journals` |
| 11 | `ENTRY_PROMPTS` | Prompt Library | `/prompts` |
| 12 | `ENTRY_PROMPT_ASSIGNMENTS` | Prompt Assignments | `/prompt-assignments` |

The first five items cover the full Capture → Organize → Execute → Review loop.
Activity Feed (formerly FYP) moved from HOME into ENTRYOPS as item 7.

### Nav Validation (`lib/navigation/cadreos-nav-validation.ts`)

Updated `APPROVED_CADREOS_GROUP_ITEMS` to reflect the new HOME (2 items) and
ENTRYOPS (12 items) structures. The canonical sidebar taxonomy test continues to enforce this.

### Active Link Suppression (`lib/nav-sidebar.ts`)

`isNavSidebarLinkActive` now suppresses the `/entries` root link activation for three sub-paths:
- `/entries/inbox` (was already handled)
- `/entries/review` (new)
- `/entries/schedule` (defensive — existed before)

Without this fix, navigating to `/entries/review` would incorrectly highlight the "All Entries" nav item.

### New Review View (`app/(dashboard)/entries/review/page.tsx`)

New page at `/entries/review` showing completed, cancelled, and archived entries.
- Optional type filter via URL param (`?type=TASK` etc.)
- Improved empty-state: "Nothing here yet. Completed, cancelled, and archived entries appear here."
- Ordered by `updatedAt` descending (most recently changed first)
- Limit: 200 entries

### Review Query (`lib/operational-feed/queries.ts`)

Added:
- `REVIEW_ENTRY_STATUSES` — `["DONE", "CANCELLED", "ARCHIVED"]` (exported constant)
- `ReviewEntryItem` — type extending `FeedEntryItem` with `updatedAt`
- `queryReviewEntries(ctx, options?)` — async query function; optional `type` filter

`queryReviewEntries` is intentionally **not** part of `aggregateOperationalFeed`. The Review
page is a dedicated workflow destination, not part of the combined feed.

### Today Page (`app/(dashboard)/today/page.tsx`)

Added habits section for consistency across entry types. Today now shows:
1. **Work Items** — entries due/scheduled today (TASK, FOLLOW_UP, etc.)
2. **Habits** — actionable habits for today (uses existing `queryActionableHabitsToday`)

Combined empty-state covers both: "Nothing due or scheduled for today, and no habits to check in on."

### Upcoming Page (`app/(dashboard)/upcoming/page.tsx`)

Improved description: "Tasks, events, decisions, and journals due or scheduled in the next 14 days."
Added "New task" quick-action button in the empty state.

### Inbox Page (`app/(dashboard)/entries/inbox/page.tsx`)

Title: "Work Inbox" → "Inbox"
Empty-state: "Inbox is clear — nothing waiting to be processed. Use Quick Capture to add new items."

### My Work Page (`app/(dashboard)/assigned/page.tsx`)

Clarified description: "…excluding completed and archived work."
Improved empty-state messaging.

### Activity Feed Page (`app/(dashboard)/feed/page.tsx`)

Renamed from "My Work" to "Activity Feed" throughout the page (title, description, error state).
Description: "Changes, check-ins, and work history across your organization."

## Tests

New test files covering NAV-001 through NAV-015:

- `tests/entry-ops-navigation/nav-workflow-views.test.ts` — 18 tests verifying:
  - All workflow view keys/hrefs/labels are correct
  - FYP removed from HOME
  - No duplicate active hrefs
  - Full taxonomy validation passes
  - All workflow views are active and not disabled
  - Sub-path exclusion for `/entries/review` and `/entries/inbox`
  - Role-based visibility (ADMIN, ATHLETE, GUARDIAN)
  - Prompt Library correctly scoped (hidden from GUARDIAN)
  - Group ordering enforced

- `tests/entry-ops-navigation/review-query.test.ts` — 5 tests verifying:
  - `REVIEW_ENTRY_STATUSES` contains DONE, CANCELLED, ARCHIVED
  - No overlap between review and active status sets
  - Combined coverage of all expected statuses
  - My Work (active feed) excludes DONE/CANCELLED/ARCHIVED
  - My Work active statuses are exactly OPEN and IN_PROGRESS

## Constraints Respected

- ✅ EntryOps naming kept
- ✅ SignalOps not activated
- ✅ WorkOps not reintroduced
- ✅ Visual theme unchanged
- ✅ Database architecture unchanged
- ✅ No new Entry types
- ✅ No Kanban/Gantt/project-management added
- ✅ No advanced analytics added

## Manual Validation Checklist

NAV-001 through NAV-020 manual checks:

| ID | Check | Route | Expected |
|----|-------|-------|----------|
| NAV-001 | Inbox appears in sidebar | `/entries/inbox` | Item visible, labelled "Inbox" |
| NAV-002 | My Work appears in sidebar | `/assigned` | Item visible, labelled "My Work" |
| NAV-003 | Today appears in sidebar | `/today` | Item visible, labelled "Today" |
| NAV-004 | Upcoming appears in sidebar | `/upcoming` | Item visible, labelled "Upcoming" |
| NAV-005 | Review appears in sidebar | `/entries/review` | Item visible, labelled "Review" |
| NAV-006 | Lists appears in sidebar | `/lists` | Item visible, labelled "Lists" |
| NAV-007 | Activity Feed appears in sidebar | `/feed` | Item visible, labelled "Activity Feed" |
| NAV-008 | FYP not visible in sidebar HOME | — | No "FYP" or "For You" item in HOME group |
| NAV-009 | Review page loads | `/entries/review` | Shows completed/cancelled/archived entries or empty state |
| NAV-010 | Review active link correct | `/entries/review` | "Review" highlighted; "All" NOT highlighted |
| NAV-011 | Inbox active link correct | `/entries/inbox` | "Inbox" highlighted; "All" NOT highlighted |
| NAV-012 | Today shows habits section | `/today` | "Habits" section appears below work items |
| NAV-013 | Today empty state covers both | `/today` | "Nothing due… and no habits to check in on" |
| NAV-014 | Upcoming description | `/upcoming` | Mentions tasks, events, decisions, journals |
| NAV-015 | Upcoming empty state | `/upcoming` | "New task" action button visible |
| NAV-016 | Inbox title | `/entries/inbox` | Page heading is "Inbox" (not "Work Inbox") |
| NAV-017 | My Work excludes done/archived | `/assigned` | Description says "excluding completed and archived work" |
| NAV-018 | Activity Feed title | `/feed` | Page heading is "Activity Feed" |
| NAV-019 | Review type filter | `/entries/review?type=TASK` | Only TASK entries shown |
| NAV-020 | Review empty state | `/entries/review` (empty org) | "Nothing here yet. Completed, cancelled, and archived entries appear here." |
