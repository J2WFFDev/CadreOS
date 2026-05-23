# Phase 8O — Operational Edge-Case Hardening and Workflow Stability Review

## Objective

Perform operational edge-case hardening and workflow stability review across the current CadreOS MVP foundation. This phase focuses on consistency, integrity, and stability of existing workflows — without introducing new major features, automation, notifications, or schema changes.

## Scope Constraints

- **Not in scope**: messaging, notifications, Feed, Journal, Entry migration, FieldOps expansion, workflow automation/orchestration, advanced analytics, parent-facing portals, schema redesign, new major dependencies.
- **In scope**: edge-case detection improvements, label/status consistency, empty-state improvements, code deduplication, and documentation of known limitations.

---

## Code Changes

### 1. Shared `isUnresolvedTaskStatus` Export (`lib/follow-up-tasks.ts`)

**Problem**: `isUnresolvedTaskStatus` was defined independently in three separate files:
- `app/(dashboard)/tasks/page.tsx`
- `app/(dashboard)/teams/[teamId]/page.tsx`
- `app/(dashboard)/people/[personId]/page.tsx`

Each used the same logic (`status === OPEN || IN_PROGRESS || BLOCKED`). Divergence risk was real if one instance was updated and others were not.

**Fix**: Exported `isUnresolvedTaskStatus` from `lib/follow-up-tasks.ts`. Updated the three files to import from the shared location and removed their local definitions.

---

### 2. Tasks Page Filtered Empty State Consistency (`app/(dashboard)/tasks/page.tsx`)

**Problem**: The tasks list page used a plain `<div>` for the filtered-view empty state, while the notes and events pages both used the shared `<EmptyState>` component with a "Clear filters" action link.

**Fix**: Replaced the plain `<div>` with `<EmptyState>` (consistent with notes and events pages), including:
- `"No follow-up tasks match the selected filters."` message when filters are active, with "Clear filters" action linking to `/tasks`.
- `"No follow-up tasks have been created yet."` message when no filters are active, with "Create the first task" action.

---

### 3. Context-Free Note Indicator (`app/(dashboard)/notes/page.tsx`, `app/(dashboard)/notes/[noteId]/page.tsx`)

**Problem**: Notes with no athlete, no team, and no event are "context-free" — they carry no operational linking context. These were previously invisible in the notes list; there was no indicator that a note lacked all three context fields.

**Fix**:
- In the **notes list**: Added a `"No context"` badge in the operational indicator column for notes where all of `athlete`, `team`, and `event` are null.
- In the **note detail page**: Added a `"Context-free note — no athlete, team, or event linked"` badge in the operational status section when all three context fields are absent.

This is a hardening-only change: it surfaces a known edge case for staff review without altering data or behavior.

---

### 4. Orphaned Workflow State Indicator (`app/(dashboard)/tasks/[taskId]/page.tsx`)

**Problem**: A task that is `BLOCKED` but has no source note, no source event, and no source inbox item represents an "orphaned workflow state" — it is blocked with no traceable operational context to explain why. This is the highest-risk unresolved task state but was not specifically called out.

**Fix**: Added derivation of `isOrphanedWorkflowState` (BLOCKED + unresolved + no source context) and a `"Orphaned workflow state — blocked with no source context"` badge in the task status display when this condition is true.

---

## Known Workflow Limitations (Documented)

### ObservationNote Model
- Notes use the `ObservationNote` model. A unified Entry/Inbox model is planned for future phases but intentionally deferred.
- Notes cannot currently be linked to multiple athletes or teams in a single record.
- Notes have no expiry, archival, or feed visibility mechanism. All notes remain visible to staff indefinitely.

### FollowUpTask Model
- Tasks have a single assignee (required). Unassigned tasks are not possible by schema design.
- Task state transitions are manual — no automation, reminders, or escalation.
- Tasks with `BLOCKED` status and no source context are valid by schema but represent an orphaned workflow state that requires manual staff review.
- The `updatedAt` timestamp is used as a proxy for "last activity" since a dedicated `lastUpdatedByPersonId` field is deferred.

### Event and Attendance
- Expected attendance is derived from the team roster at query time. Roster changes after an event do not retroactively affect attendance coverage calculations.
- Attendance capture is manual and all-or-nothing per record. Partial attendance is detected at the list level by comparing captured vs. expected counts.
- Events with no team assigned have `not_applicable` or `captured` attendance coverage states. Attendance data can still be manually added without a team roster.

### Guardian Relationship
- Guardian relationship details (AthleteGuardianRelationship) are staff-gated only. Non-staff users see no guardian diagnostic information.
- Guardian authorization for note/task visibility is intentionally deferred to a future phase. No guardian-accessible views exist in the current MVP.
- Guardian person records are Person-first. UserAccount linking is optional and not required to create a guardian relationship.

### Dashboard and Review Workflows
- Dashboard operational summaries are derived from snapshot queries at page load time. There is no real-time update or push mechanism.
- Stale state detection uses fixed time windows (configurable as constants per page). These windows are heuristic only and not user-configurable.

### Feed, Journal, Entry Migration
- `Feed`, `Journal`, and `Entry` runtime behavior are intentionally **not** implemented in the current MVP.
- The `ObservationNote` model is the current primary record for coaching observations.
- Entry migration is deferred to a post-MVP phase. Any InboxItem references in the current codebase are schema-present but UI behavior is minimal.

### FieldOps
- FieldOps workflows (bookings, resources, facilities, conflicts) are complete as of Phase 6K and intentionally unchanged in Phase 8O and later.

---

## Intentionally Deferred Architecture Work

| Area | Deferred Work |
|------|---------------|
| Entry/Inbox | Unified Entry model migration from ObservationNote |
| Feed runtime | Feed visibility and routing behavior |
| Guardian authorization | Role-based note/task access for guardian users |
| Reminders | Automated reminders for stale tasks or unreviewed attendance |
| Notifications | Push or email notifications of any kind |
| Real-time updates | WebSocket or polling for live dashboard data |
| Audit trail | Full audit log with actor/timestamp on all state changes |
| Multi-assignee tasks | Tasks with multiple responsible parties |
| Task escalation | Automatic status changes based on elapsed time or conditions |
| Parent-facing portal | Any UI for guardian/parent users |
| AI/ML recommendations | No recommendation or classification systems |

---

## Validation Performed

- `npm run typecheck` — passes with no errors after all changes.
- `npm run lint` — passes with no errors.
- Organization scoping preserved: all queries use `organizationId: scope.organizationId`.
- Workflow continuity verified: back-link navigation, filter state preservation, and empty state handling all confirmed for notes, tasks, events, teams, and people workflows.
- ObservationNote and FollowUpTask workflows function correctly.
- Event/Attendance workflows function correctly.
- Dashboard/review workflows function correctly.
- No Entry migration work added.
- No messaging/notification behavior added.
- No FieldOps functionality changed.

---

## Summary

Phase 8O hardened four specific operational edge cases that were previously invisible or inconsistently handled:

1. `isUnresolvedTaskStatus` is now a shared export — no longer duplicated across three pages.
2. Tasks page filtered empty state now uses `EmptyState` consistently with notes and events pages.
3. Context-free notes (no athlete, team, or event) are now visually flagged in the list and detail views.
4. Orphaned workflow states (BLOCKED tasks with no source context) are now explicitly called out in the task detail.

Documentation was added to clarify known limitations, deferred architecture work, and MVP stability boundaries.
