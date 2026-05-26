/**
 * Arc 19E — Operational Workflow Orchestration
 *
 * Canonical TypeScript type definitions for the lightweight workflow domain.
 * Workflow primitives are intentionally lightweight: no state machines, no
 * BPMN-style branching, no scripted automation. Each primitive is a thin
 * coordination layer on top of the existing Entry + OperationalRelationship
 * architecture established in Arc 19A–19D.
 */

import type {
  EntryPriority,
  EntryStatus,
  EntryType,
  WorkflowRunStatus,
  WorkflowTemplateType,
} from "@prisma/client";

// ── Re-export Prisma enums for convenience ──────────────────────────────────

export { WorkflowRunStatus, WorkflowTemplateType };

// ── Step definition ─────────────────────────────────────────────────────────

/**
 * A single step within a WorkflowTemplate.
 * Steps are stored as an ordered JSON array in WorkflowTemplate.stepsJson.
 */
export type WorkflowStepDefinition = {
  /** 0-based position of this step in the sequence. */
  stepIndex: number;
  /** Display title for the Entry that will be created for this step. */
  title: string;
  /** EntryType to use when creating the step Entry. */
  entryType: EntryType;
  /** Optional initial content/description for the step Entry. */
  description?: string;
  /** Optional: number of days from run start to use as the step dueDate. */
  dueDaysOffset?: number;
  /**
   * When true, the assigned person from the previous step (or run default)
   * is carried forward to this step's Entry.
   */
  inheritAssignment?: boolean;
  /** Optional priority for the step Entry. Defaults to MEDIUM. */
  priority?: EntryPriority;
};

// ── Template inputs ─────────────────────────────────────────────────────────

/** Input for creating a new WorkflowTemplate. */
export type CreateWorkflowTemplateInput = {
  organizationId: string;
  name: string;
  description?: string | null;
  templateType: WorkflowTemplateType;
  steps: WorkflowStepDefinition[];
  createdByPersonId: string;
};

/** Input for updating a WorkflowTemplate's metadata or step definitions. */
export type UpdateWorkflowTemplateInput = {
  organizationId: string;
  workflowTemplateId: string;
  name?: string;
  description?: string | null;
  steps?: WorkflowStepDefinition[];
};

/** Input for archiving a WorkflowTemplate (soft-delete). */
export type ArchiveWorkflowTemplateInput = {
  organizationId: string;
  workflowTemplateId: string;
};

// ── Run inputs ──────────────────────────────────────────────────────────────

/** Input for starting a new WorkflowRun from a template. */
export type StartWorkflowRunInput = {
  organizationId: string;
  workflowTemplateId: string;
  /** Optional Entry that triggered this workflow (e.g., an attendance concern). */
  anchorEntryId?: string | null;
  /** Person starting the run. Also becomes the creator of the first step Entry. */
  startedByPersonId: string;
  /**
   * Default assignee for step Entries when steps don't inherit from a prior step.
   * Falls back to startedByPersonId when unset.
   */
  assignedToPersonId?: string | null;
  /** Optional additional metadata to store on the WorkflowRun record. */
  metadata?: Record<string, unknown> | null;
};

/** Input for advancing a WorkflowRun to its next step. */
export type AdvanceWorkflowRunInput = {
  organizationId: string;
  workflowRunId: string;
  /** Person completing the current step. */
  actorPersonId: string;
  /**
   * Optional override for the next step's assignee.
   * When unset, the run's assignedToPersonId or inheritAssignment is used.
   */
  nextStepAssignedToPersonId?: string | null;
};

/** Input for completing a WorkflowRun after all steps are done. */
export type CompleteWorkflowRunInput = {
  organizationId: string;
  workflowRunId: string;
  actorPersonId: string;
};

/** Input for cancelling an active WorkflowRun. */
export type CancelWorkflowRunInput = {
  organizationId: string;
  workflowRunId: string;
  actorPersonId: string;
};

// ── Follow-up chain inputs ──────────────────────────────────────────────────

/**
 * A single step in a standalone follow-up chain.
 * Used by startFollowUpChain without requiring a WorkflowTemplate.
 */
export type FollowUpChainStep = {
  title: string;
  entryType?: EntryType;
  description?: string;
  assignedToPersonId?: string | null;
  dueDaysOffset?: number;
  priority?: EntryPriority;
};

/** Input for starting a lightweight follow-up chain from an anchor entry. */
export type StartFollowUpChainInput = {
  organizationId: string;
  /** The entry from which this follow-up chain originates. */
  anchorEntryId: string;
  /** Ordered list of follow-up steps. */
  steps: FollowUpChainStep[];
  createdByPersonId: string;
  /** Default assignee when a step doesn't specify one. Falls back to createdByPersonId. */
  defaultAssignedToPersonId?: string | null;
};

// ── Operational queue inputs ────────────────────────────────────────────────

/** Filter options for the operational queue query. */
export type OperationalQueueFilter = {
  organizationId: string;
  /** Filter entries assigned to a specific person. */
  assignedToPersonId?: string | null;
  /** Filter entries belonging to a specific team. */
  teamId?: string | null;
  /** Restrict to these entry types. Defaults to all. */
  entryTypes?: EntryType[];
  /** Restrict to these statuses. Defaults to [OPEN, IN_PROGRESS]. */
  statuses?: EntryStatus[];
  /** Include only overdue entries (dueDate < today UTC). */
  overdueOnly?: boolean;
  /** Max results to return. Defaults to 50. */
  limit?: number;
};

// ── View types ──────────────────────────────────────────────────────────────

/** Minimal projection for WorkflowTemplate list display. */
export type WorkflowTemplateView = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  templateType: WorkflowTemplateType;
  stepCount: number;
  createdAt: Date;
  archivedAt: Date | null;
};

/** Full view of a WorkflowTemplate with parsed step definitions. */
export type WorkflowTemplateDetail = WorkflowTemplateView & {
  steps: WorkflowStepDefinition[];
  createdByPersonId: string;
};

/** Projection for a WorkflowRun list/detail display. */
export type WorkflowRunView = {
  id: string;
  organizationId: string;
  workflowTemplateId: string;
  workflowTemplateName: string;
  anchorEntryId: string | null;
  status: WorkflowRunStatus;
  currentStepIndex: number;
  totalSteps: number;
  startedByPersonId: string;
  assignedToPersonId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

/** Projection for a WorkflowStepEntry. */
export type WorkflowStepEntryView = {
  id: string;
  stepIndex: number;
  entryId: string;
  completedAt: Date | null;
  createdAt: Date;
};

// ── Activity action constants ───────────────────────────────────────────────

/** Standardized action strings for workflow-related EntryActivity records. */
export const WORKFLOW_ACTIVITY_ACTIONS = {
  RUN_STARTED: "workflow.run_started",
  STEP_COMPLETED: "workflow.step_completed",
  RUN_COMPLETED: "workflow.run_completed",
  RUN_CANCELLED: "workflow.run_cancelled",
  CHAIN_CREATED: "workflow.chain_created",
} as const;

export type WorkflowActivityAction = (typeof WORKFLOW_ACTIVITY_ACTIONS)[keyof typeof WORKFLOW_ACTIVITY_ACTIONS];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parses a stepsJson string into an ordered array of WorkflowStepDefinitions.
 * Returns an empty array if the JSON is invalid or not an array.
 */
export function parseWorkflowSteps(stepsJson: string): WorkflowStepDefinition[] {
  try {
    const parsed = JSON.parse(stepsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed as WorkflowStepDefinition[];
  } catch {
    return [];
  }
}

/**
 * Serializes an array of WorkflowStepDefinitions to a JSON string.
 * Steps are sorted by stepIndex before serialization.
 */
export function serializeWorkflowSteps(steps: WorkflowStepDefinition[]): string {
  const sorted = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);
  return JSON.stringify(sorted);
}

/**
 * Validates that a WorkflowStepDefinition array is well-formed:
 * - Non-empty
 * - stepIndex values form a contiguous 0-based sequence
 * - Each step has a non-empty title
 */
export function validateWorkflowSteps(steps: WorkflowStepDefinition[]): { valid: boolean; message: string } {
  if (steps.length === 0) {
    return { valid: false, message: "A workflow template must have at least one step." };
  }
  const sorted = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].stepIndex !== i) {
      return {
        valid: false,
        message: `Step indices must be a contiguous 0-based sequence. Found gap at index ${i}.`,
      };
    }
    if (!sorted[i].title.trim()) {
      return { valid: false, message: `Step at index ${i} must have a non-empty title.` };
    }
  }
  return { valid: true, message: "" };
}

/**
 * Computes a dueDate for a workflow step given a run start date and an offset in days.
 * Returns null when offset is unset or zero.
 */
export function computeStepDueDate(startedAt: Date, dueDaysOffset: number | undefined): Date | null {
  if (!dueDaysOffset || dueDaysOffset <= 0) return null;
  const due = new Date(startedAt);
  due.setUTCDate(due.getUTCDate() + dueDaysOffset);
  due.setUTCHours(0, 0, 0, 0);
  return due;
}
