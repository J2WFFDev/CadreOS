# Phase 7A — Entry / Inbox Schema Design

## Goal

Define the future Entry / Inbox schema before implementation.

This design should support:

- rapid capture
- default Task in Inbox
- classification
- status progression
- one primary container
- multiple links
- visibility
- tags
- due dates
- assignment
- future feed/journal/routing behavior

## Current State

CadreOS currently has separate implemented models and workflows for:

- ObservationNote
- FollowUpTask
- Event
- RSVP
- Attendance

These are working today, but they do not yet share a unified capture/inbox model.

## Product Decisions Already Made

- Long-term direction is **Option B**: unified Entry model.
- Implementation waits until after Core MVP stability and authorization.
- Default captured Entry type should be **Task**.
- Default container should be **Inbox**.
- Entries live in one primary container.
- Entries may link to many related records.
- Public/private visibility must be obvious.
- Chat/DM should not be implemented before Feed and Entry stabilize.
- Parent/guardian access must not expose staff-only content.

## Proposed Core Model: Entry

Conceptual Prisma-style model (planning only):

```prisma
model Entry {
  id                    String      @id @default(cuid())
  organizationId        String
  authorPersonId        String
  type                  EntryType
  status                String
  visibility            EntryVisibility
  title                 String
  body                  String?
  primaryContainerType  EntryContainerType
  primaryContainerId    String?
  dueAt                 DateTime?
  scheduledAt           DateTime?
  assignedToPersonId    String?
  priority              String?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  archivedAt            DateTime?

  organization          Organization
  author                Person      @relation("EntryAuthor", fields: [authorPersonId], references: [id])
  assignee              Person?     @relation("EntryAssignee", fields: [assignedToPersonId], references: [id])
  links                 EntryLink[]
  tags                  EntryTag[]
  statusHistory         EntryStatusHistory[] // optional future
  decisionDetail        EntryDecisionDetail?
  contactDetail         EntryContactDetail?
}
```

Relationships to support:

- Organization
- author Person
- assignee Person optional
- EntryLink[]
- EntryTag[]
- EntryStatusHistory[] optional future
- EntryDecisionDetail optional
- EntryContactDetail optional

## EntryType Enum

```prisma
enum EntryType {
  TASK
  NOTE
  EVENT
  DECISION
  CONTACT_NOTE
}
```

`CONTACT_NOTE` remains an open decision and may become a Note subtype/tag instead.

## EntryStatus Strategy

### Option A: One universal status enum

Example:

- CAPTURED
- TRIAGED
- OPEN
- IN_PROGRESS
- BLOCKED
- DONE
- FILED
- ARCHIVED
- CANCELED

Pros:

- simpler schema
- easier filtering

Cons:

- weak type-specific workflows
- awkward for Event/Decision status

### Option B: Type-specific status fields or enums

Task:

- OPEN
- IN_PROGRESS
- BLOCKED
- DONE
- CANCELED

Note:

- INBOX
- FILED
- ARCHIVED

Event:

- DRAFT
- PUBLISHED
- COMPLETED
- CANCELED

Decision:

- PROPOSED
- DECIDED
- SUPERSEDED
- REOPENED
- ARCHIVED

Contact Note:

- LOGGED
- FOLLOW_UP_NEEDED
- CLOSED

**MVP recommendation:** Use a hybrid strategy: keep one shared lifecycle status (CAPTURED/TRIAGED/ARCHIVED/CANCELED) plus a type-specific workflow status field. This preserves inbox consistency while avoiding awkward event/decision semantics.

## Visibility Model

Minimum visibility enum options:

- PRIVATE
- STAFF_ONLY
- SHARED

Future visibility expansion:

- PRIVATE_TO_AUTHOR
- TEAM_STAFF
- PROGRAM_STAFF
- ORGANIZATION_STAFF
- LINKED_PERSON
- LINKED_GUARDIAN
- ORGANIZATION_VISIBLE

Notes:

- Visibility must be explicit in the UI.
- Staff-only content must remain hidden from parent/guardian users by default.
- Parent/guardian visibility requires relationship-scoped authorization later.

## Container Model

An Entry has one primary container:

- INBOX
- ORGANIZATION
- PROGRAM
- SEASON
- TEAM
- PERSON
- EVENT
- TASK
- DECISION

Suggested fields:

- primaryContainerType
- primaryContainerId (nullable for INBOX)

Behavior:

- Primary container is where the entry “lives.”
- Links provide related context.
- This prevents confusion over where the item belongs.

## Entry Links

Conceptual `EntryLink` model purpose:

Links an Entry to related records without changing its primary container.

Suggested fields:

- id
- organizationId
- entryId
- linkedEntityType
- linkedEntityId
- relationshipType optional
- createdAt

Linked entity types may include:

- PERSON
- PROGRAM
- SEASON
- TEAM
- EVENT
- TASK
- NOTE
- DECISION
- FIELDOPS_BOOKING (later)
- GEAROPS_ITEM (later)

## Tags

### Option A: String array on Entry

Pros: quick to ship.

Cons: hard to govern, hard to query consistently, no org-level controls.

### Option B: Normalized tags (`Tag` + `EntryTag`)

Pros: organization-scoped governance, easier dedupe/search/filtering, supports user-defined tags safely.

Cons: more schema objects.

**MVP recommendation:** Use normalized tags to avoid global tag chaos and preserve organization-scoped control.

## Decision Detail

Optional `EntryDecisionDetail` purpose:

Stores decision-specific fields without bloating every Entry.

Suggested fields:

- id
- entryId
- decisionStatement
- rationale
- alternativesConsidered
- ownerPersonId optional
- effectiveAt optional
- supersedesEntryId optional
- createdAt
- updatedAt

## Contact Note Detail

Optional `EntryContactDetail` purpose:

Stores contact-interaction-specific fields.

Suggested fields:

- id
- entryId
- contactPersonId optional
- externalContactName optional
- externalContactEmail optional
- interactionAt
- followUpNeeded boolean
- followUpTaskEntryId optional

Open decision:

Contact Note may be handled as a Note with tags/links instead of a separate detail table.

## Inbox Lifecycle

Entries move through Inbox as:

1. Capture
2. Triage
3. Classify
4. File to container
5. Link related entities
6. Assign/schedule if needed
7. Complete/archive/cancel

Stale inbox behavior (future):

- show inbox count
- show stale items
- weekly review workflow later

## Feed / Journal Read Models

Feed is not implemented yet, but schema should support derivation from:

- Entry visibility
- Entry type
- container
- links
- role/scope permissions
- relationship access

Private Journal should likely be:

- Entry view filtered to author + PRIVATE visibility, or
- entries in a personal/private container

Chat/DM should remain deferred.

## Migration Strategy From Current Models

### Path A: Entry wrapper around current models

Entry points to existing ObservationNote / FollowUpTask / Event.

Pros:

- low disruption
- keeps current app stable
- easier incremental migration

Cons:

- split source of truth
- more indirection
- less clean long-term model

### Path B: Move Notes/Tasks/Events into Entry

Pros:

- clean long-term model
- unified inbox/feed/journal
- consistent visibility/status/routing

Cons:

- schema migration risk
- route refactor risk
- authorization complexity

Recommendation:

Use Entry as the future long-term model, phased carefully. Path A can be a transition layer if risk reduction is needed.

## Authorization Considerations

- Entries are organization-scoped.
- Write access uses existing RoleAssignment model.
- Read access must account for visibility.
- Parent/guardian access must be relationship-scoped.
- Private entries are visible only to author unless explicitly shared later.
- Staff-only entries must not leak into parent/athlete feeds.

## Indexing / Constraints

Recommended conceptual indexes:

- organizationId
- organizationId + type
- organizationId + status
- organizationId + visibility
- organizationId + primaryContainerType + primaryContainerId
- authorPersonId
- assignedToPersonId
- dueAt
- scheduledAt
- createdAt
- EntryLink entryId
- EntryLink linkedEntityType + linkedEntityId

## Risks

- overbuilding before real user feedback
- confusing current Notes/Tasks/Events users
- migration complexity
- visibility leaks
- parent/guardian access risk
- too many statuses
- tags becoming messy
- feed becoming chat accidentally
- private journal privacy expectations

## Recommended Future Phases

To avoid confusion with active Team/Member phases (7B+), Entry/Inbox work is relabeled as a separate deferred track:

- **Entry Track E1 (deferred):** Entry schema implementation planning checkpoint
- **Entry Track E2 (deferred):** Minimal Inbox capture
- **Entry Track E3 (deferred):** Entry triage and filing
- **Entry Track E4 (deferred):** Decision entries
- **Entry Track E5 (deferred):** Private Journal view
- **Entry Track E6 (deferred):** Role-aware Feed
- **Entry Track E7 (deferred):** Contact Notes
- **Entry Track E8 (deferred):** Migration from current Notes/Tasks/Events
- **Entry Track E9 (deferred):** Messaging/DM exploration only after Feed stabilizes

## Open Decisions

- Universal status vs type-specific status
- Contact Note as type vs subtype/tag
- Tags normalized or simple
- Entry wrapper transition vs direct migration
- Feed source: Entry-only or all domain events
- Parent/guardian feed timing
- Whether private journal entries can later be shared
- Whether Event as Entry replaces current Event or wraps it
- Whether Task as Entry replaces FollowUpTask or wraps it

## Output

1. **Files changed**
   - `planning/PHASE_7A_ENTRY_INBOX_SCHEMA_DESIGN.md`
   - `planning/README.md`
2. **Proposed Entry schema direction**
   - Adopt Option B long-term with a unified Entry model, single primary container, link table for related context, explicit visibility, normalized tags, and optional detail tables for decision/contact-specific metadata.
3. **Key open decisions**
   - status model shape, contact-note modeling choice, tag modeling shape, migration path strategy, feed sourcing model, guardian feed timing, sharing semantics for private journal entries, and replacement vs wrapper strategy for Event/Task.
4. **Recommended next phase**
   - **Entry Track E1 (deferred): Entry schema implementation planning checkpoint** (after Core MVP stability and authorization confidence gates and after active Team/Member phases complete).
