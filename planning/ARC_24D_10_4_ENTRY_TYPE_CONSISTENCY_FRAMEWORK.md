# Arc 24D.10.4 — Entry Type Consistency Framework

## Goal

Define and implement a consistent EntryOps information architecture across all Entry types before additional navigation or UX refinement.

## EntryOps Information Architecture (Standard)

Every Entry type detail view must expose sections in this order:

1. Main Item  
2. Context  
3. Metadata  
4. Activity / History

### Context section contract

Context must consistently expose:

- List
- Relationships
- Scope
- Visibility
- Assignment
- Linked Operational Records

### Metadata section contract

Metadata must consistently expose:

- Created By
- Created Date
- Updated By
- Updated Date

### Activity / History contract

Activity / History must include lifecycle and operational changes, including:

- lifecycle events
- status changes
- assignment changes
- relationship changes
- archive/restore actions

## Entry Type-Specific Main Item Content

The architecture keeps type-specific primary content intact:

- Task: status, priority, due date
- Note: content
- Decision: decision, reason/rationale, review date, outcome status
- Event: description, start, end, location, participants, preparation notes, outcome notes
- Journal: template/prompt, content, status, revision history
- Habit: frequency, tracking mode, completion history

## Audit Summary (Pre-change)

### Task / Note / Decision (`/entries/[entryId]`)

- Main Item existed.
- Context was partially present but split across relationship panel, legacy context, and linked records without a top-level Context section.
- Metadata mixed context fields (list, assignment) with created/updated metadata.
- Activity / history existed.

### Event (`/events/[eventId]`)

- Event had rich operational detail and history.
- Sections were not explicitly aligned to the Main Item / Context / Metadata / Activity structure.
- Existing operational history already covered lifecycle signal needs.

### Journal (`/journals/[entryId]`)

- Main Item existed (prompt + body) but without standardized section framing.
- Context fields were not grouped under a single Context section.
- Metadata was split across journal metadata and entry metadata cards.
- Activity / history was not exposed directly on the page.

### Habit (`/habits/[habitId]`)

- Main Item was implicit in header/description.
- Context was partially present (relationships + assignment fields) but not grouped.
- Metadata and operational state details were blended into one card.
- Completion history existed, but lifecycle activity history was not surfaced as a dedicated stream.

## Standardization Implemented

### `/entries/[entryId]` (Task / Note / Decision / Event entry wrapper)

- Added an explicit **Context** card in the side rail.
- Moved context concerns (list, assignment, scope, visibility, relationships, linked operational records) into Context.
- Kept **Metadata** focused on created/updated attribution and timestamps.
- Added an explicit top-level **Context** section grouping relationship panel + legacy context + linked operational records.

### `/journals/[entryId]`

- Added explicit **Main Item** section framing for prompt/body.
- Added explicit **Context** section (list state, relationships, scope, visibility, assignment, linked records).
- Consolidated metadata under an explicit **Metadata** section.
- Added explicit **Activity / history** section backed by entry activity records.

### `/habits/[habitId]`

- Added explicit **Main Item** section for habit content.
- Added explicit **Context** section (list state, relationships, scope, visibility, assignment, linked records).
- Added explicit **Metadata** section framing existing lifecycle/status attributes with created/updated dates.
- Added explicit **Activity / history** section with lifecycle activity stream and completion history.

## Constraints honored

- No visual redesign.
- No navigation redesign.
- No naming changes to entry type concepts.
- Type-specific content preserved.
