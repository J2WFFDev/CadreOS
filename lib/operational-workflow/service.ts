/**
 * Arc 19E — Operational Workflow Orchestration
 *
 * Core workflow service.
 *
 * Provides:
 * - WorkflowTemplate CRUD (create, update, list, archive)
 * - WorkflowRun lifecycle (start, advance, complete, cancel)
 *
 * Design principles:
 * - No state machines. Advancement is sequential by stepIndex.
 * - No branching logic. Steps are an ordered list.
 * - Each step creates an Entry with the correct type, assignment, and dueDate.
 * - Activity records are written for anchor entries when present.
 */

import { EntryStatus, EntryVisibility } from "@prisma/client";

import { db } from "@/lib/db";
import { resolveOrCreateEntryDefaultInboxList } from "@/lib/entries/lists";
import { writeEntryActivity } from "@/lib/operational-entry";
import {
  computeStepDueDate,
  parseWorkflowSteps,
  serializeWorkflowSteps,
  validateWorkflowSteps,
  WORKFLOW_ACTIVITY_ACTIONS,
} from "./types";
import type {
  AdvanceWorkflowRunInput,
  ArchiveWorkflowTemplateInput,
  CancelWorkflowRunInput,
  CompleteWorkflowRunInput,
  CreateWorkflowTemplateInput,
  StartWorkflowRunInput,
  UpdateWorkflowTemplateInput,
  WorkflowRunView,
  WorkflowStepEntryView,
  WorkflowTemplateDetail,
  WorkflowTemplateView,
} from "./types";

// ── Template CRUD ───────────────────────────────────────────────────────────

/**
 * Creates a new WorkflowTemplate for the organization.
 * Steps are validated before storage.
 */
export async function createWorkflowTemplate(input: CreateWorkflowTemplateInput) {
  const validation = validateWorkflowSteps(input.steps);
  if (!validation.valid) {
    throw new Error(`Invalid workflow steps: ${validation.message}`);
  }

  const template = await db.workflowTemplate.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description ?? null,
      templateType: input.templateType,
      stepsJson: serializeWorkflowSteps(input.steps),
      createdByPersonId: input.createdByPersonId,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      templateType: true,
      stepsJson: true,
      createdByPersonId: true,
      createdAt: true,
      archivedAt: true,
    },
  });

  return template;
}

/**
 * Updates a WorkflowTemplate's name, description, or step definitions.
 * Returns null if the template is not found or is archived.
 */
export async function updateWorkflowTemplate(input: UpdateWorkflowTemplateInput) {
  const existing = await db.workflowTemplate.findFirst({
    where: { id: input.workflowTemplateId, organizationId: input.organizationId, archivedAt: null },
    select: { id: true, stepsJson: true },
  });

  if (!existing) return null;

  let stepsJson: string | undefined;
  if (input.steps !== undefined) {
    const validation = validateWorkflowSteps(input.steps);
    if (!validation.valid) {
      throw new Error(`Invalid workflow steps: ${validation.message}`);
    }
    stepsJson = serializeWorkflowSteps(input.steps);
  }

  return db.workflowTemplate.update({
    where: { id: existing.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(stepsJson !== undefined ? { stepsJson } : {}),
    },
    select: { id: true, name: true, description: true, stepsJson: true, updatedAt: true },
  });
}

/**
 * Soft-archives a WorkflowTemplate. Archived templates cannot be used to start new runs.
 * Returns null if not found.
 */
export async function archiveWorkflowTemplate(input: ArchiveWorkflowTemplateInput) {
  const existing = await db.workflowTemplate.findFirst({
    where: { id: input.workflowTemplateId, organizationId: input.organizationId, archivedAt: null },
    select: { id: true },
  });

  if (!existing) return null;

  return db.workflowTemplate.update({
    where: { id: existing.id },
    data: { archivedAt: new Date() },
    select: { id: true, archivedAt: true },
  });
}

/**
 * Lists all active (non-archived) WorkflowTemplates for an organization.
 */
export async function listWorkflowTemplates(
  organizationId: string,
  options?: { includeArchived?: boolean },
): Promise<WorkflowTemplateView[]> {
  const templates = await db.workflowTemplate.findMany({
    where: {
      organizationId,
      ...(options?.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      templateType: true,
      stepsJson: true,
      createdAt: true,
      archivedAt: true,
    },
  });

  return templates.map((t) => ({
    id: t.id,
    organizationId: t.organizationId,
    name: t.name,
    description: t.description,
    templateType: t.templateType,
    stepCount: parseWorkflowSteps(t.stepsJson).length,
    createdAt: t.createdAt,
    archivedAt: t.archivedAt,
  }));
}

/**
 * Retrieves a single WorkflowTemplate with its parsed step definitions.
 * Returns null if not found.
 */
export async function getWorkflowTemplate(
  organizationId: string,
  workflowTemplateId: string,
): Promise<WorkflowTemplateDetail | null> {
  const template = await db.workflowTemplate.findFirst({
    where: { id: workflowTemplateId, organizationId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      templateType: true,
      stepsJson: true,
      createdByPersonId: true,
      createdAt: true,
      archivedAt: true,
    },
  });

  if (!template) return null;

  const steps = parseWorkflowSteps(template.stepsJson);
  return {
    id: template.id,
    organizationId: template.organizationId,
    name: template.name,
    description: template.description,
    templateType: template.templateType,
    stepCount: steps.length,
    steps,
    createdByPersonId: template.createdByPersonId,
    createdAt: template.createdAt,
    archivedAt: template.archivedAt,
  };
}

// ── Run lifecycle ───────────────────────────────────────────────────────────

/**
 * Starts a new WorkflowRun from a template. Creates the first step Entry and
 * writes a workflow.run_started activity on the anchor entry (if provided).
 *
 * Returns null if the template is not found or is archived.
 */
export async function startWorkflowRun(input: StartWorkflowRunInput) {
  const template = await db.workflowTemplate.findFirst({
    where: { id: input.workflowTemplateId, organizationId: input.organizationId, archivedAt: null },
    select: { id: true, stepsJson: true, name: true },
  });

  if (!template) return null;

  const steps = parseWorkflowSteps(template.stepsJson);
  if (steps.length === 0) return null;

  const firstStep = steps[0];
  const assignee = input.assignedToPersonId ?? input.startedByPersonId;
  const startedAt = new Date();
  const dueDate = computeStepDueDate(startedAt, firstStep.dueDaysOffset);
  const defaultList = await resolveOrCreateEntryDefaultInboxList({
    organizationId: input.organizationId,
    actorPersonId: input.startedByPersonId,
  });

  const run = await db.workflowRun.create({
    data: {
      organizationId: input.organizationId,
      workflowTemplateId: input.workflowTemplateId,
      anchorEntryId: input.anchorEntryId ?? null,
      startedByPersonId: input.startedByPersonId,
      assignedToPersonId: input.assignedToPersonId ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    select: { id: true, currentStepIndex: true, startedAt: true },
  });

  const stepEntry = await db.entry.create({
    data: {
      organizationId: input.organizationId,
      type: firstStep.entryType,
      title: firstStep.title,
      content: firstStep.description ?? null,
      createdByPersonId: input.startedByPersonId,
      assignedToPersonId: assignee,
      visibility: EntryVisibility.STAFF_ONLY,
      status: EntryStatus.OPEN,
      priority: firstStep.priority ?? "MEDIUM",
      dueDate,
      listId: defaultList.id,
    },
    select: { id: true },
  });

  await db.workflowStepEntry.create({
    data: {
      organizationId: input.organizationId,
      workflowRunId: run.id,
      stepIndex: 0,
      entryId: stepEntry.id,
    },
  });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: stepEntry.id,
    actorPersonId: input.startedByPersonId,
    action: WORKFLOW_ACTIVITY_ACTIONS.RUN_STARTED,
    metadata: { workflowRunId: run.id, templateName: template.name, stepIndex: 0 },
  });

  if (input.anchorEntryId) {
    await writeEntryActivity({
      organizationId: input.organizationId,
      entryId: input.anchorEntryId,
      actorPersonId: input.startedByPersonId,
      action: WORKFLOW_ACTIVITY_ACTIONS.RUN_STARTED,
      metadata: { workflowRunId: run.id, templateName: template.name },
    });
  }

  return { runId: run.id, stepEntryId: stepEntry.id };
}

/**
 * Advances a WorkflowRun to the next step by:
 * 1. Marking the current step Entry as DONE.
 * 2. Recording a WorkflowStepEntry completion timestamp.
 * 3. Creating the next step Entry (if steps remain).
 * 4. Updating currentStepIndex on the WorkflowRun.
 * 5. Auto-completing the run when the last step is advanced.
 *
 * Returns null if the run is not found or already finished.
 */
export async function advanceWorkflowRun(input: AdvanceWorkflowRunInput) {
  const run = await db.workflowRun.findFirst({
    where: {
      id: input.workflowRunId,
      organizationId: input.organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      currentStepIndex: true,
      assignedToPersonId: true,
      startedByPersonId: true,
      startedAt: true,
      workflowTemplate: { select: { stepsJson: true, name: true } },
      stepEntries: {
        select: { id: true, stepIndex: true, entryId: true },
        orderBy: { stepIndex: "asc" },
      },
    },
  });

  if (!run) return null;

  const steps = parseWorkflowSteps(run.workflowTemplate.stepsJson);
  const currentIndex = run.currentStepIndex;
  const currentStepEntry = run.stepEntries.find((se) => se.stepIndex === currentIndex);

  if (!currentStepEntry) return null;

  await db.entry.update({
    where: { id: currentStepEntry.entryId },
    data: { status: EntryStatus.DONE, taskCompleted: true, completedAt: new Date() },
  });

  await db.workflowStepEntry.update({
    where: { id: currentStepEntry.id },
    data: { completedAt: new Date() },
  });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: currentStepEntry.entryId,
    actorPersonId: input.actorPersonId,
    action: WORKFLOW_ACTIVITY_ACTIONS.STEP_COMPLETED,
    metadata: { workflowRunId: run.id, stepIndex: currentIndex },
  });

  const nextIndex = currentIndex + 1;
  const isLastStep = nextIndex >= steps.length;

  if (isLastStep) {
    await db.workflowRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", currentStepIndex: nextIndex, completedAt: new Date() },
    });
    return { runId: run.id, completed: true, nextStepEntryId: null };
  }

  const nextStep = steps[nextIndex];
  const prevAssignee = input.nextStepAssignedToPersonId ?? run.assignedToPersonId ?? run.startedByPersonId;
  const resolvedAssignee = nextStep.inheritAssignment ? prevAssignee : (input.nextStepAssignedToPersonId ?? run.assignedToPersonId ?? run.startedByPersonId);
  const dueDate = computeStepDueDate(run.startedAt, nextStep.dueDaysOffset);
  const defaultList = await resolveOrCreateEntryDefaultInboxList({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
  });

  const nextEntry = await db.entry.create({
    data: {
      organizationId: input.organizationId,
      type: nextStep.entryType,
      title: nextStep.title,
      content: nextStep.description ?? null,
      createdByPersonId: input.actorPersonId,
      assignedToPersonId: resolvedAssignee,
      visibility: EntryVisibility.STAFF_ONLY,
      status: EntryStatus.OPEN,
      priority: nextStep.priority ?? "MEDIUM",
      dueDate,
      listId: defaultList.id,
    },
    select: { id: true },
  });

  await db.workflowStepEntry.create({
    data: {
      organizationId: input.organizationId,
      workflowRunId: run.id,
      stepIndex: nextIndex,
      entryId: nextEntry.id,
    },
  });

  await db.workflowRun.update({
    where: { id: run.id },
    data: { currentStepIndex: nextIndex },
  });

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: nextEntry.id,
    actorPersonId: input.actorPersonId,
    action: WORKFLOW_ACTIVITY_ACTIONS.RUN_STARTED,
    metadata: {
      workflowRunId: run.id,
      templateName: run.workflowTemplate.name,
      stepIndex: nextIndex,
    },
  });

  return { runId: run.id, completed: false, nextStepEntryId: nextEntry.id };
}

/**
 * Explicitly completes a WorkflowRun (e.g., when all steps are manually finished).
 * Returns null if not found or not ACTIVE.
 */
export async function completeWorkflowRun(input: CompleteWorkflowRunInput) {
  const run = await db.workflowRun.findFirst({
    where: { id: input.workflowRunId, organizationId: input.organizationId, status: "ACTIVE" },
    select: { id: true },
  });

  if (!run) return null;

  return db.workflowRun.update({
    where: { id: run.id },
    data: { status: "COMPLETED", completedAt: new Date() },
    select: { id: true, status: true, completedAt: true },
  });
}

/**
 * Cancels an active WorkflowRun.
 * Returns null if not found or not ACTIVE.
 */
export async function cancelWorkflowRun(input: CancelWorkflowRunInput) {
  const run = await db.workflowRun.findFirst({
    where: { id: input.workflowRunId, organizationId: input.organizationId, status: "ACTIVE" },
    select: { id: true, anchorEntryId: true },
  });

  if (!run) return null;

  const updated = await db.workflowRun.update({
    where: { id: run.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    select: { id: true, status: true, cancelledAt: true },
  });

  if (run.anchorEntryId) {
    await writeEntryActivity({
      organizationId: input.organizationId,
      entryId: run.anchorEntryId,
      actorPersonId: input.actorPersonId,
      action: WORKFLOW_ACTIVITY_ACTIONS.RUN_CANCELLED,
      metadata: { workflowRunId: run.id },
    });
  }

  return updated;
}

// ── Run queries ─────────────────────────────────────────────────────────────

/**
 * Returns a projected view of a single WorkflowRun.
 */
export async function getWorkflowRun(organizationId: string, workflowRunId: string): Promise<WorkflowRunView | null> {
  const run = await db.workflowRun.findFirst({
    where: { id: workflowRunId, organizationId },
    select: {
      id: true,
      organizationId: true,
      workflowTemplateId: true,
      workflowTemplate: { select: { name: true, stepsJson: true } },
      anchorEntryId: true,
      status: true,
      currentStepIndex: true,
      startedByPersonId: true,
      assignedToPersonId: true,
      startedAt: true,
      completedAt: true,
      cancelledAt: true,
    },
  });

  if (!run) return null;

  return {
    id: run.id,
    organizationId: run.organizationId,
    workflowTemplateId: run.workflowTemplateId,
    workflowTemplateName: run.workflowTemplate.name,
    anchorEntryId: run.anchorEntryId,
    status: run.status,
    currentStepIndex: run.currentStepIndex,
    totalSteps: parseWorkflowSteps(run.workflowTemplate.stepsJson).length,
    startedByPersonId: run.startedByPersonId,
    assignedToPersonId: run.assignedToPersonId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    cancelledAt: run.cancelledAt,
  };
}

/**
 * Returns the step entries for a WorkflowRun in stepIndex order.
 */
export async function getWorkflowRunSteps(
  organizationId: string,
  workflowRunId: string,
): Promise<WorkflowStepEntryView[]> {
  const stepEntries = await db.workflowStepEntry.findMany({
    where: { workflowRunId, organizationId },
    orderBy: { stepIndex: "asc" },
    select: { id: true, stepIndex: true, entryId: true, completedAt: true, createdAt: true },
  });

  return stepEntries.map((se) => ({
    id: se.id,
    stepIndex: se.stepIndex,
    entryId: se.entryId,
    completedAt: se.completedAt,
    createdAt: se.createdAt,
  }));
}
