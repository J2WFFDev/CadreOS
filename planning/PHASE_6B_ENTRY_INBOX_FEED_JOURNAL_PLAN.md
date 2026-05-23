# Phase 6B Entry / Inbox / Feed / Journal Plan (Future Architecture)

## 1. Purpose

CadreOS needs a unified Entry / Inbox / Feed / Journal model to support capture-first operations.

The goal is to let a user capture information quickly, then classify, route, file, assign, schedule, or convert it later without losing context.

This enables a consistent operating model across notes, tasks, events, decisions, and communication-adjacent workflows.

## 2. Current State

Current implemented objects/workflows are separate:
- `ObservationNote`
- `FollowUpTask`
- `Event`
- `RSVP`
- `Attendance`

These workflows are implemented independently and are not yet unified under a parent `Entry` concept.

## 3. Target Concept: Unified Entry

`Entry` is the future parent capture concept.

An Entry may represent:
- Task
- Note
- Event
- Decision
- Contact Note

Entries should support:
- type
- status
- visibility
- primary container
- optional links
- due date or scheduled date when relevant
- tags
- owner/author
- assignee when relevant
- audit/history later

## 4. Default Capture Behavior

Product decision:
- Default captured Entry type: `Task`
- Default container: `Inbox`

Optional fields at capture or refinement time:
- links
- due date
- status
- tags
- visibility

Capture must stay fast, with classification and refinement available later.

## 5. Inbox Behavior

`Inbox` is the unprocessed capture queue.

Example lifecycle:
- `CAPTURED`
- `TRIAGED`
- `FILED`
- `CONVERTED`
- `ARCHIVED`

Guidance:
- Inbox must not become a permanent dumping ground.
- Items should be reviewed and moved into containers, converted, completed, or archived.
- A future dashboard should surface inbox count and stale inbox items.

## 6. Entry Types

### Task

**Purpose:** Action item that needs completion.

**Examples:**
- Follow up with parent
- Assign coach
- Repair equipment
- Prepare match materials
- Confirm RSVP

**Possible statuses:**
- `OPEN`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`
- `CANCELED`

**Related workflows:** Follow-up execution, assignment, due date management, dashboard action queues.

### Note

**Purpose:** Context, observation, or information.

**Examples:**
- Coach observation
- Athlete development note
- Parent concern
- Practice observation
- Equipment concern

**Possible statuses:**
- `INBOX`
- `FILED`
- `ARCHIVED`

**Related workflows:** Observation logging, context retention, conversion into tasks/decisions/events.

### Event

**Purpose:** Scheduled activity.

**Examples:**
- Practice
- Match
- Meeting
- Training session
- Range day

**Possible statuses:**
- `DRAFT`
- `PUBLISHED`
- `COMPLETED`
- `CANCELED`

**Related workflows:** Calendar scheduling, RSVP, attendance, post-event follow-up.

### Decision

**Purpose:** Recorded decision with rationale, owner, alternatives, and follow-up.

**Examples:**
- Approve new team structure
- Change practice schedule
- Select match roster
- Approve equipment purchase
- Change safety process

**Decision should capture:**
- decision statement
- rationale
- alternatives considered
- owner
- effective date
- follow-up tasks
- related notes/events/people/teams

**Possible statuses:**
- `PROPOSED`
- `DECIDED`
- `SUPERSEDED`
- `REOPENED`
- `ARCHIVED`

**Related workflows:** Governance, operational alignment, and accountability tracking.

### Contact Note

**Purpose:** Interaction history with a person or external contact.

**Examples:**
- Parent conversation
- Sponsor conversation
- Recruit discussion
- Volunteer follow-up
- Coach feedback conversation

**Possible statuses:**
- `LOGGED`
- `FOLLOW_UP_NEEDED`
- `CLOSED`

**Related workflows:** Communication history, relationship continuity, and follow-up generation.

**Open decision:** Contact Note may become either:
- its own Entry type
- a Note subtype/tag
- a relationship-specific activity record

## 7. Containers and Links

Product decision:
- An Entry lives in one primary container.
- An Entry can link to many related records.

Primary containers may include:
- Inbox
- Organization
- Program
- Season
- Team
- Person
- Event
- Task
- Decision

Links may include:
- people
- teams
- programs
- seasons
- events
- tasks
- notes
- decisions
- resources later
- inventory items later

Rationale:
One primary container reduces “where did I put it?” confusion, while links preserve full cross-context relationships.

## 8. Visibility and Public/Private Flag

Product rule:
Visibility must be obvious in the UI.

Initial visibility concepts:
- Private
- Staff-only
- Shared / Public

“Public” must be defined carefully in later policy work.

Potential future visibility scopes:
- Private to author
- Staff-only
- Team staff
- Program staff
- Linked person visible
- Linked guardian visible
- Organization visible

Important rule:
Staff-only notes must not be exposed to parent/guardian users by default.

## 9. Feed Concept

`Feed` is a role-aware stream of operational entries.

Feed is not chat.

Potential feed surfaces:
- My Feed
- Team Feed
- Program Feed
- Staff Feed
- Parent/Athlete Feed later

Feed items may include:
- events
- tasks
- notes visible to the user
- decisions
- attendance exceptions
- RSVP requests
- FieldOps booking updates later
- GearOps assignment/maintenance updates later

Feed content should be controlled by visibility, role, container, and linked relationships.

## 10. Chat / DM / Group Chat

Chat/DM/Group Chat is future scope.

Core MVP should not implement full chat.

Reasons:
- notification complexity
- moderation requirements
- parent/guardian boundary complexity
- read receipt expectations
- mobile messaging expectations
- privacy expectations
- staff-only content exposure risk

Recommendation:
Start with Feed + Tasks + Notes before true messaging.

## 11. Private Journal

Private Journal should start as a view/filter over Entries, not a separate system.

Potential use cases:
- coach reflection
- private practice notes
- personal task capture
- draft observations before filing
- weekly review

Visibility default:
Private to author unless explicitly changed.

## 12. Communication Routing Concept

Future routing options:
- FYP Feed
- Team Feed
- Program Feed
- DM
- Group Chat
- Private Journal
- Task list
- Event schedule

Routing should be driven by:
- Entry type
- visibility
- container
- links
- roles
- relationship scope
- explicit user action

Routing is a future capability and should not be implemented yet.

## 13. Relationship to FieldOps and GearOps

Future Entry integration examples:

FieldOps:
- booking request entry
- conflict found entry
- approval decision entry
- facility issue note
- follow-up task for range setup

GearOps:
- equipment issue note
- maintenance task
- checkout reminder
- consumable reorder task
- inventory decision

## 14. Migration Strategy

### Path A: Keep separate models and add Entry wrapper

**Pros:**
- lower migration risk
- keeps current features stable
- allows gradual adoption

**Cons:**
- more joins/indirection
- separate status models remain
- harder to fully unify capture

### Path B: Refactor to true unified Entry table

**Pros:**
- cleaner long-term capture model
- Inbox becomes natural
- Feed and Journal become easier
- consistent visibility/routing model

**Cons:**
- higher schema/migration risk
- requires careful conversion from current Notes/Tasks/Events
- authorization must be mature first

Recommendation:
Use Option B as long-term direction, phased carefully. Prefer compatibility-layer or staged migration over a sudden rewrite.

## 15. Proposed Future Phases

- Phase 7A: Entry / Inbox schema design
- Phase 7B: Minimal Inbox capture
- Phase 7C: Entry triage and filing
- Phase 7D: Decision entries
- Phase 7E: Private Journal view
- Phase 7F: Role-aware Feed
- Phase 7G: Contact Notes
- Phase 7H: Migration from current Notes/Tasks/Events if needed
- Phase 7I: Messaging/DM exploration only after Feed stabilizes

## 16. Open Decisions

- Should current Notes/Tasks/Events remain separate forever or migrate?
- What is the exact Entry table shape?
- Should visibility be one enum or a more detailed access policy?
- Should tags be global, per organization, or user-defined?
- Should Feed be generated from entries only or from all domain events?
- Should Contact Note be a first-class type?
- How should recurring tasks/events fit?
- When should parent/guardian feeds become available?
- Should private journal entries ever be shareable later?

## 17. MVP-Safe Near-Term Improvements

Safe improvements before full Entry refactor:
- improve note linking
- add better note/task status visibility
- add inbox-like filters
- add dashboard section for unfiled/new items
- add clearer visibility labels
- avoid schema rewrite until authorization and pilot use are proven

## Decision Summary

- Long-term direction is **Option B: Unified Entry Model**.
- Implementation waits until auth/authz stability, MVP pilot resolution, FieldOps planning completion, and migration-risk understanding.
- No current behavior changes are made in Notes, Tasks, Events, RSVP, Attendance, or Dashboard.
