# Arc 19B — Unified Feed & Today View

## Status

**Active** — Operational feed service layer, feed page, and Today/Upcoming refresh.

---

## Background

Arc 19A established the Unified Operational Entry Architecture — schema, service layer, authorization, and type definitions. Arc 19B builds the first operational runtime experience on top of that foundation.

The goal is a lightweight, fast operational awareness surface that gives staff a real-time view of what needs action: what's assigned to them, what's due today, what's coming up, and what's recently happened.

---

## Goals

- **Today view** — overdue and due-today operational items across all active entry types
- **Assigned to me** — entries assigned to the current actor via scalar or EntryAssignment
- **Upcoming items** — operational items due in the next 14 days
- **Recent operational activity** — last 20 EntryActivity records, rendered with human-readable labels
- **Lightweight operational feed** — a single `/feed` page aggregating all four sections
- **Cross-module visibility** — entries from all TASK, FOLLOW_UP, and READINESS_ITEM types

---

## What Was Built

### Service layer (`lib/operational-feed/`)

New canonical module for feed query architecture. Designed to be the authoritative location for operational awareness queries going forward.

#### `lib/operational-feed/types.ts`

- `ACTIVE_OPERATIONAL_TYPES` — `["TASK", "FOLLOW_UP", "READINESS_ITEM"]` — the entry types eligible for Today/Upcoming sections
- `ACTIVE_FEED_STATUSES` — `["OPEN", "IN_PROGRESS", "BLOCKED"]` — statuses shown in feed sections
- `DEFAULT_UPCOMING_DAYS` — `14` — the upcoming window length
- `FeedEntryItem` — minimal entry projection for feed lists
- `FeedActivityItem` — activity record projection including resolved entry title
- `FeedQueryContext` — context type passed to feed query functions (includes `now` and `upcomingDays` overrides for testability)
- `TodayWindow`, `UpcomingWindow` — time window types
- `OperationalFeedResult` — aggregated feed result type

#### `lib/operational-feed/queries.ts`

Pure helpers (fully tested):
- `computeTodayWindow(now)` — returns UTC midnight boundaries for today and tomorrow
- `computeUpcomingWindow(now, days?)` — returns `{ from, to }` for the upcoming window
- `isOverdueEntry(dueDate, now)` — returns true if dueDate is before today UTC midnight

Async DB query functions:
- `queryTodayEntries(ctx)` — entries with `dueDate < tomorrowStart`, active statuses, active operational types
- `queryAssignedEntries(ctx)` — entries assigned to `actorPersonId` via `assignedToPersonId` OR `EntryAssignment.personId` (with `revokedAt = null`)
- `queryUpcomingEntries(ctx)` — entries with `dueDate in [tomorrowStart, tomorrowStart + N days)`, active statuses, active operational types
- `queryRecentActivity(ctx, limit?)` — most recent EntryActivity records with resolved entry titles
- `aggregateOperationalFeed(ctx)` — runs all four queries in parallel and returns `OperationalFeedResult`

#### `lib/operational-feed/render.ts`

Pure rendering helpers (fully tested, no DB or React dependencies):
- `labelForEntryType(type)` — human-readable entry type labels
- `labelForEntryStatus(status)` — human-readable status labels
- `labelForEntryPriority(priority)` — human-readable priority labels
- `labelForActivityAction(action)` — human-readable activity action labels (maps ENTRY_ACTIVITY_ACTIONS strings)
- `formatDueDate(dueDate, dueTime)` — combined due date/time display string
- `isOverdueFeedEntry(dueDate, now)` — overdue check (matches query logic)

---

### UI

#### `/feed` — New Unified Operational Feed Page

New page at `app/(dashboard)/feed/page.tsx` with four sections:

1. **Assigned to me** — shown only when `actorPersonId` is resolved; entries assigned via scalar or EntryAssignment
2. **Today & Overdue** — entries due today or overdue, all active operational types
3. **Upcoming** — entries due in the next 14 days
4. **Recent Activity** — last 20 EntryActivity records with human-readable action labels and entry links

Each entry row shows: Title (linked to entry detail), Type, Due (red + "overdue" badge if overdue), Priority, Status, and a "Complete" quick-action button.

Activity feed shows: timestamp, action label, entry title (linked).

#### `/today` — Refreshed

Updated to use `queryTodayEntries` from `lib/operational-feed`. Now shows TASK, FOLLOW_UP, and READINESS_ITEM entries (previously TASK-only). Adds a "Type" column. Overdue entries are highlighted in red with an "overdue" badge.

#### `/upcoming` — Refreshed

Updated to use `queryUpcomingEntries` from `lib/operational-feed`. Now shows TASK, FOLLOW_UP, and READINESS_ITEM entries with a 14-day window (previously TASK-only, no upper bound). Adds a "Type" column.

#### Navigation

Added **Feed** link to `NavSidebar` positioned immediately after Dashboard as a primary operational entry point.

---

### Tests

#### `tests/operational-feed/window-computation.test.ts`

11 tests covering:
- `computeTodayWindow` — UTC boundary correctness, month and year rollover
- `computeUpcomingWindow` — window start, length, custom days, default days
- `isOverdueEntry` — null handling, past date, today, future date

#### `tests/operational-feed/render-helpers.test.ts`

19 tests covering:
- `labelForEntryType` — all 10 known types, unknown type fallback
- `labelForEntryStatus` — all known statuses
- `labelForEntryPriority` — all four priority levels
- `labelForActivityAction` — known actions, unknown action fallback
- `formatDueDate` — null date, date only, date + time
- `isOverdueFeedEntry` — null date, past date, today

**Total tests: 30 (7 pre-existing + 23 new) — all passing.**

---

## Query Architecture

### Today query

```
Entry WHERE:
  organizationId = org
  type IN [TASK, FOLLOW_UP, READINESS_ITEM]
  deletedAt = null
  status IN [OPEN, IN_PROGRESS, BLOCKED]
  dueDate < tomorrowStart (UTC midnight)
ORDER BY dueDate ASC, priority DESC, updatedAt DESC
LIMIT 100
```

### Assignment query

```
Entry WHERE:
  organizationId = org
  deletedAt = null
  status IN [OPEN, IN_PROGRESS, BLOCKED]
  (assignedToPersonId = actorPersonId)
  OR (assignments.some: personId = actorPersonId AND revokedAt = null)
ORDER BY dueDate ASC, priority DESC, updatedAt DESC
LIMIT 50
```

The `OR` clause covers both the legacy scalar assignee (Arc 18 and earlier) and the Arc 19A `EntryAssignment` multi-assignee model. Both assignment paths are honored simultaneously.

### Upcoming query

```
Entry WHERE:
  organizationId = org
  type IN [TASK, FOLLOW_UP, READINESS_ITEM]
  deletedAt = null
  status IN [OPEN, IN_PROGRESS]
  dueDate >= tomorrowStart
  dueDate < tomorrowStart + 14 days
ORDER BY dueDate ASC, priority DESC
LIMIT 100
```

BLOCKED entries are excluded from Upcoming since they are stalled and should not appear as "coming up." They appear in Today if overdue.

### Activity query

```
EntryActivity WHERE:
  organizationId = org
ORDER BY createdAt DESC
INCLUDE entry.title
LIMIT 20
```

---

## Visibility Rules

All feed queries are organization-scoped. No cross-org data leaks.

Visibility filtering (`EntryVisibility`) is not applied at the query level — all entries visible to organization staff are shown. This matches the existing behavior in `/today`, `/upcoming`, and `/entries` pages (STAFF_ONLY is the default and current only visibility class in use).

Future visibility enforcement (e.g., TEAM_STAFF scope) can be added to `queryTodayEntries` and related functions as additional where clauses without breaking the established query interface.

---

## What Was Intentionally Deferred

- **Notification compatibility hooks** — the `FeedQueryContext.now` override is designed to support future notification scheduling (e.g., querying tomorrow's feed at midnight), but no dispatch is wired
- **Team name resolution** — `teamId` is included in `FeedEntryItem` but not resolved to a display name; team context column is deferred to a future Arc
- **Assignee name resolution** — `assignedToPersonId` is included but person name lookup is deferred
- **Feed persistence / saved filters** — no per-user feed preferences
- **Pagination** — feed sections use take limits (50–100); cursor-based pagination deferred
- **Mobile-specific layout** — the feed is table-based, responsive improvements deferred
- **Comment / reminder indicators** — counts not shown in feed rows yet

---

## Preserved Behavior

All existing behavior is preserved:

- `lib/entries/service.ts` — unchanged
- `app/(dashboard)/entries/` — all routes unchanged
- `app/(dashboard)/decisions/` — unchanged
- All FieldOps, GearOps, Roster Lifecycle, Reporting — unchanged
- All 7 pre-existing tests — still pass

---

## Next Steps (Arc 19C+)

1. **Arc 19C** — EntryObjectLink UI: linked-object panel on entry detail
2. **Arc 19D** — EntryAssignment multi-assignee UI and assignment panel
3. **Arc 19E** — EntryStatusHistory visualization on entry detail
4. **Arc 19F** — EntryComment activation
5. **Arc 19G** — EntryReminder activation
