/**
 * Arc 19E — Operational Workflow Orchestration
 *
 * Standalone follow-up chain primitive.
 *
 * A follow-up chain is a lightweight alternative to a full WorkflowRun for
 * cases where staff need to create a quick sequence of follow-up entries
 * without defining a reusable WorkflowTemplate first.
 *
 * Examples:
 * - Attendance concern → coach follow-up → parent contact → resolution note
 * - Gear issue → maintenance follow-up → return check
 */

import { EntryStatus, EntryVisibility, OperationalRelationshipType } from "@prisma/client";

import { db } from "@/lib/db";
import { resolveOrCreateEntryDefaultInboxList } from "@/lib/entries/lists";
import { writeEntryActivity } from "@/lib/operational-entry";
import { computeStepDueDate, WORKFLOW_ACTIVITY_ACTIONS } from "./types";
import type { FollowUpChainStep, StartFollowUpChainInput } from "./types";

export type FollowUpChainResult = {
  anchorEntryId: string;
  stepEntryIds: string[];
};

/**
 * Creates a standalone follow-up chain from an anchor entry.
 *
 * For each step:
 * - Creates a FOLLOW_UP Entry (or the type specified in the step).
 * - Sets parentEntryId to the previous step's entry (or the anchor entry for step 0).
 * - Creates an OperationalRelationship.FOLLOW_UP_TO link to the previous entry.
 * - Writes a workflow.chain_created activity on the anchor entry.
 *
 * Assignment is inherited from the previous step when not overridden.
 */
export async function startFollowUpChain(input: StartFollowUpChainInput): Promise<FollowUpChainResult> {
  const anchorEntry = await db.entry.findFirst({
    where: { id: input.anchorEntryId, organizationId: input.organizationId, deletedAt: null },
    select: { id: true, assignedToPersonId: true, createdByPersonId: true },
  });

  if (!anchorEntry) {
    throw new Error("Anchor entry not found or has been deleted.");
  }

  if (input.steps.length === 0) {
    throw new Error("A follow-up chain must have at least one step.");
  }

  const now = new Date();
  const stepEntryIds: string[] = [];
  let previousEntryId = anchorEntry.id;
  let previousAssignee =
    input.defaultAssignedToPersonId ?? anchorEntry.assignedToPersonId ?? anchorEntry.createdByPersonId ?? input.createdByPersonId;

  for (let i = 0; i < input.steps.length; i++) {
    const step: FollowUpChainStep = input.steps[i];
    const assignee = step.assignedToPersonId ?? previousAssignee;
    const dueDate = computeStepDueDate(now, step.dueDaysOffset);
    const defaultList = await resolveOrCreateEntryDefaultInboxList({
      organizationId: input.organizationId,
      actorPersonId: input.createdByPersonId,
    });

    const entry = await db.entry.create({
      data: {
        organizationId: input.organizationId,
        type: step.entryType ?? "FOLLOW_UP",
        title: step.title,
        content: step.description ?? null,
        createdByPersonId: input.createdByPersonId,
        assignedToPersonId: assignee,
        visibility: EntryVisibility.STAFF_ONLY,
        status: EntryStatus.OPEN,
        priority: step.priority ?? "MEDIUM",
        dueDate,
        parentEntryId: previousEntryId,
        listId: defaultList.id,
      },
      select: { id: true },
    });

    await db.operationalRelationship.upsert({
      where: {
        organizationId_fromNodeType_fromNodeId_toNodeType_toNodeId_relationshipType: {
          organizationId: input.organizationId,
          fromNodeType: "ENTRY",
          fromNodeId: entry.id,
          toNodeType: "ENTRY",
          toNodeId: previousEntryId,
          relationshipType: OperationalRelationshipType.FOLLOW_UP_TO,
        },
      },
      create: {
        organizationId: input.organizationId,
        fromNodeType: "ENTRY",
        fromNodeId: entry.id,
        toNodeType: "ENTRY",
        toNodeId: previousEntryId,
        relationshipType: OperationalRelationshipType.FOLLOW_UP_TO,
        createdByPersonId: input.createdByPersonId,
      },
      update: { removedAt: null },
    });

    await writeEntryActivity({
      organizationId: input.organizationId,
      entryId: entry.id,
      actorPersonId: input.createdByPersonId,
      action: WORKFLOW_ACTIVITY_ACTIONS.CHAIN_CREATED,
      metadata: {
        anchorEntryId: input.anchorEntryId,
        stepIndex: i,
        previousEntryId,
      },
    });

    stepEntryIds.push(entry.id);
    previousEntryId = entry.id;
    previousAssignee = assignee;
  }

  await writeEntryActivity({
    organizationId: input.organizationId,
    entryId: anchorEntry.id,
    actorPersonId: input.createdByPersonId,
    action: WORKFLOW_ACTIVITY_ACTIONS.CHAIN_CREATED,
    metadata: { stepCount: input.steps.length, firstStepEntryId: stepEntryIds[0] },
  });

  return { anchorEntryId: anchorEntry.id, stepEntryIds };
}
