# Arc 24D.9A Entry Relationships Foundation Audit

Date: 2026-06-03

Branch: arc-24d-9a-entry-relationships-foundation-audit

Scope: documentation-only audit. No app code, schema, route, auth, role, package, or dependency changes.

## Executive Summary

CadreOS already has a broad Entry Relationships foundation, but it is split across several partially overlapping concepts:

- `Entry.parentEntryId` for parent/child Entry structure.
- `EntryLink` for legacy directed Entry-to-Entry links.
- `EntryObjectLink` for Entry-to-domain-object links.
- `OperationalRelationship` for graph-style relationships across Entry, Habit, people, teams, events, gear, field-ops, and other operational nodes.
- `EntryRuntimeRef` for sidecar runtime references to selected legacy source models.
- `Entry.sourceTaskId`, `Entry.sourceNoteId`, journal prompt/assignment fields, and `FollowUpTask.source*` fields for source/backing-model continuity.
- `EntryActivity` and `HabitActivity` for relationship activity visibility.

The healthiest current direction is to strengthen `OperationalRelationship` as the canonical display/link graph while preserving existing source-of-truth records. The main risk is not missing capability; it is duplicate and inconsistent relationship semantics across old and new paths.

## 1. Existing Relationship Models And Concepts

### Entry

`Entry` is the primary EntryOps work object.

Responsibilities:

- Stores work item type, title, body, status, priority, due/schedule fields, assignment pointers, visibility, tags, list assignment, and lifecycle timestamps.
- Provides `parentEntryId` / `childEntries` for parent-child Entry structure.
- Provides `sourceTaskId` and `sourceNoteId` unique links back to legacy `FollowUpTask` and `ObservationNote`.
- Provides journal prompt and assignment references through `journalPromptId` and `journalAssignmentId`.
- Holds relations to `EntryLink`, `EntryObjectLink`, `EntryAssignment`, `EntryActivity`, `EntryStatusHistory`, `EntryComment`, `EntryReminder`, workflow step anchors, notifications, and type payloads.

Relationship meaning:

- It is both a work item and a relationship hub.
- Some relationships are first-class fields, some are join tables, and some are graph edges.

### EntryLink

`EntryLink` is a directed Entry-to-Entry join table.

Responsibilities:

- Stores `fromEntryId`, `toEntryId`, `createdByPersonId`, and `createdAt`.
- Enforces uniqueness by `(organizationId, fromEntryId, toEntryId)`.
- Used by `/entries/link` and `/entries/unlink`.

Observed status:

- Legacy/simple Entry-to-Entry link path.
- It is not the main visible relationship path on modern Entry detail; newer display copy says source/follow-up references are shown for continuity while new linking flows use Related Items / Context.

### EntryObjectLink

`EntryObjectLink` is a polymorphic Entry-to-domain-object join table.

Responsibilities:

- Links an Entry to target object types such as `PERSON`, `TEAM`, `EVENT`, `RESOURCE_BOOKING`, `GEAR_ITEM`, `FOLLOW_UP_TASK`, `OBSERVATION_NOTE`, and inventory objects.
- Enforces uniqueness by `(organizationId, entryId, targetType, targetId)`.
- Deleted on Entry cascade.
- Resolved for display by `lib/entries/object-links.ts`.

Observed status:

- It is active in object-link route handlers.
- Link creation also mirrors an `OperationalRelationship` edge for graph visibility.

### OperationalRelationship

`OperationalRelationship` is the broad operational graph edge model.

Responsibilities:

- Stores `fromNodeType`, `fromNodeId`, `toNodeType`, `toNodeId`, `relationshipType`, creator, optional metadata JSON, and soft-remove timestamp.
- Supports many node types through `OperationalGraphNodeType`.
- Supports relationship types such as `RELATED_TO`, `BLOCKS`, `BLOCKED_BY`, `FOLLOW_UP_FOR`, `FOLLOW_UP_TO`, `CREATED_FROM`, `SUPPORTS`, `REFERENCES`, `DUPLICATES`, `IMPACTS`, `ASSIGNED_FOR`, `OBSERVED_DURING`, and `READINESS_FOR`.
- Enforces uniqueness by organization, source node, target node, and relationship type.
- Uses soft removal through `removedAt`.

Observed status:

- Central model for the newer relationship graph.
- Used by generic operational graph APIs, object-link mirroring, Entry/Habit relationship panel, and Review-only linked Habit context.

### EntryRuntimeRef

`EntryRuntimeRef` is a runtime sidecar reference model.

Responsibilities:

- Wraps selected legacy source models as EntryOps runtime metadata.
- Current source model enum values are `OBSERVATION_NOTE` and `FOLLOW_UP_TASK`.
- Current runtime kinds are `NOTE` and `TASK`.
- Enforces uniqueness by `(organizationId, sourceModelType, sourceModelId)`.

Observed status:

- Written by `lib/entry-runtime.ts` when enabled by environment flags.
- Not used for Habit occurrences.
- Not a relationship edge; it is a sidecar reference to canonical source records.

### FollowUpTask

`FollowUpTask` is a legacy task/source model.

Responsibilities:

- Stores task title, description, status, assignee, creator, due date, and source references to `ObservationNote`, `Event`, or inbox item.
- Can have a related `Entry` through `Entry.sourceTaskId`.
- Can be linked through `EntryObjectLink` and graph node type `FOLLOW_UP_TASK`.

Observed status:

- Task creation paths can upsert Entry wrappers and runtime refs.
- It remains a source/backing model for some workflows rather than being fully replaced by `Entry`.

### ObservationNote

`ObservationNote` is a legacy note/source model.

Responsibilities:

- Stores staff-only note body, author, athlete/team/event context.
- Can source `FollowUpTask` rows.
- Can have a related `Entry` through `Entry.sourceNoteId`.
- Can be linked through `EntryObjectLink` and graph node type `OBSERVATION_NOTE`.

Observed status:

- It remains a source/backing model for note workflows and runtime refs.

### EntryActivity And HabitActivity

`EntryActivity` records Entry lifecycle and relationship activity.

Responsibilities:

- Stores action strings and optional metadata JSON for Entry events.
- Used by activity feed and Entry detail history.

`HabitActivity` records Habit lifecycle and relationship activity.

Responsibilities:

- Stores Habit-created, updated, checked-in, lifecycle, and relationship events.
- Adapted into the operational feed without converting Habit activity into Entry work.

### Habit, HabitSchedule, HabitCompletion

Habit models were stabilized in Arc 24D.8.

Responsibilities:

- `Habit` stores recurring behavior, assignment, status, tracking mode, and derived placeholders.
- `HabitSchedule` stores cadence metadata.
- `HabitCompletion` stores dated check-ins and is canonical for Habit occurrences.
- `HabitActivity` stores lifecycle/feed events.

Relationship status:

- Habit can be linked to Entry or Habit through `OperationalRelationship`.
- Habit check-ins do not create Entry, EntryRuntimeRef, or task records.

### JournalPrompt And JournalAssignment

Journal prompt/assignment models relate prompts to journal Entries.

Responsibilities:

- `JournalPrompt` is a reusable prompt template.
- `JournalAssignment` targets an athlete or team with scheduled/due metadata.
- `Entry` links to these through `journalPromptId` and `journalAssignmentId`.

Relationship status:

- These are domain-specific relationships, not graph edges.
- Journal detail and Entry detail use payload/access helpers rather than RelationshipPanel links.

### EntryAssignment, EntryStatusHistory, EntryComment, EntryReminder

These are Entry workflow support models.

Responsibilities:

- `EntryAssignment` provides multi-assignee ownership/reviewer/collaborator rows.
- `EntryStatusHistory` records immutable status transitions.
- `EntryComment` and `EntryReminder` are schema-established placeholders.

Relationship status:

- Assignment and status history are relationship-adjacent but not general graph edges.
- Comments/reminders are not active relationship display mechanisms yet.

## 2. Existing Relationship Code Paths

### Foundation Entry/Habit Relationship Helpers

File: `lib/entry-relationships.ts`

Responsibilities:

- Defines foundation relationship target types: `ENTRY` and `HABIT`.
- Defines allowed foundation relationship types for the relationship panel.
- Normalizes `BLOCKED_BY` into `BLOCKS`.
- Canonicalizes symmetric `RELATED_TO` and `DUPLICATES` relationships by stable node ordering.
- Creates relationships through `db.operationalRelationship.upsert`.
- Soft-removes relationships through `removedAt`.
- Resolves relationship summaries for Entry and Habit nodes.
- Applies Entry read/write and Habit read/edit policy checks.
- Writes Entry or Habit relationship activity.
- Provides `listReviewLinkedHabitContextForEntries` for Review-only linked Habit context.

Key behavior:

- Duplicate prevention exists through `OperationalRelationship` unique key and helper normalization.
- Directional labels are user-friendly for outbound/inbound display.
- The foundation helper is narrower and safer than the generic graph helper.

### Generic Operational Graph Helpers

Files:

- `lib/operational-graph/service.ts`
- `lib/operational-graph/types.ts`
- `lib/operational-graph/render.ts`

Responsibilities:

- Defines broad graph node and relationship input types.
- Maps `EntryObjectLinkTargetType` to `OperationalGraphNodeType`.
- Creates and soft-removes `OperationalRelationship` rows.
- Lists related operational records for a node.
- Resolves graph node display metadata across many domain models.
- Provides user-friendly labels for graph node and relationship types.

Key behavior:

- Duplicate prevention exists through `OperationalRelationship` unique key and upsert.
- Generic graph create does not canonicalize `BLOCKED_BY`, `RELATED_TO`, or `DUPLICATES` the same way `lib/entry-relationships.ts` does.
- Generic graph writes Entry activity only for Entry nodes involved in the edge.

### Entry Object-Link Helpers

Files:

- `lib/entries/object-links.ts`
- `lib/operational-entry/service.ts`

Responsibilities:

- Validate object-link target types.
- Check whether target objects exist.
- Resolve linked object summaries and URLs for display.
- Create/delete `EntryObjectLink` rows.
- Write Entry activity for object link added/removed.
- Pick default graph relationship type for object links: `OBSERVED_DURING` for events, `READINESS_FOR` for resource bookings, otherwise `RELATED_TO`.

Key behavior:

- Duplicate prevention exists in both table unique key and service check.
- Object link create also mirrors an `OperationalRelationship` edge.
- Object link unlink deletes `EntryObjectLink` and attempts to soft-remove the mirrored graph edge.

### Legacy Entry Link Routes

Routes:

- `app/(dashboard)/entries/link/route.ts`
- `app/(dashboard)/entries/unlink/route.ts`

Responsibilities:

- Create/delete `EntryLink` rows between two Entries.
- Write Entry activity actions `entry.linked` and `entry.unlinked`.

Key behavior:

- Duplicate prevention exists through `EntryLink` upsert and unique key.
- Directionality is raw from/to Entry.
- Modern display appears to prefer RelationshipPanel and legacy context display instead.

### Foundation Relationship Routes

Routes:

- `app/(dashboard)/relationships/link/route.ts`
- `app/(dashboard)/relationships/unlink/route.ts`

Responsibilities:

- Form-post routes for `RelationshipPanel`.
- Accept foundation node types only.
- Delegate create/remove to `lib/entry-relationships.ts`.
- Redirect back to the source page.

Key behavior:

- Scoped to `ENTRY` and `HABIT`.
- Uses the safer normalization and access-aware helper.

### Generic Entry Relationship Routes

Routes:

- `app/(dashboard)/entries/relationships/link/route.ts`
- `app/(dashboard)/entries/relationships/unlink/route.ts`
- `app/api/operational-graph/relationships/route.ts`

Responsibilities:

- Create/list/delete generic graph relationships.
- Accept any `OperationalGraphNodeType` and `OperationalRelationshipType`.
- Use `linkOperationalRecords`, `unlinkOperationalRecords`, and `listRelatedOperationalRecords`.

Key behavior:

- More powerful but less semantically constrained than foundation routes.
- Requires `entry.update` permission for writes.
- API GET lists relationships but does not enforce a node-specific read policy beyond organization context.

### Runtime Reference Helpers

File: `lib/entry-runtime.ts`

Responsibilities:

- Writes `EntryRuntimeRef` sidecars for observation notes and follow-up tasks.
- Controlled by environment flags.
- Idempotent by source model type and source id.

Key behavior:

- Runtime refs are not relationships and should not be confused with generated tasks.
- They are metadata sidecars around selected legacy source models.

### Relationship UI Components

Primary component:

- `components/dashboard/relationship-panel.tsx`

Responsibilities:

- Displays Related Items / Context for Entry and Habit sources.
- Searches target Entries or Habits.
- Posts to `/relationships/link` and `/relationships/unlink`.
- Labels Habit targets as `Linked habit activity`.
- Clarifies that linked Habit activity does not create tasks, runtime refs, or My Work visibility.

Other relationship displays:

- Entry detail legacy context section.
- Entry detail related operational records section.
- Entry Review `Linked habits` column.
- Activity/history lists using `EntryActivity` and `HabitActivity`.
- Operational graph render helpers.
- Entry runtime detail page.

## 3. Existing Relationship Surfaces

### Entry Detail

Entry detail is the richest relationship surface.

Current relationship displays:

- `RelationshipPanel` for Entry-to-Entry and Entry-to-Habit foundation links.
- Legacy context section for `sourceTaskId`, `sourceNoteId`, and follow-up child Entries.
- Related operational records section for generic graph links to non-Entry/non-Habit nodes.
- Context summary counts for relationships and linked operational records.
- Activity/history section with relationship activity metadata.

Notable behavior:

- Entry and Habit graph links are filtered out of generic related operational records because they are handled by RelationshipPanel.
- Object links appear indirectly through graph mirroring and object-link resolution paths.

### Entry Review

Review is Entry-centered.

Current relationship displays:

- Review table lists completed, cancelled, and archived Entries.
- Arc 24D.8F adds `Linked habits`, showing non-actionable Habit context when reviewed Entries already have Habit `OperationalRelationship` links.

Notable behavior:

- Review does not display generic related operational records or object links.
- Review does not create generated runtime/task records.

### Today

Today is action-focused.

Current relationship displays:

- Entry work items due/active today.
- Separate Habits list for actionable Habit check-ins.

Notable behavior:

- Today does not show generic relationships or linked Habit context beyond the dedicated Habit list.
- Today remains intentionally separate from Review-only linked Habit context.

### Feed

Feed is activity-focused.

Current relationship displays:

- Recent `EntryActivity` and `HabitActivity` are merged.
- Relationship actions are labeled through `lib/operational-feed/render.ts`.
- Habit activity links to Habit detail.

Notable behavior:

- Feed shows relationship events, not relationship graph context.
- It does not present actions to manage relationships.

### Habit Pages

Habit pages use the same foundation relationship panel.

Current relationship displays:

- Habit detail context counts.
- `RelationshipPanel` with Habit source and Entry/Habit targets.
- Habit lifecycle activity.
- Habit completion history.

Notable behavior:

- HabitCompletion remains canonical and is not a graph edge.
- Relationship panel copy makes linked Habit activity contextual only.

### Notes

Notes appear through both legacy and EntryOps paths.

Current relationship displays:

- Observation notes can source follow-up tasks.
- Observation notes can be represented by Entry runtime refs when enabled.
- Observation notes can be linked through `EntryObjectLink` and graph node type `OBSERVATION_NOTE`.
- Entry note detail can show legacy source links and relationships via Entry detail.

### Tasks

Tasks appear through legacy `FollowUpTask` and Entry wrappers.

Current relationship displays:

- Follow-up tasks have source note/event/inbox fields.
- Entry wrappers can use `sourceTaskId`.
- Follow-up child Entries are shown in legacy context.
- Follow-up tasks can be linked through `EntryObjectLink` and `FOLLOW_UP_TASK` graph nodes.
- Workflow chain can create `FOLLOW_UP_TO` operational relationships.

### Journals

Journals are Entry type `JOURNAL` with domain-specific payload and workflow.

Current relationship displays:

- Journal prompt and assignment relationships are stored on `Entry`.
- Journal body visibility is governed by journal access helpers.
- Journal detail does not appear to use RelationshipPanel directly, but the underlying Entry detail can show Entry relationships for journal Entries.

### Decisions

Decisions are Entry type `DECISION` with structured payload.

Current relationship displays:

- Decision detail lives through Entry detail and decision payload fields.
- Decision review metadata is stored in `EntryTypePayload`.
- Relationships are available through Entry detail if the decision is opened as an Entry.

### Object-Linking Pages And Actions

Object-linking routes create/delete Entry-to-object context.

Current relationship displays:

- Create/delete object-link routes exist.
- Object-link creation mirrors an `OperationalRelationship`.
- Entry detail can show related operational records for non-Entry/non-Habit graph nodes.

Notable behavior:

- `EntryObjectLink` and mirrored `OperationalRelationship` can drift if one write succeeds and the other fails.
- Unlink attempts to remove both, but the graph unlink is intentionally non-blocking.

## 4. Relationship Types And Semantics

### Parent / Child Entry

Source object:

- Parent `Entry`.

Target object:

- Child `Entry`.

Directionality:

- `Entry.parentEntryId` points from child to parent; display often treats parent as source/context.

Duplicate prevention:

- A child can have only one `parentEntryId`.

Unlink/delete:

- No dedicated relationship unlink surface observed in this audit; parent field can be cleared through update paths only if exposed.

Labels:

- Follow-up child Entries are shown as `Follow-up entry: ...` through legacy context.

### Legacy EntryLink

Source object:

- `fromEntryId`.

Target object:

- `toEntryId`.

Directionality:

- Directed.

Duplicate prevention:

- Unique `(organizationId, fromEntryId, toEntryId)` plus upsert.

Unlink/delete:

- `/entries/unlink` deletes matching rows.

Labels:

- Activity labels are `Linked to entry` and `Unlinked from entry`.
- Modern detail display does not foreground this model as clearly as RelationshipPanel.

### EntryObjectLink

Source object:

- Entry.

Target object:

- Domain object from `EntryObjectLinkTargetType`.

Directionality:

- Directed from Entry to object.

Duplicate prevention:

- Unique `(organizationId, entryId, targetType, targetId)` plus service-level existing check.

Unlink/delete:

- `/entries/object-links/unlink` deletes the object link and attempts to remove the mirrored graph edge.

Labels:

- Target labels are user-friendly through `labelForEntryObjectLinkTargetType`.
- Some target display summaries are generic because underlying target display data is minimal.

### OperationalRelationship

Source object:

- Any supported graph node type.

Target object:

- Any supported graph node type.

Directionality:

- Directed by stored `from` and `to`.
- `BLOCKED_BY` is only normalized in the foundation helper, not universally.
- `RELATED_TO` and `DUPLICATES` are symmetric only in the foundation helper.

Duplicate prevention:

- Unique `(organizationId, fromNodeType, fromNodeId, toNodeType, toNodeId, relationshipType)` plus upsert.
- Symmetric duplicates can still occur through the generic graph path if callers reverse node order for `RELATED_TO` or `DUPLICATES`.

Unlink/delete:

- Soft removal via `removedAt`.

Labels:

- User-friendly labels exist in both `lib/entry-relationships.ts` and `lib/operational-graph/render.ts`.
- Inbound/outbound labels are richer in `lib/entry-relationships.ts`.

### Habit Activity Link

Source object:

- Entry or Habit.

Target object:

- Habit or Entry.

Directionality:

- Stored as an `OperationalRelationship`.
- Direction determines label such as `Supports` or `Supported by`.

Duplicate prevention:

- Foundation helper normalizes and upserts.

Unlink/delete:

- Foundation unlink soft-removes the relationship.

Labels:

- Habit relationship target labels are `Linked habit activity`.
- Review displays `Habit activity`.
- Copy clarifies this is contextual and not task/runtime generation.

### Follow-Up Relationships

Source object:

- Existing Entry or legacy source model.

Target object:

- Follow-up Entry or FollowUpTask.

Directionality:

- Several representations exist:
  - `Entry.parentEntryId`.
  - `FollowUpTask.sourceNoteId`, `sourceEventId`, `sourceInboxItemId`.
  - `Entry.sourceTaskId`.
  - `OperationalRelationship.FOLLOW_UP_TO` in workflow chain.
  - `OperationalRelationship.FOLLOW_UP_FOR` in foundation relationship options.

Duplicate prevention:

- Varies by model.
- `Entry.sourceTaskId` is unique.
- `OperationalRelationship` upsert prevents exact duplicate graph edges.

Unlink/delete:

- Varies by representation.

Labels:

- Some labels are user-friendly, but semantics are currently fragmented.

### Task / Note / Journal / Decision Relationships

Task:

- Legacy `FollowUpTask` and Entry type `TASK` coexist.
- Source fields and runtime refs connect legacy tasks to EntryOps.

Note:

- `ObservationNote` and Entry type `NOTE` coexist.
- Source fields and runtime refs connect legacy notes to EntryOps.

Journal:

- Journal relationships are mostly prompt/assignment and access-policy relationships.
- Journal body visibility is intentionally separate from relationship display.

Decision:

- Decision payload stores decision-specific metadata.
- Decision relationships are available through Entry relationship surfaces rather than a separate decision relationship model.

## 5. Gaps And Risks

### Duplicate Relationship Risk

- `EntryObjectLink` plus mirrored `OperationalRelationship` can represent the same conceptual link twice.
- `EntryLink` and `OperationalRelationship` can both represent Entry-to-Entry context.
- `Entry.parentEntryId`, `EntryLink`, `FOLLOW_UP_FOR`, and `FOLLOW_UP_TO` can all imply follow-up relationships.
- Generic graph routes do not canonicalize symmetric relationships the way foundation helpers do.

### Unclear Directionality

- `BLOCKED_BY` is normalized to `BLOCKS` only in `lib/entry-relationships.ts`.
- `FOLLOW_UP_FOR` and `FOLLOW_UP_TO` both exist, and the difference may not be obvious to users or implementers.
- Parent/child Entry semantics and follow-up semantics overlap.

### Inconsistent Labels

- Relationship labels exist in multiple places:
  - `lib/entry-relationships.ts`
  - `lib/operational-graph/render.ts`
  - `lib/entries/object-links.ts`
  - `lib/operational-feed/render.ts`
- Foundation labels include inbound/outbound semantics; generic graph labels are simpler.
- Some UI sections say `Related Items / Context`, `Related operational records`, `Legacy context`, and `Linked habits`, which are accurate but may feel fragmented.

### Created But Not Displayed

- Generic API-created `OperationalRelationship` edges may not be visible unless the source surface calls `listRelatedOperationalRecords`.
- `EntryLink` rows are not prominent in modern Entry detail.
- Some `EntryObjectLink` rows may be visible mainly through mirrored graph display rather than a dedicated object-link panel.
- Runtime refs are visible only through `/entry-runtime/[entryRuntimeRefId]`.

### Displayed But Not Actionable

- Review linked Habit context is intentionally non-actionable.
- Legacy context links are read-only.
- Related operational records display links but not unlink/manage controls.
- Feed relationship events link to source records but do not expose relationship management.

### Runtime Work Confusion

- `EntryRuntimeRef` sidecars can be mistaken for generated work objects.
- Habit links can be mistaken for generated Habit occurrence tasks unless labels remain strict.
- Follow-up task Entry wrappers can blur the line between legacy task source records and Entry work items.

### Access And Visibility Risk

- Foundation Entry/Habit helpers use Entry/Habit-specific access checks.
- Generic operational graph API GET lists related records by organization context and may need stronger per-node read policy before broader UI exposure.
- Object-link target resolution has a `canViewTargetDetails` switch, but not all surfaces appear to use identical policy rules.

### Drift Risk

- Object-link create writes both `EntryObjectLink` and `OperationalRelationship`.
- Object-link unlink deletes `EntryObjectLink` and attempts graph unlink in a nested try/catch.
- Failures can leave object-link and graph rows out of sync.

### Test Coverage Gaps

Current tests cover:

- Relationship labels and normalization helper basics.
- Foundation relationship service behavior.
- Object-link labels and target type validation.
- Operational graph render labels.
- Entry detail simplification around RelationshipPanel.
- Review query status scoping.
- Habit visibility in feed/Today.

Gaps:

- Route-level tests for relationship link/unlink flows.
- Tests for object-link to graph mirroring and drift handling.
- Tests for generic graph symmetric duplicate behavior.
- Tests for EntryLink legacy path visibility/deprecation.
- Tests for Review linked context beyond helper grouping.
- Tests for access leakage through generic operational graph GET.
- Tests for directionality consistency across `FOLLOW_UP_FOR`, `FOLLOW_UP_TO`, parent/child, and legacy source fields.

## 6. Recommended Implementation Slices

### 24D.9B - Normalize Relationship Labels And Direction Semantics

Goal:

Create a single relationship-label and direction semantics layer for EntryOps relationship displays, starting with `OperationalRelationship` labels and foundation relationship direction labels.

Allowed files/modules:

- `lib/entry-relationships.ts`
- `lib/operational-graph/render.ts`
- `lib/operational-graph/types.ts`
- Relationship label tests
- Planning documentation

Non-goals:

- No schema changes.
- No new relationship types.
- No route structure changes.
- No auth/role/permission changes.
- No Today/Review redesign.
- No generated runtime/task records.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted relationship/render tests
- `npm test` if relationship test scope changes substantially

Acceptance criteria:

- EntryOps relationship labels are defined in one canonical helper or clearly delegated layer.
- Inbound/outbound labels are consistent across RelationshipPanel, related operational records, Review linked Habit context, and feed metadata where applicable.
- `BLOCKED_BY`, `BLOCKS`, `FOLLOW_UP_FOR`, and `FOLLOW_UP_TO` semantics are documented in code/tests.
- Existing UI text remains behaviorally unchanged except for clearer labels.

### 24D.9C - Consolidate Entry Detail Relationship Surfaces

Goal:

Reduce fragmentation on Entry detail by documenting and then tightening how RelationshipPanel, legacy context, related operational records, object links, and EntryLink appear together.

Allowed files/modules:

- `app/(dashboard)/entries/[entryId]/page.tsx`
- `components/dashboard/relationship-panel.tsx`
- `lib/entries/legacy-context.ts`
- `lib/entries/object-links.ts`
- `lib/entry-relationships.ts`
- Focused Entry detail and relationship tests
- Planning documentation

Non-goals:

- No schema changes.
- No route structure changes.
- No removal of legacy data.
- No auth/role/permission changes.
- No generated runtime/task records.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted Entry detail and relationship tests
- Full `npm test` if practical; document unrelated failures separately

Acceptance criteria:

- Entry detail has a clear hierarchy for relationship display.
- Legacy context remains readable but clearly secondary.
- Object links and graph links do not appear as unexplained duplicates.
- Relationship counts match what the user can inspect.
- No Today or Feed behavior changes.

### 24D.9D - Audit And Stabilize Object-Link Graph Mirroring

Goal:

Make EntryObjectLink and OperationalRelationship mirroring explicit, idempotent, and test-covered so object-link actions do not leave unclear duplicate or stale relationship state.

Allowed files/modules:

- `app/(dashboard)/entries/object-links/link/route.ts`
- `app/(dashboard)/entries/object-links/unlink/route.ts`
- `lib/entries/object-links.ts`
- `lib/operational-entry/service.ts`
- `lib/operational-graph/service.ts`
- Object-link and operational graph tests
- Planning documentation

Non-goals:

- No schema changes unless a later approved slice explicitly requires them.
- No dependency changes.
- No auth/role/permission changes.
- No broad relationship UI redesign.
- No generated runtime/task records.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted object-link/graph tests
- `npm test` if practical; document unrelated failures separately

Acceptance criteria:

- Object-link create and unlink behavior is documented and covered by tests.
- Graph mirroring remains idempotent.
- Failure behavior is explicit and reported or recoverable.
- Duplicate display risk on Entry detail is reduced or documented with a follow-up.

## Suggested Arc 24D.9 Order

Recommended next slice: 24D.9B.

Reason:

Before changing displays or mirroring behavior, CadreOS needs one consistent relationship vocabulary. Label/direction consolidation is the smallest low-risk implementation step and will make 24D.9C and 24D.9D safer.
