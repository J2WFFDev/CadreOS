# Arc 22A — Entry Completion Inventory, Stabilization, and Gap Plan

## Purpose

Arc 22A establishes the Release 1 baseline for the Entry domain after Arc 21 MemberOps completion.

This arc is inventory-first and stabilization-first:

- no broad destructive schema rewrites
- no breaking changes to notes/tasks/dashboard/MemberOps/GearOps/ResourceOps workflows
- no Journals/Habits runtime build in this arc
- no full Communications runtime build in this arc

## Roadmap Correction (Canonical)

Entry completion work is now tracked in **Arc 22**.

- Historical labels:
  - old 19C = Quick Capture
  - old 19D = Cross-Linking
  - old 19E = Workflow Orchestration
  - old 19F = Activity/Notification Integration
  - old 19G = Entry Closeout
- Canonical Release 1 mapping going forward:
  - **Arc 22A** — Inventory, stabilization, and gap plan (this document)
  - **Arc 22B** — Quick Capture / Inbox hardening
  - **Arc 22C** — Cross-Linking / Operational Graph hardening
  - **Arc 22D** — Workflow Orchestration / Follow-Up Chaining hardening
  - **Arc 22E** — Activity / Notification-ready integration hardening
  - **Arc 22F** — Entry detail, filters, and assigned-work hardening
  - **Arc 22G** — Entry closeout and release validation

Do not use Arc 19C–19G labels for new planning or implementation work.

## Current Entry Runtime Baseline (Arc 22A)

Current implementation already includes:

- `Entry`, `EntryLink`, `EntryObjectLink`, `EntryAssignment`, `EntryStatusHistory`, `EntryActivity`
- quick capture route and launcher (`/entries/quick-add`, `QuickCaptureLauncher`)
- feed/today/upcoming/assigned-to-me query stack (`lib/operational-feed`, `/feed`, `/today`, `/upcoming`)
- entry detail/edit/complete/delete/link/convert workflows
- Entry-to-Task and Entry-to-Note wrapper linkage (`sourceTaskId`, `sourceNoteId`)
- operational graph linking (`OperationalRelationship`) with entry activity side-effects
- notification awareness hooks for entry activity

## Arc 22A Inventory Outputs

Arc 22A output artifacts in this PR:

- `ARC_22A_ENTRY_INVENTORY_REPORT.md`
- `ARC_22A_ENTRY_VALIDATION_CHECKLIST.md`
- this Arc 22A roadmap + stabilization document

## Entry Domain Model (Release 1 Intended Direction)

### Entry

Operational capture record for staff workflows across notes/tasks/decisions/events/readiness/follow-up contexts.

### EntryType

Current enum includes:

- `TASK`, `NOTE`, `EVENT`, `DECISION`, `JOURNAL`, `HABIT`, `OBSERVATION`, `FOLLOW_UP`, `ACTIVITY`, `READINESS_ITEM`

Release 1 interpretation:

- operationally active now: `TASK`, `FOLLOW_UP`, `READINESS_ITEM`, `NOTE`, `DECISION`, `OBSERVATION`
- deferred runtime build in this arc: first-class journal/habit workflows

### EntryStatus

Current enum:

- `OPEN`, `IN_PROGRESS`, `DONE`, `CANCELLED`, `ARCHIVED`

Release 1 mapping intent:

- `OPEN`/`IN_PROGRESS` = active operational states
- `DONE` = completed
- `CANCELLED`/`ARCHIVED` = closed states

### FollowUpTask

Actionable child workflow model still exists and remains authoritative for existing task screens. `Entry.sourceTaskId` links Entry and FollowUpTask in the compatibility layer.

### EntryActivity

Audit/feed event stream used by feed, notifications, and operational awareness hooks.

### EntryLink + EntryObjectLink + OperationalRelationship

- `EntryLink`: Entry→Entry direct links
- `EntryObjectLink`: Entry→domain object contextual links
- `OperationalRelationship`: broader graph edges across module node types, including entries

### Inbox

- Quick capture and `InboxRoutingItem` support lightweight routing semantics today
- full inbox queue UX hardening remains Arc 22B scope

### Feed

- role-aware operational timeline currently exposed via `/feed` sections:
  - assigned to me
  - today/overdue
  - upcoming
  - recent activity

### Assigned-to-me

- currently backed by `Entry.assignedToPersonId` OR active `EntryAssignment` rows
- notification due-awareness lane uses the same assignment paths

## Arc 22A Gaps Organized for Arc 22B–22G

### Arc 22B — Quick Capture / Inbox

- strengthen inbox-first capture contracts and defaults
- harden assignee/context validation and fallback behavior
- formalize InboxRoutingItem linkage/triage behavior

### Arc 22C — Cross-Linking / Operational Graph

- unify operator mental model across EntryLink vs EntryObjectLink vs graph links
- improve linked-object discoverability on entry detail and feed surfaces
- add focused authorization regression coverage for link/unlink workflows

### Arc 22D — Workflow Orchestration / Follow-Up Chaining

- integrate workflow run visibility into entry detail more directly
- harden run/step transitions and assignment inheritance edge cases
- add follow-up chain operability checks in manual QA and tests

### Arc 22E — Activity / Notification-Ready Integration

- normalize activity action usage and alias handling across mutation routes
- harden awareness routing consistency for entry mutation events
- document notification-ready event contracts for future channel delivery arcs

### Arc 22F — Entry Detail, Filters, Assigned Work Hardening

- expand entry list filtering (status/priority/assignment/visibility/date windows)
- improve assigned-work readability and actionability across feed/tasks/entries
- tighten today/upcoming semantics and blocked-item handling consistency

### Arc 22G — Entry Closeout

- authorization audit closeout for all entry mutations and reads
- targeted automated coverage where structure cleanly supports it
- full manual QA pass and deferred-scope lock for post-Release-1 work

## Deferred Scope (Explicit)

Deferred from Arc 22 implementation:

- Journals/Habits runtime productization (planned for Arc 23)
- full Communications delivery channels (email/SMS/push/chat/broadcast)
- AI triage/inference/automation
- advanced workflow automation and trigger orchestration
- bulk historical migration rewrites across old activity/action records

## Recommended Next Arc Scope

**Arc 22B — Quick Capture, Inbox, and Entry Creation Hardening**

Primary objective: harden low-friction entry creation and inbox capture reliability while preserving all existing MemberOps, GearOps, ResourceOps, notes, and tasks behavior.
