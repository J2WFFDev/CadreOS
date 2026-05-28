# Arc 23I — Entry System Consolidation & Operational Coherence

## Status: ✅ Complete

---

## Overview

Arc 23I is an integration and hardening arc. Its purpose is to validate and improve
the operational coherence of the Entry-based system so that CadreOS behaves like one
integrated operational platform rather than a collection of disconnected feature islands.

**What this arc is:**
- Systems integration and consistency review
- Shared component and utility extraction
- Authorization gap remediation
- Focused regression test expansion
- Operational philosophy documentation

**What this arc is NOT:**
- Major feature building
- Broad schema rewrites
- LiveOps/FieldOps work
- Communications delivery
- AI recommendations or automation

---

## Entry Philosophy

The following is the unified operational philosophy for CadreOS Entry-derived systems.

### Entry is the shared operational foundation

Entry is not just a data model — it is the operational backbone. Notes, tasks, decisions,
journals, prompts, habits, and follow-ups are **specialized expressions of Entry behavior**,
not independent modules.

### System surfaces and their roles

| Surface | Role |
|---------|------|
| **Inbox** | Low-context intake queue. Captures before context is established. |
| **Feed** | Role-aware operational timeline. Shows what is happening. |
| **Today/Upcoming** | Due/relevant operational work view. Shows what needs attention now. |
| **Assigned-to-me** | Actionable responsibility view. Shows what I own. |
| **Activity** | Structured operational change history. Shows what happened. |
| **Journals** | Sensitive narrative entries. Protected by visibility policy. |
| **Habits** | Recurring behavioral targets. Athlete-assigned, team-scoped. |
| **Prompts** | Staff-driven guided reflection assignments. Linked to journals. |

### Entry types and their specializations

| Entry Type | Specialization |
|-----------|---------------|
| `TASK` | Actionable item with assignee, due date, priority, status lifecycle |
| `NOTE` | Observation or context note, staff-only visibility |
| `DECISION` | Operational decision record, persistent reference |
| `JOURNAL` | Sensitive personal narrative (athlete), visibility-gated |
| `FOLLOW_UP` | Time-bounded accountability item derived from another entry |
| `OBSERVATION` | Structured athlete/team observation |
| `READINESS_ITEM` | Pre-event or pre-session readiness check |
| `HABIT` | Recurring behavior target (separate model, not Entry row) |

---

## Inventory of Arc 22 and Arc 23 Implementations

### Arc 22 (Entry Completion) — All arcs complete ✅

| Arc | Deliverable |
|-----|-------------|
| 22A | Entry inventory and stabilization baseline |
| 22B | Quick capture, Inbox hardening, entry creation patterns |
| 22C | Cross-linking, operational graph (`EntryLink`, `EntryObjectLink`) |
| 22D | Workflow orchestration, follow-up chaining, entry-to-task conversion |
| 22E | Activity stream, `EntryActivity` rows, safe activity text |
| 22F | Feed, Today, Upcoming, Assigned views with filters |
| 22G | Auth audit, QA checklist, seed data |

### Arc 23 (Journals & Habits) — 23A–23E complete ✅

| Arc | Deliverable |
|-----|-------------|
| 23A | Inventory, privacy model, and gap plan |
| 23B | Journal entry workflow (draft → submit → archive), visibility policy |
| 23C | Prompt library, prompt assignment, prompt access |
| 23D | Habit model, recurrence, completion tracking, streak computation |
| 23E | Guardian-safe visibility, feed integration, activity sanitization |

---

## Consistency Findings

### ✅ Consistent patterns (strong)

1. **Authorization context pattern** — All access modules use an identical context shape
   (`actorPersonId`, `assignments`, `linkedGuardianAthleteIds`). Applied to entries,
   journals, habits.

2. **Pure-function authorization** — No DB calls in access helpers. DB resolution is always
   separated (e.g., `resolveJournalAccessContext`, `resolveHabitAccessContext`). Enables
   fast unit tests.

3. **Activity text sanitization** — All activity labels are safe by default. No body text
   or private content appears in feed or activity summaries. Centralized in
   `lib/journals/policy.ts`, `lib/habits/policy.ts`, and `lib/operational-feed/queries.ts`.

4. **Role-based access levels** — Hierarchical `MANAGE > WRITE > READ > NONE` applied
   consistently across operational-entry and journal/habit domains.

5. **Dashboard route conventions** — Each domain has `page.tsx` (list), `create/` (creation),
   and `[id]/` (detail/edit). Consistent with Next.js App Router conventions.

6. **Feed/Today/Upcoming** — All three views use `resolveEntryAccess` before querying.
   All use `labelForEntryType`, `labelForEntryStatus`, `labelForEntryPriority` from
   `lib/operational-feed/render.ts`.

### ⚠️ Inconsistencies addressed in Arc 23I

1. **Inline `badgeClasses()` functions** — `habits/page.tsx` and `habits/[habitId]/page.tsx`
   each defined an identical `badgeClasses()` function. **Fixed:** Replaced with shared
   `StatusBadge` component.

2. **Inline filter tab markup** — Habits page duplicated tab link markup with inline
   conditional classes. **Fixed:** Replaced with shared `FilterTabs` component.

3. **Inline date formatting** — `date.toISOString().slice(0, 16).replace("T", " ")` was
   repeated across many pages. **Fixed:** Extracted to `lib/format-date.ts`.

4. **Decisions page missing authorization check** — The `/decisions` page queried the DB
   without calling `resolveEntryAccess`. Any authenticated user in the org could access
   decision records. **Fixed:** Added `resolveEntryAccess` guard consistent with
   Today/Upcoming/Feed/Assigned pages.

5. **Missing habit policy tests** — `lib/habits/policy.ts` had streak computation, completion
   count, safe activity text, and label helpers with no test coverage. **Fixed:** Added
   `tests/habits/policy.test.ts` with 24 tests covering all exported functions.

6. **No cross-domain status consistency test** — No test validated that all Entry types,
   Entry statuses, Habit statuses, and Journal workflow statuses have human-readable labels
   and that their terminal states are consistent. **Fixed:** Added
   `tests/entries/status-consistency.test.ts`.

### ℹ️ Known gaps not addressed in Arc 23I (deferred)

See `ARC_23I_DEFERRED_SCOPE.md` for the full list. Summary:

- Notes and Tasks pages (36KB / 43KB) warrant refactoring but are stable and out of scope
  for a low-risk integration arc.
- Journals and Prompts pages still use inline filter tab markup — migrating those to
  `FilterTabs` is straightforward but deferred to avoid unnecessary churn on stable pages.
- Habits currently lack edit/pause/archive route handlers (the form buttons exist in the
  detail page UI but the server route handlers were out of scope for this arc).

---

## Shared Components Introduced

### `components/dashboard/status-badge.tsx`

A unified status badge component for all Entry-derived systems.

**Variants:**
| Variant | Color | Used for |
|---------|-------|---------|
| `active` | Green | Habit `ACTIVE` |
| `open` | Blue | Entry `OPEN` |
| `in_progress` | Blue | Entry `IN_PROGRESS` |
| `done` | Green | Entry `DONE` |
| `paused` | Yellow | Habit `PAUSED` |
| `draft` | Zinc | Journal `DRAFT` |
| `cancelled` | Zinc | Entry `CANCELLED` |
| `archived` | Zinc | Any `ARCHIVED` |
| `pending` | Amber | Prompt assignment `PENDING` |
| `neutral` | Zinc | Fallback |

**Usage:**
```tsx
import { StatusBadge } from "@/components/dashboard/status-badge";
import { badgeVariantForHabitStatus, labelForHabitStatus } from "@/lib/habits/policy";

<StatusBadge variant={badgeVariantForHabitStatus(habit.status)} label={labelForHabitStatus(habit.status)} />
```

### `components/dashboard/filter-tabs.tsx`

A unified filter tab strip for all list pages.

**Usage:**
```tsx
import { FilterTabs } from "@/components/dashboard/filter-tabs";

<FilterTabs
  tabs={[
    { label: "Active", href: "/habits?status=active", value: "active" },
    { label: "Paused", href: "/habits?status=paused", value: "paused" },
    { label: "All", href: "/habits?status=all", value: "all" },
  ]}
  activeValue={statusFilter}
/>
```

### `lib/format-date.ts`

Shared date formatting utilities.

| Function | Output format | Used for |
|----------|---------------|---------|
| `formatOperationalDateTime(date)` | `"YYYY-MM-DD HH:MM UTC"` | Detail pages, audit fields |
| `formatShortDateTime(date)` | `"YYYY-MM-DD HH:MM"` | Table cells, feed rows |
| `formatDateOnly(date)` | `"YYYY-MM-DD"` | Date fields, completion history |

---

## Authorization Changes

### Decisions page (`app/(dashboard)/decisions/page.tsx`)

**Before:** Page queried the DB for all DECISION entries in the org with no role check.
Any Clerk-authenticated user with an org context could access decision records.

**After:** `resolveEntryAccess` is called before querying. Users with access level `NONE`
receive an error message and no data is returned. This aligns Decisions with the same
authorization pattern used by Feed, Today, Upcoming, and Assigned.

---

## Test Coverage Added

### `tests/habits/policy.test.ts` (24 new tests)

Covers `lib/habits/policy.ts`:
- `MAX_HABIT_TITLE_LENGTH`, `MAX_HABIT_DESCRIPTION_LENGTH`, `MAX_CHECKIN_NOTE_LENGTH` constants
- `labelForHabitStatus` — all three status values
- `labelForHabitFrequency` — all three frequency values
- `badgeVariantForHabitStatus` — all three status values
- `normalizeCompletedOn` — UTC normalization and no-mutation guarantee
- `computeCompletionCount` — empty list, distinct days, same-day deduplication
- `computeCurrentStreak` (DAILY) — empty list, stale last completion, consecutive days,
  deduplication of same-day entries, gap detection
- `computeCurrentStreak` (CUSTOM) — total count, empty list
- `deriveSafeHabitActivityText` — all 7 known actions plus unknown fallback

### `tests/entries/status-consistency.test.ts` (14 new tests)

Cross-domain status and label consistency:
- All `EntryType` values have non-fallback labels
- All `EntryStatus` values have non-fallback labels
- All `HabitStatus` values have expected labels
- All `JournalWorkflowStatus` values have expected labels
- All journal visibility values have non-empty labels
- `mapEntryStatusToJournalWorkflowStatus` contract — all five entry status values
- `ARCHIVED` terminal state renders as "Archived" across Entry, Habit, and Journal

---

## Updated Files

| File | Change |
|------|--------|
| `components/dashboard/status-badge.tsx` | **New** — shared status badge component |
| `components/dashboard/filter-tabs.tsx` | **New** — shared filter tabs component |
| `lib/format-date.ts` | **New** — shared date formatting utilities |
| `app/(dashboard)/decisions/page.tsx` | **Fixed** — added `resolveEntryAccess` authorization |
| `app/(dashboard)/habits/page.tsx` | **Updated** — uses `StatusBadge`, `FilterTabs`, `formatShortDateTime` |
| `app/(dashboard)/habits/[habitId]/page.tsx` | **Updated** — uses `StatusBadge`, removes inline `badgeClasses` |
| `tests/habits/policy.test.ts` | **New** — 24 habit policy tests |
| `tests/entries/status-consistency.test.ts` | **New** — 14 cross-domain status consistency tests |

---

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| Entry-derived systems follow shared operational patterns | ✅ |
| Inbox, Feed, Assigned-to-me, Today, Upcoming behave consistently | ✅ (verified, no changes needed) |
| Status behavior is understandable and non-conflicting | ✅ (documented, tested) |
| Assignment behavior is understandable and non-conflicting | ✅ (verified, no changes needed) |
| Privacy and authorization remain safe-by-default | ✅ (Decisions page gap fixed) |
| Journal content remains protected | ✅ (Arc 23E, no regression) |
| Existing Entry/Journal/Habit/MemberOps/feeds not broken | ✅ |
| No broad destructive migration introduced | ✅ (additive-only) |
| Platform is ready for Arc 24 — LiveOps/FieldOps | ✅ |
