# Arc 19C — Quick Capture System

## Summary
Arc 19C introduces a global rapid-capture workflow built on Arc 19A/B OperationalEntry architecture:
- global quick-capture launcher available from dashboard header and mobile floating action
- lightweight modal/sheet with title-first input and optional detail expansion
- fast assignment, due-shortcut, and priority-shortcut controls
- contextual auto-linking to Team, Event, Gear Item, Person, and Booking contexts
- keyboard shortcut support (`⌘/Ctrl + K`)

## Architecture Decisions
- Reused the Arc 19A operational-entry service for entry creation (`createOperationalEntry`) so entry writes remain centralized.
- Preserved consistent activity generation with:
  - `entry.created` from operational-entry service
  - quick-capture action activity (`entry.quick_add.task|note|generic`)
  - object-link activity via `linkEntryToObject` when context is present
- Preserved org scoping and authorization by:
  - resolving actor/organization through `getOrganizationScope`
  - validating assignee and context targets within active organization
  - enforcing permission checks before write (`task.create`, `note.create`, `entry.create`)

## Supported Quick Capture Types (19C)
- Quick Task
- Quick Note
- Quick Observation
- Quick Follow-Up
- Quick Readiness Item
- Quick Gear Issue
- Quick Attendance Note

## Deferred Scope (Explicitly Out of Arc 19C)
- advanced editors and rich document composition
- AI parsing / smart capture extraction
- voice transcription
- heavy workflow automation
- Kanban/workboard systems
- complex notification orchestration

## Arc 19D Recommendations
1. Add reusable contextual launch points inside key detail pages (Team/Event/Gear) with preselected capture type templates.
2. Add quick-link search for linking new captures to existing entries without leaving the modal.
3. Add lightweight offline/mobile draft buffering for unstable connectivity.
4. Add focused telemetry dashboards (open/submit latency, abandonment rate, shortcut usage).
5. Add object-link visibility in entry detail/read models for richer feed context.
