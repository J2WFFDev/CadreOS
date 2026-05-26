/**
 * Arc 19E — Operational Workflow Orchestration
 *
 * Pure display helpers for workflow types and statuses.
 * No DB or React dependencies — suitable for client-side and server-side rendering.
 */

import type { WorkflowRunStatus, WorkflowTemplateType } from "@prisma/client";

// ── Workflow template type labels ───────────────────────────────────────────

const WORKFLOW_TEMPLATE_TYPE_LABELS: Record<WorkflowTemplateType, string> = {
  FOLLOW_UP_CHAIN: "Follow-up chain",
  CHECKLIST: "Checklist",
  READINESS_SEQUENCE: "Readiness sequence",
  ONBOARDING: "Onboarding",
  RECURRING_PROCEDURE: "Recurring procedure",
};

export function labelForWorkflowTemplateType(templateType: WorkflowTemplateType): string {
  return WORKFLOW_TEMPLATE_TYPE_LABELS[templateType] ?? templateType;
}

// ── Workflow run status labels ──────────────────────────────────────────────

const WORKFLOW_RUN_STATUS_LABELS: Record<WorkflowRunStatus, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function labelForWorkflowRunStatus(status: WorkflowRunStatus): string {
  return WORKFLOW_RUN_STATUS_LABELS[status] ?? status;
}

// ── Workflow activity action labels ─────────────────────────────────────────

const WORKFLOW_ACTIVITY_LABELS: Record<string, string> = {
  "workflow.run_started": "Workflow run started",
  "workflow.step_completed": "Step completed",
  "workflow.run_completed": "Workflow completed",
  "workflow.run_cancelled": "Workflow cancelled",
  "workflow.chain_created": "Follow-up chain created",
};

export function labelForWorkflowActivityAction(action: string): string {
  return WORKFLOW_ACTIVITY_LABELS[action] ?? action;
}

// ── Progress helpers ────────────────────────────────────────────────────────

/**
 * Returns a progress fraction (0.0–1.0) for a workflow run.
 * Returns 1.0 for completed runs regardless of step count.
 */
export function workflowRunProgressFraction(currentStepIndex: number, totalSteps: number, status: WorkflowRunStatus): number {
  if (totalSteps === 0) return 0;
  if (status === "COMPLETED") return 1;
  if (status === "CANCELLED") return 0;
  return Math.min(currentStepIndex / totalSteps, 1);
}

/**
 * Returns a display string such as "Step 2 of 5" for a workflow run.
 */
export function workflowRunProgressLabel(currentStepIndex: number, totalSteps: number, status: WorkflowRunStatus): string {
  if (status === "COMPLETED") return "Complete";
  if (status === "CANCELLED") return "Cancelled";
  if (totalSteps === 0) return "No steps";
  return `Step ${currentStepIndex + 1} of ${totalSteps}`;
}
