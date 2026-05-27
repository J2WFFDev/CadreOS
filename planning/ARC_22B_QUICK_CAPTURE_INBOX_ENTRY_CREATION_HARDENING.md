# Arc 22B — Quick Capture, Inbox, and Entry Creation Hardening

## Purpose

Arc 22B hardens Entry creation for fast, reliable, low-context capture while preserving existing notes, tasks, dashboard, MemberOps, GearOps, ResourceOps, and roster workflows.

This arc remains additive and migration-safe:

- no broad destructive schema rewrites
- no Journals/Habits runtime build
- no full Communications runtime build

## Quick-Capture Model (Arc 22B Contract)

### Quick Capture

Quick Capture is the default low-friction creation path from dashboard surfaces.

- minimal required capture input: a short title/summary (or equivalent text input)
- optional enrichment: details/body, assignee, due shortcut, context link, type
- creation failures should preserve typed values where practical

### Inbox-First Capture

Low-context captures now route into an Inbox queue using `InboxRoutingItem` records.

Arc 22B Inbox routing criteria:

- no due date
- no explicit context target link at capture time
- not an event-style entry

When these criteria are met:

- create Entry as normal (`status=OPEN`, `visibility=STAFF_ONLY`)
- create `InboxRoutingItem` with `subjectRefType=ENTRY`, `subjectRefId=<entryId>`, `status=OPEN`

This allows triage/routing later without blocking initial capture.

## Entry Creation Reliability Hardening

Arc 22B quick-capture reliability updates:

- preserved user-entered quick-capture values on failed save redirects
- explicit quick-capture error message feedback in launcher modal
- retained permission and organization scope enforcement before create
- maintained note/task wrapper compatibility behavior
- preserved single create submission path and post-create redirect to entry detail

## Inbox Behavior (Arc 22B)

Arc 22B introduces a dedicated `Entry Inbox` view:

- lists unprocessed `InboxRoutingItem` records for entry captures
- displays title, type, status, priority, owner, and queued timestamp
- allows direct open of entry detail for triage/enrichment
- does not require immediate assignment/categorization to capture successfully

Feed now includes an Inbox lane to surface queued captures near other operational lanes.

## Validation and Authorization Notes

- entry creation still enforces role-aware permission checks
- quick-capture permission denial now returns recoverable UI feedback via redirect state
- validation errors are surfaced with plain-language messages in quick capture

## Manual QA Coverage

Use `ARC_22B_ENTRY_VALIDATION_CHECKLIST.md` for Arc 22B validation.

## Deferred Items (Explicit)

Deferred beyond Arc 22B:

- keyboard shortcut polish
- offline capture
- voice capture
- AI triage
- advanced templates
- recurring habits
- journal prompts
- communications notifications
- mobile-native app behavior

## Recommended Next Arc

**Arc 22C — Entry Detail, Linking, and Operational Graph**

Primary objective: deepen entry detail workflows and linking consistency across Entry links, object links, and operational graph relationships.
