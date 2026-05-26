/**
 * Arc 19E — Operational Workflow Orchestration
 *
 * Authorization helpers for workflow template and run operations.
 * Authorization is organization-scoped using the same role mapping
 * established by Arc 19A's entry authorization.
 */

import { RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";

// ── Types ───────────────────────────────────────────────────────────────────

export type WorkflowAccessLevel = "NONE" | "READ" | "WRITE" | "MANAGE";

export type WorkflowAccessContext = {
  organizationId: string;
  actorPersonId: string | null;
};

// ── Role mappings ───────────────────────────────────────────────────────────

/** Roles that may create and modify workflow templates and runs. */
const WORKFLOW_WRITE_ROLES = new Set<RoleType>([
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
  RoleType.COACH,
]);

/** Roles that may archive or delete workflow templates. */
const WORKFLOW_MANAGE_ROLES = new Set<RoleType>([
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
]);

// ── Access resolution ───────────────────────────────────────────────────────

/**
 * Resolves the access level for an actor in the context of workflow operations.
 *
 * Access levels:
 * - MANAGE — may create, update, archive templates and start/cancel runs.
 * - WRITE  — may start workflow runs and advance them.
 * - READ   — may read templates and run status.
 * - NONE   — unauthenticated or no staff role.
 */
export async function resolveWorkflowAccess(context: WorkflowAccessContext): Promise<WorkflowAccessLevel> {
  if (!context.actorPersonId) return "NONE";

  const assignments = await db.roleAssignment.findMany({
    where: {
      organizationId: context.organizationId,
      personId: context.actorPersonId,
    },
    select: { roleType: true, scopeType: true },
  });

  if (assignments.length === 0) return "NONE";

  const hasManage = assignments.some(
    (a) => WORKFLOW_MANAGE_ROLES.has(a.roleType) && a.scopeType === ScopeType.ORGANIZATION,
  );
  if (hasManage) return "MANAGE";

  const hasWrite = assignments.some((a) => WORKFLOW_WRITE_ROLES.has(a.roleType));
  if (hasWrite) return "WRITE";

  return "READ";
}

/**
 * Returns true if the resolved access level meets the required level.
 * Levels ordered: NONE < READ < WRITE < MANAGE.
 */
export function meetsWorkflowAccessLevel(actual: WorkflowAccessLevel, required: WorkflowAccessLevel): boolean {
  const ORDER: Record<WorkflowAccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, MANAGE: 3 };
  return ORDER[actual] >= ORDER[required];
}

/** Returns true if the actor may start or advance workflow runs. */
export async function canWriteWorkflows(context: WorkflowAccessContext): Promise<boolean> {
  const level = await resolveWorkflowAccess(context);
  return meetsWorkflowAccessLevel(level, "WRITE");
}

/** Returns true if the actor may archive workflow templates or cancel runs. */
export async function canManageWorkflows(context: WorkflowAccessContext): Promise<boolean> {
  const level = await resolveWorkflowAccess(context);
  return meetsWorkflowAccessLevel(level, "MANAGE");
}
