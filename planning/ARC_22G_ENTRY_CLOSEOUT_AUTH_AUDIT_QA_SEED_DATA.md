# Arc 22G — Entry Closeout, Auth Audit, QA, Seed Data, and Documentation

## Purpose

Arc 22G closes the Entry domain for Release 1 by:

- Validating that all Arc 22A–22F deliverables are consistent and documented.
- Performing an authorization and visibility audit against the Entry permission matrix.
- Providing a complete manual QA checklist covering all roles and scenarios.
- Adding seed/test data for operational Entry views.
- Adding focused regression tests for pure filter and auth helpers.
- Confirming deferred scope for future arcs.
- Recommending Arc 23 — Journals & Habits as the next build arc.

This arc is a closeout, audit, QA, and documentation arc:

- no new Entry features
- no Journals or Habits runtime build
- no Communications delivery (email/SMS/push)
- no advanced automation, AI triage, recurring habits, or journal prompts
- no broad destructive schema rewrites
- no breaking changes to MemberOps, GearOps, ResourceOps, dashboard, notes, or tasks

---

## Entry Domain Model — Canonical Definitions

| Concept | Definition |
|---------|-----------|
| **Entry** | The single operational capture record for notes, tasks, decisions, follow-ups, observations, and operational activity. All domain capture converges on the `Entry` model. |
| **Inbox** | Low-context capture queue. Entries with no due date and no context target are routed to the Inbox via `InboxRoutingItem`. Staff process the inbox by routing entries into context. |
| **Feed** | Role-aware operational timeline composed of four lanes (Inbox, Assigned, Today & Overdue, Upcoming) plus a recent `EntryActivity` section. Activity visibility is role-gated. |
| **EntryActivity** | Structured activity event recording what happened to an Entry (created, updated, status changed, linked, follow-up created/assigned/completed, etc.). It is **not** a notification delivery mechanism. It is notification-ready: a future notification layer can subscribe to activity events without schema changes. |
| **FollowUpTask** | An actionable follow-up derived from an Entry via the "create follow-up" workflow. Bridges the legacy `FollowUpTask` model and the Entry model via `sourceTaskId`. |
| **EntryLink** | Entry-to-Entry relationship. Used for threading, chaining, and operational graph links between Entry records. |
| **EntryObjectLink** | Relationship from an Entry to any operational object (Person, Team, Event, GearItem, ResourceBooking, etc.) identified by `targetType` + `targetId`. |
| **Assigned-to-me** | Personal work/action view (`/assigned`). Shows all active Entries where `assignedToPersonId` matches the current actor's Person record. |
| **Today / Upcoming** | Due-date-aware work views. Today shows entries due today or overdue; Upcoming shows entries due in the next 14 days. Both filter to active-status actionable entry types (TASK, FOLLOW_UP, READINESS_ITEM). |

---

## Arc 22A–22F Completion Summary

| Arc | Title | Status |
|-----|-------|--------|
| Arc 22A | Entry Inventory, Stabilization, and Gap Plan | ✅ Complete |
| Arc 22B | Quick Capture, Inbox, and Entry Creation Hardening | ✅ Complete |
| Arc 22C | Entry Detail, Linking, and Operational Graph Foundation | ✅ Complete |
| Arc 22D | Workflow Orchestration, Follow-Ups, and Entry-to-Task Conversion | ✅ Complete |
| Arc 22E | Activity Feed and Notification-Ready Events | ✅ Complete |
| Arc 22F | Assigned Work, Filters, Today/Upcoming, and Role-Aware Views | ✅ Complete |
| Arc 22G | Entry Closeout, Auth Audit, QA, Seed Data, and Documentation | ✅ This arc |

---

## Authorization and Visibility Audit

### Access Level Model

Access is resolved by `resolveEntryAccess` in `lib/operational-entry/authorization.ts`.

| Role | Access level | Notes |
|------|-------------|-------|
| `ORGANIZATION_ADMIN` (org scope) | MANAGE | Full create/update/delete/restore |
| `PROGRAM_DIRECTOR` (org scope) | MANAGE | Full create/update/delete/restore |
| `COACH`, `ASSISTANT_COACH` | WRITE | Can create and update; cannot delete |
| Any other role assignment | READ | Read-only access (rare on Entry views) |
| Guardian-only / no staff role | NONE | Blocked at view level |
| Unauthenticated | NONE | Blocked at view level |

### Per-View Authorization Enforcement

| View | Required level | NONE behaviour |
|------|---------------|----------------|
| `/entries` | READ | Explicit error message. No counts, labels, or IDs exposed. |
| `/entries/inbox` | READ | Explicit error message. |
| `/entries/[id]` | READ | Explicit error message. |
| `/feed` | READ | Explicit error message. |
| `/today` | READ | Explicit error message. |
| `/upcoming` | READ | Explicit error message. |
| `/assigned` | READ | Explicit error message. |
| `/entries/quick-add` | WRITE | Explicit error message. |
| Entry create routes | WRITE | 403 response. |
| Entry delete/restore routes | MANAGE | 403 response. |

### Inaccessible Linked Object Handling

All views that render linked object names (e.g., linked Person or Team in `EntryObjectLink`) must display a safe placeholder when the linked record is inaccessible or deleted:

- **Required placeholder text:** `"[Restricted]"` or `"[Unavailable]"`
- **Implementation:** `lib/operational-feed/render.ts` — `renderLinkedObjectName`
- **Audit note:** Inaccessible linked objects must not leak the target ID, name, or type through any rendered label, tooltip, or aria attribute.

### Guardian Visibility Policy

Guardians who have no staff role assignment receive `NONE` access on all Entry views:

- They see an authorization error, not a blank page or empty list.
- They cannot infer the existence of hidden entries through counts, filter results, error text, linked names, or IDs.
- A guardian's athlete entries are not exposed through the Entry feed, even if linked via `EntryObjectLink` with `targetType = PERSON`.
- Staff-only entries (`visibility = STAFF_ONLY`) are never reachable by guardian users.
- Guardian read access for permitted athlete entries is deferred to a future arc.

### Coach Scope Note

Coaches currently see all active entries in the organisation. Team-scoped entry restriction is deferred:

- **Deferred item:** Coach entry visibility scoped to own teams only.
- No test required for team-scoped restriction in this arc.

### Inactive / Archived Member Context

Active views (`/today`, `/upcoming`, `/assigned`, `/feed`) apply `deletedAt: null` and active-status filters at the Entry level. Entries linked to archived persons still appear if the entry itself is active. Archived member context is not surfaced in list columns.

### Protected Data Leakage Prevention

The following surfaces must not leak restricted data:

- **Filter counts:** Active filter badge count must not change based on hidden entries.
- **Assignee column:** Must show `"[Unavailable]"` if the assigned person record is deleted or inaccessible.
- **Activity text:** `EntryActivity.details` must not include names or IDs of objects the current user cannot access.
- **Link names:** `EntryObjectLink` rendered labels must use placeholder text when target is restricted.
- **Error messages:** Auth error responses must not include entry IDs, titles, or counts.
- **URL params:** Filter results must not respond differently based on the presence of restricted entry IDs passed as params.

---

## Seed Data Coverage

Arc 22G adds the following Entry seed records to `prisma/seed.mjs`:

| Seed ID | Type | Description | Purpose |
|---------|------|-------------|---------|
| `cadreos-entry-inbox-note` | NOTE | Minimal inbox capture | Inbox view test |
| `cadreos-entry-note-observation` | NOTE | Staff observation note | Note-style entry test |
| `cadreos-entry-task-open` | TASK | Open task no due date | Task entry test |
| `cadreos-entry-task-today` | TASK | Task due today | Today view test |
| `cadreos-entry-task-upcoming` | TASK | Task due in 7 days | Upcoming view test |
| `cadreos-entry-task-overdue` | TASK | Task with past due date | Overdue/Today view test |
| `cadreos-entry-followup-assigned` | FOLLOW_UP | Follow-up assigned to teamCoach | Assigned-to-me test |
| `cadreos-entry-followup-completed` | FOLLOW_UP | Completed follow-up | Completed state test |
| `cadreos-entry-decision` | DECISION | Recorded decision | Decision type test |
| `cadreos-entry-linked-athlete` | NOTE | Note linked to athlete via EntryObjectLink | Linking test |
| `cadreos-entry-linked-team` | NOTE | Note linked to team via EntryObjectLink | Linking test |
| `cadreos-entry-guardian-visible` | NOTE | Note linked to athlete, visibility ORGANIZATION_SCOPED | Guardian-visible test |
| `cadreos-entry-staff-only` | NOTE | STAFF_ONLY note | Guardian must-not-see test |
| `cadreos-entry-archived` | TASK | Archived/completed entry | Archived state test |

InboxRoutingItem records are seeded for inbox-routable entries (type NOTE, no due date, no context target).

---

## Regression Tests Added

### `tests/operational-feed/filters.test.ts`

Tests the pure filter helpers extracted in Arc 22F:

- `parseEntryListFilter` — validates enum sanitisation, unknown value handling, and `"me"` passthrough.
- `buildDueWindowWhere` — validates Prisma WHERE fragment for each due-window value.
- `buildEntryOrderBy` — validates orderBy array for each sort param.

### `tests/entries/auth-visibility.test.ts`

Tests the authorization helper contract:

- `meetsAccessLevel` — validates level ordering and boundary conditions.
- `resolveEntryAccess` logic contract (pure helper extraction only; no DB calls in tests).

---

## Manual QA Checklist

See `ARC_22G_ENTRY_QA_CHECKLIST.md` for the complete checklist covering all roles, scenarios, and negative access tests.

---

## Deferred Scope

The following items are explicitly **out of scope** for Arc 22 and all prior arcs. They are recorded here for roadmap planning.

### Journals & Habits (Arc 23)

- First-class JOURNAL entry type runtime support
- Journal prompt lifecycle and assignment
- Habit recurrence engine and streak tracking
- Journal/habit feed visibility controls
- Athlete journaling policy-aware feed

### Notification Delivery (future arc)

- In-app notification center
- Unread/read notification state
- Email delivery
- SMS delivery
- Push notifications
- Notification preference management

### Advanced Entry Features (future arc)

- Advanced saved filters and filter presets
- Kanban view
- Calendar view
- Recurring task engine
- Bulk actions on entry lists
- Offline capture
- Voice capture
- AI triage and auto-routing
- Automation rules
- Full audit export
- Team-scoped coach entry restriction
- Guardian read access for permitted athlete entries
- Coach restriction to own teams only

### Future Module Integration

- Entry-to-LiveOps/FieldOps deep linking
- Entry-to-Athlete Development plan integration
- Entry-to-Communications delivery
- Entry timeline in athlete development view

---

## Release 1 Foundation Readiness

The Entry domain is Release 1 ready as the operational capture, workflow, feed, and assigned-work foundation for:

| Consumer | Readiness |
|----------|-----------|
| Journals & Habits (Arc 23) | ✅ JOURNAL/HABIT entry types exist in schema; runtime UI deferred |
| LiveOps / FieldOps (Arc 24) | ✅ EntryObjectLink supports FACILITY, RESOURCE_BOOKING targets |
| ResourceOps (Arc 25) | ✅ EntryObjectLink supports GEAR_ITEM, GEAR_ASSIGNMENT targets |
| Communications (future) | ✅ EntryActivity is notification-ready; delivery deferred |
| Athlete Development (future) | ✅ Entry-to-Person linking exists; development plan UI deferred |

### Remaining Entry Blockers for Arc 23

None identified. The following foundations are in place:

- `Entry` schema with JOURNAL and HABIT types
- `EntryActivity` structured events
- Role-aware visibility (`resolveEntryAccess`)
- Inbox routing (`InboxRoutingItem`, `shouldRouteEntryToInbox`)
- Feed composition (Inbox, Assigned, Today, Upcoming, Activity lanes)
- Filter helpers (pure, tested, DB-free)
- Entry detail, editing, linking, and follow-up workflows

---

## Recommended Next Arc

**Arc 23 — Journals & Habits**

Primary objectives:
- Build the Journal entry runtime (create, list, detail, prompt-free MVP).
- Build the Habit entry runtime (create, list, check-in, streak display).
- Add feed visibility controls for Journal and Habit entries.
- Validate guardian-visible Journal entries for linked athletes where policy allows.
- No notification delivery in Arc 23.

---

## PR Summary

Arc 22G delivers:

1. **Closeout documentation** confirming all Arc 22A–22F deliverables are consistent.
2. **Authorization audit** with per-view access level table, guardian policy, and leakage-prevention notes.
3. **Seed data** covering all operational Entry scenarios needed for manual and automated QA.
4. **Regression tests** for filter helpers (`parseEntryListFilter`, `buildDueWindowWhere`, `buildEntryOrderBy`) and the `meetsAccessLevel` contract.
5. **Manual QA checklist** (`ARC_22G_ENTRY_QA_CHECKLIST.md`) covering admin, coach, guardian, and negative access scenarios.
6. **Deferred scope** list for roadmap planning.
7. **Roadmap update** marking Arc 22 complete and confirming Arc 23 as the next build arc.

No new features, no schema changes, no breaking changes.
