import { strict as assert } from "node:assert";
import test from "node:test";

import type { WorkflowRunStatus, WorkflowTemplateType } from "@prisma/client";

import {
  labelForWorkflowActivityAction,
  labelForWorkflowRunStatus,
  labelForWorkflowTemplateType,
  workflowRunProgressFraction,
  workflowRunProgressLabel,
} from "../../lib/operational-workflow/render";

// ── labelForWorkflowTemplateType ────────────────────────────────────────────

test("labelForWorkflowTemplateType returns readable labels for all types", () => {
  const cases: Array<[WorkflowTemplateType, string]> = [
    ["FOLLOW_UP_CHAIN", "Follow-up chain"],
    ["CHECKLIST", "Checklist"],
    ["READINESS_SEQUENCE", "Readiness sequence"],
    ["ONBOARDING", "Onboarding"],
    ["RECURRING_PROCEDURE", "Recurring procedure"],
  ];
  for (const [type, expected] of cases) {
    assert.equal(labelForWorkflowTemplateType(type), expected, `Expected label for ${type}`);
  }
});

// ── labelForWorkflowRunStatus ───────────────────────────────────────────────

test("labelForWorkflowRunStatus returns readable labels for all statuses", () => {
  const cases: Array<[WorkflowRunStatus, string]> = [
    ["ACTIVE", "Active"],
    ["COMPLETED", "Completed"],
    ["CANCELLED", "Cancelled"],
  ];
  for (const [status, expected] of cases) {
    assert.equal(labelForWorkflowRunStatus(status), expected, `Expected label for ${status}`);
  }
});

// ── labelForWorkflowActivityAction ─────────────────────────────────────────

test("labelForWorkflowActivityAction returns readable labels for known actions", () => {
  assert.equal(labelForWorkflowActivityAction("workflow.run_started"), "Workflow run started");
  assert.equal(labelForWorkflowActivityAction("workflow.step_completed"), "Step completed");
  assert.equal(labelForWorkflowActivityAction("workflow.run_completed"), "Workflow completed");
  assert.equal(labelForWorkflowActivityAction("workflow.run_cancelled"), "Workflow cancelled");
  assert.equal(labelForWorkflowActivityAction("workflow.chain_created"), "Follow-up chain created");
});

test("labelForWorkflowActivityAction falls back to raw action for unknown actions", () => {
  assert.equal(labelForWorkflowActivityAction("custom.unknown"), "custom.unknown");
});

// ── workflowRunProgressFraction ─────────────────────────────────────────────

test("workflowRunProgressFraction returns 0 for ACTIVE run at step 0 of 5", () => {
  assert.equal(workflowRunProgressFraction(0, 5, "ACTIVE"), 0);
});

test("workflowRunProgressFraction returns 0.6 for ACTIVE run at step 3 of 5", () => {
  assert.equal(workflowRunProgressFraction(3, 5, "ACTIVE"), 0.6);
});

test("workflowRunProgressFraction returns 1 for COMPLETED run", () => {
  assert.equal(workflowRunProgressFraction(2, 5, "COMPLETED"), 1);
});

test("workflowRunProgressFraction returns 0 for CANCELLED run", () => {
  assert.equal(workflowRunProgressFraction(3, 5, "CANCELLED"), 0);
});

test("workflowRunProgressFraction returns 0 for zero-step template", () => {
  assert.equal(workflowRunProgressFraction(0, 0, "ACTIVE"), 0);
});

test("workflowRunProgressFraction caps at 1 even if index equals total", () => {
  assert.equal(workflowRunProgressFraction(5, 5, "ACTIVE"), 1);
});

// ── workflowRunProgressLabel ────────────────────────────────────────────────

test("workflowRunProgressLabel returns 'Step N of M' for active runs", () => {
  assert.equal(workflowRunProgressLabel(0, 5, "ACTIVE"), "Step 1 of 5");
  assert.equal(workflowRunProgressLabel(2, 4, "ACTIVE"), "Step 3 of 4");
});

test("workflowRunProgressLabel returns 'Complete' for completed runs", () => {
  assert.equal(workflowRunProgressLabel(5, 5, "COMPLETED"), "Complete");
});

test("workflowRunProgressLabel returns 'Cancelled' for cancelled runs", () => {
  assert.equal(workflowRunProgressLabel(1, 5, "CANCELLED"), "Cancelled");
});

test("workflowRunProgressLabel returns 'No steps' for zero-step templates", () => {
  assert.equal(workflowRunProgressLabel(0, 0, "ACTIVE"), "No steps");
});
