# Arc 19E — Operational Workflow Orchestration

## Status

**Complete** — Lightweight workflow primitives, follow-up chain support, operational queue, organization-scoped authorization, and tests.

---

## Background

Arc 19A–19D established the Unified Operational Entry Architecture, the operational feed, quick-capture system, and cross-linking operational graph. Arc 19E adds lightweight workflow coordination on top of that foundation — without becoming a BPMN engine or enterprise approval system.

The goal is to let CadreOS coordinate operational follow-through: follow-up chains, review queues, readiness progressions, operational checklists, assignment handoffs, and recurring procedures.

---

## What Was Built

### Schema additions (`prisma/schema.prisma` + migration `20260526020000_arc19e_workflow_orchestration`)

#### New enums

| Enum | Values | Purpose |
|---|---|---|
| `WorkflowTemplateType` | FOLLOW_UP_CHAIN, CHECKLIST, READINESS_SEQUENCE, ONBOARDING, RECURRING_PROCEDURE | Classifies the intent of a workflow template |
| `WorkflowRunStatus` | ACTIVE, COMPLETED, CANCELLED | Lifecycle status for a running workflow instance |

#### New models

**`WorkflowTemplate`**
Reusable, organization-scoped workflow definition. Stores step definitions as an ordered JSON array (`stepsJson`). Can be archived (soft-delete) without affecting in-progress runs.

```
WorkflowTemplate
  organizationId      String
  name                String
  description         String?
  templateType        WorkflowTemplateType
  stepsJson           String  (JSON: WorkflowStepDefinition[])
  createdByPersonId   String → Person
  createdAt           DateTime
  updatedAt           DateTime
  archivedAt          DateTime?  (soft-archive)
```

**`WorkflowRun`**
A single execution of a WorkflowTemplate. Tracks the current step index and overall lifecycle status. May optionally be anchored to a trigger Entry.

```
WorkflowRun
  organizationId      String
  workflowTemplateId  String → WorkflowTemplate
  anchorEntryId       String? → Entry  (optional trigger entry)
  status              WorkflowRunStatus  (ACTIVE | COMPLETED | CANCELLED)
  currentStepIndex    Int  (0-based)
  startedByPersonId   String → Person
  assignedToPersonId  String?  (default assignee for step entries)
  startedAt           DateTime
  completedAt         DateTime?
  cancelledAt         DateTime?
  metadataJson        String?
```

**`WorkflowStepEntry`**
Join table connecting a WorkflowRun step to the Entry created for that step. One record per executed step. The `entryId` is unique — each entry belongs to at most one workflow step.

```
WorkflowStepEntry
  organizationId  String
  workflowRunId   String → WorkflowRun
  stepIndex       Int
  entryId         String @unique → Entry
  completedAt     DateTime?
  createdAt       DateTime
```

#### Step definition schema (JSON)

Each `WorkflowTemplate.stepsJson` contains a JSON array of `WorkflowStepDefinition` objects:

```typescript
type WorkflowStepDefinition = {
  stepIndex: number;            // 0-based, contiguous
  title: string;                // entry title template
  entryType: EntryType;         // FOLLOW_UP | TASK | READINESS_ITEM | etc.
  description?: string;         // entry content template
  dueDaysOffset?: number;       // days from run start for dueDate
  inheritAssignment?: boolean;  // carry assignee from previous step
  priority?: EntryPriority;     // defaults to MEDIUM
};
```

---

### Service layer (`lib/operational-workflow/`)

Canonical module for all workflow coordination logic.

#### `lib/operational-workflow/types.ts`
- `WorkflowStepDefinition` — step definition type
- `CreateWorkflowTemplateInput`, `UpdateWorkflowTemplateInput`, `ArchiveWorkflowTemplateInput`
- `StartWorkflowRunInput`, `AdvanceWorkflowRunInput`, `CompleteWorkflowRunInput`, `CancelWorkflowRunInput`
- `FollowUpChainStep`, `StartFollowUpChainInput` — for standalone chains without templates
- `OperationalQueueFilter` — composable queue filter type
- `WorkflowTemplateView`, `WorkflowTemplateDetail`, `WorkflowRunView`, `WorkflowStepEntryView`
- `WORKFLOW_ACTIVITY_ACTIONS` — typed constants for activity log strings
- `parseWorkflowSteps(stepsJson)` — safe JSON parse helper
- `serializeWorkflowSteps(steps)` — sorts by stepIndex then serializes
- `validateWorkflowSteps(steps)` — validates contiguity and non-empty titles
- `computeStepDueDate(startedAt, dueDaysOffset)` — computes UTC midnight due dates

#### `lib/operational-workflow/service.ts`
- `createWorkflowTemplate(input)` — creates template, validates steps
- `updateWorkflowTemplate(input)` — updates name/description/steps on non-archived templates
- `archiveWorkflowTemplate(input)` — soft-archives template
- `listWorkflowTemplates(organizationId, options?)` — lists templates (active or all)
- `getWorkflowTemplate(organizationId, workflowTemplateId)` — returns detail with parsed steps
- `startWorkflowRun(input)` — creates WorkflowRun + first step Entry + activity records
- `advanceWorkflowRun(input)` — completes current step, creates next step Entry, auto-completes on last step
- `completeWorkflowRun(input)` — explicit run completion
- `cancelWorkflowRun(input)` — cancels active run, writes anchor activity
- `getWorkflowRun(organizationId, workflowRunId)` — projected view of a run
- `getWorkflowRunSteps(organizationId, workflowRunId)` — step entries in order

#### `lib/operational-workflow/chain.ts`
- `startFollowUpChain(input)` — lightweight follow-up chain without a template
  - Creates FOLLOW_UP entries (or specified types) linked via `parentEntryId`
  - Creates `OperationalRelationship.FOLLOW_UP_TO` edges in the operational graph
  - Inherits assignee from previous step unless overridden
  - Writes `workflow.chain_created` activity on anchor entry

#### `lib/operational-workflow/queue.ts`
- `listOperationalQueue(filter)` — priority-ordered open entry queue for person/team
- `countOpenEntriesForPerson(organizationId, personId)` — badge count helper
- `buildQueueFilter(organizationId, params)` — constructs filters from URL search params

#### `lib/operational-workflow/render.ts`
- `labelForWorkflowTemplateType(type)` — human-readable template type labels
- `labelForWorkflowRunStatus(status)` — human-readable run status labels
- `labelForWorkflowActivityAction(action)` — human-readable workflow activity labels
- `workflowRunProgressFraction(currentStepIndex, totalSteps, status)` — 0.0–1.0 progress fraction
- `workflowRunProgressLabel(currentStepIndex, totalSteps, status)` — "Step N of M" display label

#### `lib/operational-workflow/authorization.ts`
- `resolveWorkflowAccess(context)` — resolves NONE | READ | WRITE | MANAGE access level
- `meetsWorkflowAccessLevel(actual, required)` — ordered comparison helper
- `canWriteWorkflows(context)` — WRITE-level check for starting/advancing runs
- `canManageWorkflows(context)` — MANAGE-level check for archiving templates/cancelling runs

Access level mapping:
| Role | Level |
|---|---|
| ORGANIZATION_ADMIN (org-scoped) | MANAGE |
| PROGRAM_DIRECTOR (org-scoped) | MANAGE |
| COACH | WRITE |
| Authenticated, no staff role | READ |
| No actor | NONE |

---

### Permission additions (`lib/permissions/index.ts`)

Three new `SupportedAction` values:

| Action | Roles with access |
|---|---|
| `workflow.create` | ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH |
| `workflow.update` | ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH |
| `workflow.delete` | ORGANIZATION_ADMIN, PROGRAM_DIRECTOR |

---

### Activity integration (`lib/operational-feed/render.ts`)

Workflow activity actions are recognized by the operational feed render helpers:

| Action | Label |
|---|---|
| `workflow.run_started` | Workflow run started |
| `workflow.step_completed` | Step completed |
| `workflow.run_completed` | Workflow completed |
| `workflow.run_cancelled` | Workflow cancelled |
| `workflow.chain_created` | Follow-up chain created |

---

### Tests (`tests/operational-workflow/`)

37 new tests covering:

- `workflow-types.test.ts` — `parseWorkflowSteps`, `serializeWorkflowSteps`, `validateWorkflowSteps`, `computeStepDueDate`
- `render.test.ts` — `labelForWorkflowTemplateType`, `labelForWorkflowRunStatus`, `labelForWorkflowActivityAction`, `workflowRunProgressFraction`, `workflowRunProgressLabel`
- `queue.test.ts` — `buildQueueFilter` defaults and param forwarding

All 75 tests pass (38 pre-existing + 37 new).

---

## Architecture Decisions

### 1) Sequential steps only — no branching
WorkflowRun advancement is strictly sequential (`currentStepIndex + 1`). There is no conditional branching, no parallel steps, no BPMN-style gateways. This is intentional: operational workflows should be understandable without tooling.

### 2) Steps serialize to JSON, not a relational step model
`WorkflowTemplate.stepsJson` stores the ordered step definitions as a JSON string rather than a separate step table. This makes templates portable (copyable, exportable) and avoids join complexity for what are essentially configuration values. Step mutation is validated before storage via `validateWorkflowSteps`.

### 3) WorkflowStepEntry joins Run→Entry — entries remain first-class
Each step creates a real `Entry` using the existing `createOperationalEntry` infrastructure. Assignment, status tracking, activity logging, and graph relationships all work natively on those entries. Workflow is coordination metadata on top of entries, not a replacement.

### 4) Follow-up chain as a first-class lightweight primitive
`startFollowUpChain` works without a WorkflowTemplate. This serves the common case where staff need to create a quick attendance-concern → coach-follow-up → parent-contact sequence without defining a reusable template. The chain still uses `parentEntryId` and `OperationalRelationship.FOLLOW_UP_TO` for graph coherence.

### 5) Operational queue as a composable filter, not a dedicated model
`OperationalQueue` is a query pattern, not a persisted record. `listOperationalQueue` accepts an `OperationalQueueFilter` and returns priority-ordered entries. This avoids a queue membership table that would go stale and require maintenance.

### 6) Assignment continuity via inheritAssignment flag and run default
Assignment flows through: step `inheritAssignment` flag → `WorkflowRun.assignedToPersonId` → `startedByPersonId`. This preserves continuity without enforcing it — coaches can override at each advance.

### 7) Organization-scoped authorization parallel to entry auth
`resolveWorkflowAccess` follows the same role mapping as `resolveEntryAccess` (Arc 19A). Coaches may write workflows; admins and directors may manage them. This is consistent and requires no new permission infrastructure beyond the three new `SupportedAction` entries.

---

## What Was Intentionally Deferred

| Capability | Reason for deferral |
|---|---|
| Workflow template UI (create/edit form) | UI surfaces deferred to Arc 19F+ |
| WorkflowRun detail page | Requires entry detail integration work from Arc 19B–19C |
| Conditional branching in workflows | Explicitly out of scope (no state machines) |
| Parallel steps | Explicitly out of scope |
| Recurring workflow scheduling | Cron/scheduling not yet available; foundation ready via `RECURRING_PROCEDURE` type |
| Notification dispatch on step completion | Notification system not yet built; activity records are in place for future wiring |
| Automation triggers (e.g., "start workflow when attendance = ABSENT") | Future automation layer can call `startWorkflowRun` directly |
| AI-assisted workflow generation | Explicitly out of scope |
| Drag-and-drop workflow builder | Explicitly out of scope |
| Enterprise approval gates | Explicitly out of scope |

---

## Preserved Behavior

All existing behavior is preserved:

- `lib/operational-entry/` — unchanged
- `lib/operational-graph/` — unchanged
- `lib/operational-feed/` — extended only with new activity label entries
- `lib/permissions/index.ts` — extended with three new actions; existing actions unchanged
- All existing routes — unchanged
- All 38 pre-existing tests — all pass

---

## Recommended Arc 19F Next Steps

1. **Arc 19F — WorkflowTemplate UI** — Create/edit/list forms for workflow templates at `/workflows/templates`. Start run action from entry detail or team context.
2. **Arc 19F — WorkflowRun status panel on Entry detail** — Show active workflow run progress on entries that anchor a run.
3. **Arc 19G — EntryComment activation** — Routes + UI for entry comments (schema already present from Arc 19A).
4. **Arc 19H — EntryReminder activation** — Reminder scheduling for entries (schema already present from Arc 19A).
5. **Arc 19I — Notification trigger foundation** — Wire workflow step completion and status changes to a notification dispatch layer.
6. **Arc 19J — Recurring workflow scheduling** — Add a lightweight cron trigger for `RECURRING_PROCEDURE` type templates.
7. **Arc 19K — Automation foundation** — Allow external events (attendance marked absent, gear maintenance logged) to auto-trigger `startWorkflowRun` calls.
