# Arc 23D — Habit Model, Recurrence, and Completion Tracking

**Status:** Implementation complete  
**Depends on:** Arc 23A (Journals & Habits Inventory, Privacy Model), Arc 23B (Journal Entry Type), Arc 23C (Prompt Library and Prompt Assignment)  
**Next:** Arc 23E — Guardian-Safe Visibility and Feed Integration

---

## Overview

Arc 23D implements the Habit domain model: recurring behaviors or check-in targets assigned to athletes. Athletes or staff can create habits, define a recurrence/cadence schedule, record dated check-ins (completions), and view a streak or completion count summary.

This arc is additive: no existing Entry, Journal, Prompt, MemberOps, GearOps, FieldOps, or feed behavior is broken.

---

## Domain Model

### HabitStatus Enum

```
ACTIVE    — Habit is active and check-ins can be recorded
PAUSED    — Habit is temporarily paused (no check-ins while paused)
ARCHIVED  — Habit is archived; not shown in active views
```

### HabitFrequency Enum

```
DAILY     — Target check-in every day
WEEKLY    — Target check-in once per week (optionally specifying days of week)
CUSTOM    — Custom cadence not captured by DAILY/WEEKLY
```

### Habit

A recurring behavior or check-in target for an athlete.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `organizationId` | `String` | Org scope |
| `title` | `String` | Short label (max 160 chars) |
| `description` | `String?` | Optional detail (max 1000 chars) |
| `athletePersonId` | `String` | FK → Person — athlete the habit belongs to |
| `assignedToTeamId` | `String?` | Optional team context |
| `status` | `HabitStatus` | Default: `ACTIVE` |
| `createdByPersonId` | `String` | Who created it |
| `archivedAt` | `DateTime?` | Set when archived |
| `pausedAt` | `DateTime?` | Set when paused |
| `createdAt` / `updatedAt` | `DateTime` | Timestamps |

### HabitSchedule

Recurrence definition for a Habit. A habit may have one active schedule.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `habitId` | `String` | FK → Habit |
| `frequency` | `HabitFrequency` | Recurrence cadence |
| `daysOfWeek` | `String?` | JSON text e.g. `"MON,WED,FRI"` for WEEKLY frequency |
| `startDate` | `DateTime` | When the schedule begins |
| `endDate` | `DateTime?` | Optional end date |
| `createdAt` / `updatedAt` | `DateTime` | Timestamps |

### HabitCompletion

A dated check-in record for a Habit. Unique on `(habitId, completedOn)` to prevent same-day duplicates.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key |
| `habitId` | `String` | FK → Habit |
| `athletePersonId` | `String` | FK → Person |
| `completedOn` | `DateTime` | Normalized to start-of-day UTC |
| `note` | `String?` | Optional freeform check-in note (max 500 chars) |
| `createdAt` | `DateTime` | Created timestamp |

**Duplicate prevention:** `completedOn` is normalized to start-of-day UTC before saving. A `@@unique([habitId, completedOn])` constraint ensures duplicate same-day check-ins for the same habit are rejected at the database level (Prisma error P2002).

---

## Streak and Completion Count Logic

Implemented in `lib/habits/policy.ts`:

### `computeCurrentStreak(completedDates, frequency)`

- **DAILY:** Counts consecutive days ending today or yesterday. If the most recent completion is older than yesterday, streak = 0.
- **WEEKLY:** Maps each date to its ISO week Monday and counts consecutive calendar weeks ending this week or last week.
- **CUSTOM:** Returns total distinct completion count (streaks are not semantically meaningful for custom frequency).

### `computeCompletionCount(completedDates)`

Returns the count of distinct normalized dates.

---

## Authorization Matrix

| Action | ORGANIZATION_ADMIN | PROGRAM_DIRECTOR | COACH | ASSISTANT_COACH | ATHLETE | PARENT_GUARDIAN |
|---|---|---|---|---|---|---|
| Create habit | ✅ | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| Read habit | ✅ | ✅ | ✅ (scoped) | ✅ (scoped) | ✅ (own) | ✅ (linked athlete, summary) |
| Edit habit | ✅ | ✅ | Creator only | Creator only | Creator only | ❌ |
| Archive habit | ✅ | ✅ | Creator only | Creator only | Creator only | ❌ |
| Pause/resume habit | ✅ | ✅ | Creator only | Creator only | Creator only | ❌ |
| Check in | ✅ | ✅ | ❌ | ❌ | ✅ (own habit) | ❌ |
| View completion detail (notes) | ✅ | ✅ | ❌ (summary only) | ❌ (summary only) | ✅ (own habit) | ❌ (summary only) |

**Coach/assistant-coach scope:** Coaches can read habits for athletes in their assigned team or program. They cannot edit or check in — only the athlete or admin can.

**Guardian visibility:** Guardians can see the habit list and completion count/streak for linked athletes only (via `AthleteGuardianRelationship`). Guardians cannot see completion notes. Guardians cannot see unrelated athletes' habits.

---

## Activity / Feed Behavior

Activity actions defined in `lib/operational-entry/types.ts` (Arc 23D additions):

| Action | Safe label | Body text included? |
|---|---|---|
| `habit.created` | "Habit created" | No |
| `habit.updated` | "Habit updated" | No |
| `habit.assigned` | "Habit assigned" | No |
| `habit.archived` | "Habit archived" | No |
| `habit.paused` | "Habit paused" | No |
| `habit.resumed` | "Habit resumed" | No |
| `habit.checked_in` | "Habit check-in recorded" | No |

**Note:** Habits are standalone models (not anchored to `Entry`). `EntryActivity` rows are not created in this arc. Feed-level habit event emission is deferred to Arc 23E, which will design a safe feed event model for habit actions. No private athlete data is exposed through these action labels.

---

## Privacy and Visibility

Habit completion notes are treated as sensitive personal data by default:
- Only the athlete and org admin can see per-completion notes.
- Coaches and guardians see summary only (count + streak).
- No habit or completion data is exposed through feed payloads in this arc.
- Archived habits do not appear in the default active list view.

---

## Files Changed

### Schema
- `prisma/schema.prisma`: Added `HabitFrequency`, `HabitStatus` enums; `Habit`, `HabitSchedule`, `HabitCompletion` models; back-relations on `Organization`, `Person`, `Team`

### Migration
- `prisma/migrations/20260528000000_arc23d_habit_model/migration.sql`: Additive migration — new tables, enums, FK constraints, and indexes only

### Authorization
- `lib/habits/access.ts` *(new)*: `HabitAccessContext`, `resolveHabitAccessContext`, `hasHabitAdminAccess`, `canCreateHabit`, `canReadHabit`, `canEditHabit`, `canArchiveHabit`, `canPauseHabit`, `canCheckInHabit`, `canReadCompletionDetail`

### Policy / Display
- `lib/habits/policy.ts` *(new)*: `labelForHabitStatus`, `labelForHabitFrequency`, `badgeVariantForHabitStatus`, `normalizeCompletedOn`, `computeCurrentStreak`, `computeCompletionCount`, `deriveSafeHabitActivityText`

### Activity & Feed
- `lib/operational-entry/types.ts`: Added `HABIT_CREATED`, `HABIT_UPDATED`, `HABIT_ASSIGNED`, `HABIT_ARCHIVED`, `HABIT_PAUSED`, `HABIT_RESUMED`, `HABIT_CHECKED_IN` action constants
- `lib/operational-feed/render.ts`: Added feed labels for the seven new habit activity actions

### Habit UI
- `app/(dashboard)/habits/page.tsx` *(new)*: Habit list — active/paused/archived/all filter, check-in count, status badge, mobile-friendly table
- `app/(dashboard)/habits/create/page.tsx` *(new)*: Create habit form — title, description, athlete, team, recurrence fields
- `app/(dashboard)/habits/create/save/route.ts` *(new)*: POST — create Habit and optional HabitSchedule
- `app/(dashboard)/habits/[habitId]/page.tsx` *(new)*: Detail page — metadata, current streak, completion count, inline check-in form, completion history (detail gated by role)
- `app/(dashboard)/habits/[habitId]/edit/page.tsx` *(new)*: Edit habit form
- `app/(dashboard)/habits/[habitId]/edit/update/route.ts` *(new)*: POST — update Habit; upsert/delete HabitSchedule
- `app/(dashboard)/habits/[habitId]/archive/route.ts` *(new)*: POST — set status ARCHIVED
- `app/(dashboard)/habits/[habitId]/pause/route.ts` *(new)*: POST — toggle PAUSED / ACTIVE
- `app/(dashboard)/habits/[habitId]/check-in/route.ts` *(new)*: POST — create HabitCompletion; duplicate same-day check-in rejected with redirect

### Tests
- `tests/habits/access-policy.test.ts` *(new)*: 34 unit tests covering all `access.ts` helpers — admin/coach/athlete/guardian/unauthenticated boundary cases

---

## Deferred Scope (Arc 23E+)

The following items are explicitly NOT included in Arc 23D:

- **EntryActivity for habit events** — Feed-level habit event emission requires a safe anchor model design. Deferred to Arc 23E.
- **Guardian-safe feed integration** — Explicit guardian visibility gating in feed/activity surface. Arc 23E.
- **Bulk habit assignment** — Assigning a habit to all members of a team at once. Future arc.
- **Habit templates** — Reusable habit definitions for quick setup. Future arc.
- **Advanced recurrence engine** — RRULE-based recurrence, skip dates, exception logic. Future arc.
- **Habit reminders** — Push/email/SMS reminders before scheduled check-in time. Explicitly excluded per Arc 23 scope.
- **AI habit recommendations** — No ML/LLM integration. Explicitly excluded.
- **Readiness scoring from habit streaks** — Cross-domain readiness surface. Arc 23G.
- **Mood/sentiment analysis** — No response analysis in this arc.
- **Wearable/device integrations** — No external data ingest.
- **Advanced analytics/export** — No habit analytics dashboard.
- **Coach review workflow** — Structured coach review of athlete habit progress. Future arc.
- **Offline habit completion with sync** — No offline mode.
- **Habit version history** — No audit trail for habit edits. Future arc.

---

## Database Migration

Arc 23D adds three new tables (`Habit`, `HabitSchedule`, `HabitCompletion`) and two new enums (`HabitFrequency`, `HabitStatus`). All existing rows remain valid. Migration command:

```
npx prisma migrate deploy
```

No existing data is modified or dropped.
