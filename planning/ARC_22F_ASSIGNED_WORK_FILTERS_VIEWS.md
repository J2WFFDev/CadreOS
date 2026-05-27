# Arc 22F — Assigned Work, Filters, Today/Upcoming, and Role-Aware Views

## Purpose

Arc 22F hardens the operational Entry views so users can reliably see the work and
information that matters to them by assignment, due date, status, role, relationship,
and context.

This arc is additive and migration-safe:

- no external email/SMS/push delivery
- no full Communications runtime build
- no Journals/Habits runtime build
- no broad destructive schema rewrites
- no breaking changes to existing Entry creation, Inbox, detail, linking, workflow,
  activity feed, MemberOps, GearOps, ResourceOps, dashboard, notes, or tasks

---

## Operational View Model (Arc 22F)

### Inbox (`/entries/inbox`)

- Captures raw, unprocessed entries routed through `InboxRoutingItem`.
- Items with `status = OPEN` and `subjectRefType = ENTRY` appear here.
- An empty inbox means all captures have been processed or routed.
- Staff with at least READ entry access may view the inbox.

### Feed (`/feed`)

- Role-aware timeline of relevant operational activity for the current session.
- Composed of four lanes: Inbox, Assigned to me, Today & Overdue, Upcoming.
- A fifth section shows recent `EntryActivity` events.
- Activity visibility is role-gated by existing Entry access controls.
- Inaccessible linked records are shown with restricted/unavailable placeholders.

### Today (`/today`)

- Shows entries with `dueDate < tomorrow UTC midnight` and `status` in
  (`OPEN`, `IN_PROGRESS`), for `type` in (`TASK`, `FOLLOW_UP`, `READINESS_ITEM`).
- All overdue items also appear here.
- Assignee name is displayed for each row.
- Quick Complete action is available inline.

### Upcoming (`/upcoming`)

- Shows entries with `dueDate` in the next 14 days (tomorrow through tomorrow + 14d).
- Same type and status restrictions as Today.
- Assignee name is displayed for each row.

### Assigned to Me (`/assigned`)

- Dedicated view showing all **active** entries assigned to the current user.
- Matches on `assignedToPersonId` (legacy scalar) and the `EntryAssignment` join table.
- Returns an empty state when the user's account is not yet linked to a Person.
- Uses the same `OPEN`/`IN_PROGRESS` status filter as Today and Upcoming.
- Quick Complete action is available inline.
- Requires at least READ entry access.

### All Entries (`/entries`)

- Full filterable list of all entries in the organisation.
- Filters: type, status, priority, assignee (including "Assigned to me" shorthand),
  due window (all / overdue / today / upcoming / no due date), sort order.
- Assignee name column added.
- Overdue due dates are highlighted in red.
- Active filter count badge shown when filters are applied.
- Clear filters link appears when any filter is active.
- Requires at least READ entry access.

---

## Filter Behaviour

### Due window filter

| Value      | Includes                                       |
|------------|------------------------------------------------|
| `all`      | No dueDate restriction                         |
| `overdue`  | `dueDate < today UTC midnight`                 |
| `today`    | `dueDate >= today midnight AND < tomorrow midnight` |
| `upcoming` | `dueDate >= tomorrow midnight AND < +14 days`  |
| `no_date`  | `dueDate IS NULL`                              |

### Assignee filter

- "Assigned to me" resolves to the current actor's personId server-side.
- The raw value `"me"` is never sent to the database — it is resolved before query execution.
- Selecting a specific person filters on `assignedToPersonId`.

### Sort order

| Value          | Behaviour                                    |
|----------------|----------------------------------------------|
| `updated_desc` | Most recently updated first (default)        |
| `due_asc`      | Earliest due date first                      |
| `created_desc` | Newest created first                         |
| `priority_desc`| Highest priority first                       |

---

## Role-Aware Visibility

### Access level model

Access is resolved by `resolveEntryAccess` in `lib/operational-entry/authorization.ts`.

| Role                                           | Access level |
|------------------------------------------------|--------------|
| `ORGANIZATION_ADMIN` (org scope)               | MANAGE       |
| `PROGRAM_DIRECTOR` (org scope)                 | MANAGE       |
| `COACH`, `ASSISTANT_COACH`                     | WRITE        |
| Any other role with a role assignment          | READ         |
| No role assignment / guardian-only / unauthenticated | NONE   |

### Per-view behaviour

- **MANAGE / WRITE / READ**: Full access to entry views and filters. Feed shows org-wide entries.
- **NONE**: Blocked at view level with an explicit error message. No counts, lists, or labels are exposed.
- **Guardians**: Guardian users who have no staff role receive NONE access on all Entry views. They cannot infer hidden entries through counts or filter results.

### Coach scope note

Coaches currently see all active entries in the organisation. Team-scoped entry
restriction is not yet implemented. This is consistent with the existing read model
and is deferred to a future arc.

### Inactive/archived member context

Active views (`today`, `upcoming`, `assigned`, `feed`) apply `deletedAt: null` and
active-status filters. Entries linked to archived persons still appear if the entry
itself is active. Archived member context is not surfaced in the list columns.

---

## FeedEntryItem Enrichment (Arc 22F)

`FeedEntryItem` now includes:

```typescript
assignedTo: { firstName: string; lastName: string } | null;
```

This is populated from the `Entry.assignedTo` Prisma relation (Person) and is used
to render assignee names directly in Today, Upcoming, Assigned, Feed, and All Entries
tables without a secondary lookup.

---

## Pure Filter Helpers (`lib/operational-feed/filters.ts`)

Arc 22F extracts the following pure, testable helpers:

- `parseEntryListFilter` — validates and sanitises URL filter params.
- `buildDueWindowWhere` — returns a Prisma `dueDate` WHERE fragment for a given window.
- `buildEntryOrderBy` — returns a Prisma `orderBy` array for a given sort param.

These are exported from `lib/operational-feed/index.ts`.

---

## Deferred Scope

The following are **explicitly out of scope** for Arc 22F:

- Advanced saved filters and filter presets
- Custom dashboards
- Bulk actions on entry lists
- Kanban view
- Calendar view
- Recurring work scheduling
- Offline capture
- Push/email/SMS notifications
- AI prioritisation
- Analytics/export
- Team-scoped coach entry restriction
- Linked person/team context filter on entry lists (beyond assignee)
- Guardian read access for permitted athlete entries

---

## Recommended Next Arc

**Arc 22G — Entry Closeout, Auth Audit, QA, Seed Data, and Documentation**

Primary objective: final QA pass on all Entry views, authorization audit against the
permission matrix, seed data coverage for operational views, and documentation
finalization before Entry domain closeout.
