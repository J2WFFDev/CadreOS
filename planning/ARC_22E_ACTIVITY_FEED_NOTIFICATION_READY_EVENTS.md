# Arc 22E — Activity Feed and Notification-Ready Events

## Purpose

Arc 22E hardens Entry activity event consistency so operational actions emit reliable, structured records for feed/timeline visibility and future Communications delivery.

This arc is additive and migration-safe:

- no external email/SMS/push delivery
- no full Communications runtime
- no Journals/Habits runtime build
- no AI triage or automation rules
- no broad destructive schema rewrites

## EntryActivity Contract (Arc 22E)

`EntryActivity` is the operational event stream for Entry lifecycle and workflow context.  
It is not notification delivery.

Each record should preserve:

- actor (`actorPersonId`)
- target entry (`entryId`)
- action type (`action`)
- timestamp (`createdAt`)
- structured metadata (`metadataJson`) where applicable

## Arc 22E Event Concepts

Arc 22E aligns runtime events to notification-ready concepts using existing string actions:

- `ENTRY_CREATED` → `entry.created`
- `ENTRY_UPDATED` → `entry.updated`
- `ENTRY_LINKED` → `entry.linked`
- `ENTRY_UNLINKED` → `entry.unlinked`
- `ENTRY_ASSIGNED` → `entry.assignment_added`
- `ENTRY_STATUS_CHANGED` → `entry.status_changed`
- `FOLLOW_UP_CREATED` → `entry.follow_up_created`
- `FOLLOW_UP_ASSIGNED` → `entry.follow_up_assigned`
- `FOLLOW_UP_COMPLETED` → `entry.follow_up_completed`
- `ENTRY_COMPLETED` → `entry.completed`
- `ENTRY_ARCHIVED` → `entry.archived`

Legacy action aliases remain supported for compatibility.

## Runtime Hardening in Arc 22E

- Standardized action constants in `lib/operational-entry/types.ts`.
- Entry mutation routes now emit status/completion/archive actions with clearer metadata.
- Follow-up flows emit follow-up creation, assignment, and completion activity events.
- Assignment-related task and quick-capture flows emit explicit assignment activity.
- Feed/today/upcoming pages now apply entry access checks before rendering.
- Entry detail timeline now renders human-readable action labels and safe metadata summaries (no raw metadata dump).
- Notification awareness routing accepts Arc 22E follow-up/link/archive action aliases.

## Visibility and Safety Notes

- Activity visibility remains role-gated by existing Entry access controls.
- Feed and timeline surfaces avoid raw metadata exposure that could leak protected IDs.
- Linked object rendering continues to use restricted/unavailable placeholders where targets are inaccessible.

## Deferred Scope (Communications and Advanced Notification Delivery)

- in-app notification center expansion
- unread/read state redesign
- email delivery
- SMS delivery
- push notifications
- digest notifications delivery runtime
- mention/tag notifications
- escalation rules
- AI summaries
- full audit export tooling

## Recommended Next Arc

**Arc 22F — Assigned Work, Filters, Today/Upcoming, and Role-Aware Views**

Primary objective: strengthen assigned-work operability, advanced filter coverage, and deeper role/scope-aware feed semantics on top of Arc 22E activity foundations.

