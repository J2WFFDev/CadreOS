# Arc 22A — Entry Inventory Report

## Executive Summary

CadreOS already has a substantial Entry runtime foundation. Entry is not greenfield; Arc 22 work should focus on stabilization, consistency, and gap closure.

Existing Entry architecture includes:

- unified `Entry` model with type/status/priority/visibility/assignment fields
- quick capture creation path and modal launcher
- feed/today/upcoming/assigned-to-me query and UI surfaces
- entry detail editing, completion, delete, and conversion actions
- activity logging and notification-awareness integration
- cross-linking via Entry links, object links, and operational graph edges

Main Release 1 gaps are consistency, UX hardening, authorization/test depth, and closeout quality gates.

## Entry-Related Inventory

### Prisma models and enums

Primary Entry schema:

- `enum EntryType`
- `enum EntryStatus`
- `enum EntryPriority`
- `enum EntryVisibility`
- `enum EntryObjectLinkTargetType`
- `enum EntryAssignmentRole`
- `model Entry`
- `model EntryLink`
- `model EntryObjectLink`
- `model EntryAssignment`
- `model EntryStatusHistory`
- `model EntryActivity`
- `model EntryComment` (schema-only placeholder)
- `model EntryReminder` (schema-only placeholder)
- `model FollowUpTask` (linked compatibility model)
- `model EntryRuntimeRef` (read-only sidecar linkage for note/task runtime compatibility)
- `model InboxRoutingItem` (routing metadata support)

### Entry services and supporting libs

- `lib/operational-entry/service.ts`
- `lib/operational-entry/authorization.ts`
- `lib/operational-entry/types.ts`
- `lib/entries/service.ts` (compatibility helpers)
- `lib/entries/parser.ts` (quick add parsing)
- `lib/quick-capture.ts`
- `lib/operational-feed/queries.ts`
- `lib/operational-feed/render.ts`
- `lib/operational-graph/service.ts`
- `lib/notifications/service.ts` (entry activity awareness hooks)
- `lib/entry-runtime.ts` (note/task sidecar reference layer)

### Entry routes, actions, and pages

- `app/(dashboard)/entries/page.tsx`
- `app/(dashboard)/entries/[entryId]/page.tsx`
- `app/(dashboard)/entries/quick-add/route.ts`
- `app/(dashboard)/entries/[entryId]/update/route.ts`
- `app/(dashboard)/entries/[entryId]/complete/route.ts`
- `app/(dashboard)/entries/[entryId]/convert-note-to-task/route.ts`
- `app/(dashboard)/entries/[entryId]/delete/route.ts`
- `app/(dashboard)/entries/link/route.ts`
- `app/(dashboard)/entries/relationships/link/route.ts`
- `app/(dashboard)/entries/relationships/unlink/route.ts`
- `app/(dashboard)/feed/page.tsx`
- `app/(dashboard)/today/page.tsx`
- `app/(dashboard)/upcoming/page.tsx`
- `app/(dashboard)/decisions/page.tsx`
- `app/(dashboard)/entry-runtime/[entryRuntimeRefId]/page.tsx`

### Quick-create and UI components

- `components/dashboard/quick-capture-launcher.tsx`
- `app/(dashboard)/layout.tsx` (global launcher wiring)
- `components/nav-sidebar.tsx` (feed/entries/today/upcoming navigation)

### Integration routes touching Entry wrappers

- `app/(dashboard)/notes/create/route.ts`
- `app/(dashboard)/tasks/create/route.ts`
- `app/(dashboard)/tasks/[taskId]/edit/update/route.ts`
- `app/(dashboard)/notes/[noteId]/edit/update/route.ts`

### Tests

Direct Entry-focused tests:

- `tests/entries/entry-creation.test.ts`
- `tests/entries/quick-capture.test.ts`
- `tests/entries/task-completion.test.ts`
- `tests/entries/note-to-task-conversion.test.ts`
- `tests/entries/parser.test.ts`

Adjacent Entry domain tests:

- `tests/operational-feed/window-computation.test.ts`
- `tests/operational-feed/render-helpers.test.ts`
- `tests/operational-workflow/*.test.ts`
- `tests/operational-graph/render.test.ts`
- `tests/notifications/types.test.ts`

### Seed data

- `prisma/seed.mjs` currently does **not** seed Entry, EntryActivity, EntryLink, or FollowUpTask demo rows for Entry scenarios.

## Current-State Behavior Notes

### Entry schema and types

- Entry supports rich capture metadata (due, occurrence, time window, parent entry, tags).
- Entry type enum includes journal/habit values but those workflows are not built in this arc.

### Entry status and priority

- statuses: `OPEN`, `IN_PROGRESS`, `DONE`, `CANCELLED`, `ARCHIVED`
- priorities: `LOW`, `MEDIUM`, `HIGH`, `URGENT`

### Ownership and assignment

- scalar ownership path: `Entry.assignedToPersonId`
- multi-assignee path: `EntryAssignment` with role and revocation
- feed/notification assigned views support both paths

### Visibility

- `EntryVisibility` enum supports `STAFF_ONLY`, `TEAM_STAFF`, `ORGANIZATION_SCOPED`
- most mutation paths default to `STAFF_ONLY`

### EntryActivity

- written by operational entry services and legacy compatibility routes
- used for feed Recent Activity and notification awareness routing

### FollowUpTask

- remains active and linked via `Entry.sourceTaskId`
- note-to-task conversion is supported from entry detail route

### Object linking and graph relationships

- `EntryLink` supports entry-to-entry references
- `EntryObjectLink` supports entry-to-domain references (team/event/person/gear/resource/etc.)
- `OperationalRelationship` adds broader cross-module graph links with entry activity side-effects

### Feed, Today, Upcoming

- feed aggregates assigned, today/overdue, upcoming, recent activity
- today and upcoming rely on operational feed query helpers and due-window logic
- assigned lane appears only when actor person is resolved

### Assigned-to-me

- `/feed` assigned lane uses assignment scalar + assignment table
- notification due lane (`listLiveDueAwareness`) uses same dual assignment pattern

### MemberOps integration

- permissions and actor resolution are org/program/team scoped
- quick capture assignee list is sourced from active non-archived people records
- entry links can point to people/team/program/season/member lifecycle records via graph/object links

### GearOps integration

- quick capture context can auto-link `GEAR_ITEM`
- graph node and object-link target enums include extensive gear types

### ResourceOps / FieldOps integration

- quick capture context can auto-link `RESOURCE_BOOKING`
- graph/object-link types support facility/resource/booking and inventory-related node targets

## Known Gaps and Risk Notes

- no dedicated Entry integration suite covering route-level permission-denied paths
- no seeded Entry scenarios for manual validation bootstrap
- split linking model (`EntryLink`, `EntryObjectLink`, `OperationalRelationship`) can be confusing without a unified operator contract
- `EntryComment` and `EntryReminder` remain schema placeholders
- journals/habits runtime remains deferred
- communications channels remain intentionally deferred

## Validation Baseline for Arc 22A Documentation Update

Ran in this arc:

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ⚠️ (pre-existing failure)
- `npm run build` ✅
- `DATABASE_URL=postgresql://user:pass@localhost:5432/cadreos ./node_modules/.bin/prisma validate` ✅

Pre-existing failing test observed (not introduced by this doc arc):

- `tests/gear-bulk-ops/csv.test.ts` expects legacy CSV header ordering and fails against current `asset_id`-inclusive header output.
