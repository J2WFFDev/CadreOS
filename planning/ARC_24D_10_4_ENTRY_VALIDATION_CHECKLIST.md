# Arc 24D.10.4 — Entry Type Consistency Validation Checklist

Use this checklist to verify EntryOps section consistency for all six Entry types.

## Global checks (all entry types)

- [ ] Detail view includes sections for **Main Item**, **Context**, **Metadata**, and **Activity / History**
- [ ] Section order is Main Item → Context → Metadata → Activity / History
- [ ] No type-specific content was removed
- [ ] No navigation changes were introduced
- [ ] No visual redesign changes were introduced

## Task

- [ ] Main Item includes task-specific operational fields (status, priority, due date)
- [ ] Context includes list, relationships, scope, visibility, assignment, linked operational records
- [ ] Metadata includes created/updated attribution and dates
- [ ] Activity / History includes status/assignment/relationship/lifecycle actions

## Note

- [ ] Main Item includes note content
- [ ] Context includes list, relationships, scope, visibility, assignment, linked operational records
- [ ] Metadata includes created/updated attribution and dates
- [ ] Activity / History includes lifecycle/relationship changes

## Decision

- [ ] Main Item includes decision-specific content (decision + rationale/reason)
- [ ] Context includes list, relationships, scope, visibility, assignment, linked operational records
- [ ] Metadata includes created/updated attribution and dates
- [ ] Activity / History includes decision lifecycle and relationship changes
- [ ] Review date and outcome status remain accessible in decision flow

## Event

- [ ] Main Item includes event-specific content (description/start/end/location/participants/prep/outcome)
- [ ] Context is explicitly available and includes relationships/scope/visibility/linked records
- [ ] Metadata includes created/updated attribution and dates
- [ ] Activity / History includes event lifecycle and operational changes

## Journal

- [ ] Main Item includes template/prompt context and journal content
- [ ] Context includes list state, relationships, scope, visibility, assignment, linked operational records
- [ ] Metadata includes created/updated attribution and dates
- [ ] Activity / History includes journal lifecycle actions
- [ ] Revision history remains visible via activity/history signal

## Habit

- [ ] Main Item includes habit-specific content
- [ ] Context includes list state, relationships, scope, visibility, assignment, linked operational records
- [ ] Metadata includes created/updated attribution and dates
- [ ] Activity / History includes both lifecycle actions and completion history
- [ ] Frequency and tracking mode remain available in habit detail
