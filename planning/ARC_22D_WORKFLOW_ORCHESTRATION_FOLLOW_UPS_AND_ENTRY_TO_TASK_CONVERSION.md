# Arc 22D — Workflow Orchestration, Follow-Ups, and Entry-to-Task Conversion

## Purpose

Arc 22D hardens workflow behavior so Entry capture can reliably produce follow-up action while preserving source context.

This arc remains additive and migration-safe:

- no broad destructive schema rewrites
- no Journals/Habits runtime build
- no full Communications runtime build
- no advanced automation or AI triage

## Entry Workflow Model (Arc 22D Contract)

- Entry may begin as raw capture in Inbox.
- Entry may remain informational, become actionable, or produce one or more follow-up tasks.
- `FollowUpTask` remains the actionable task model for task screens.
- Entry status represents Entry lifecycle context and should not silently replace task status semantics.
- Entry-to-task conversion and follow-up creation must retain source Entry context.
- Completing follow-up work must not delete or auto-hide the source Entry.
- Workflow behavior remains role-aware and authorization-gated.

## Workflow Behavior Implemented in Arc 22D

### Follow-up creation from Entry

- Entry detail now includes a low-risk **Create follow-up** action.
- Follow-up creation supports title, description, assignee, due date, and priority.
- Follow-up task creation links to a dedicated follow-up Entry wrapper (`Entry.type=FOLLOW_UP`).
- Follow-up Entry wrapper links back to source Entry through `parentEntryId`.

### Source context preservation

- Follow-up Entry wrappers preserve source Entry context through parent linkage.
- Source Entry retains its own lifecycle/status and remains available after follow-up completion.
- Entry activity records capture follow-up creation on both source and follow-up entries.

### Entry detail follow-up visibility

- Entry detail now surfaces follow-ups derived from that Entry.
- Follow-up list shows task status, assignee, due state, priority, and direct links to task/entry detail.
- Empty and completed-state counters are explicit for operational clarity.

### Task back-link to source Entry

- Task detail now shows a source-entry backlink when the linked task entry has a parent source entry.
- Link behavior is safe (no hidden data expansion beyond task-view context).

## Status and Operational Views

- Follow-up Entry wrappers use active Entry statuses (`OPEN` / `IN_PROGRESS`) and close statuses (`DONE` / `CANCELLED` / `ARCHIVED`) already supported in schema.
- Existing Today/Upcoming/Assigned feed queries already include `FOLLOW_UP` entry type in active windows.
- Due and assignment visibility for Arc 22D follow-ups is therefore available through existing feed lanes where supported.

## Authorization and Visibility Notes

- Follow-up creation from Entry requires existing `entry.update` + `task.create` permissions.
- Follow-up assignee must resolve to a person in the active organization.
- Existing task visibility/role boundaries remain authoritative for follow-up task views.
- Source entry links from task detail are limited to existing linked parent-entry context.

## Manual QA

Use `ARC_22D_ENTRY_WORKFLOW_VALIDATION_CHECKLIST.md`.

## Deferred Scope (Explicit)

- multi-step workflow templates UI and lifecycle tooling
- recurring tasks/workflow scheduling
- approval chains
- dependency graphs
- automation rules and trigger orchestration
- AI triage and prioritization
- notification channel delivery
- Journal/Habit workflows
- external integrations

## Recommended Next Arc

**Arc 22E — Activity Feed and Notification-Ready Events**

Primary objective: harden activity event consistency, feed-level traceability, and notification-ready event contracts on top of Arc 22D follow-up orchestration.
