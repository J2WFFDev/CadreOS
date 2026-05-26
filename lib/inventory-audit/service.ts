import { db } from "@/lib/db";
import { writeAuditEvent } from "@/lib/audit";
import type {
  CreateInventoryAuditInput,
  RecordInventoryAuditVerificationInput,
  ResolveInventoryAuditDiscrepancyInput,
  StartInventoryAuditSessionInput,
} from "./types";
import {
  inferDiscrepancyTypeFromVerification,
  INVENTORY_AUDIT_ACTIVITY_ACTIONS,
} from "./types";

export async function createInventoryAudit(input: CreateInventoryAuditInput) {
  const created = await db.inventoryAudit.create({
    data: {
      organizationId: input.organizationId,
      createdByPersonId: input.createdByPersonId,
      name: input.name,
      description: input.description ?? null,
      auditType: input.auditType,
      scope: input.scope,
      scopeReferenceId: input.scopeReferenceId ?? null,
      cadenceDays: input.cadenceDays ?? null,
      nextScheduledAt: input.nextScheduledAt ?? null,
    },
    select: { id: true, name: true, auditType: true, scope: true, nextScheduledAt: true },
  });

  await writeAuditEvent({
    organizationId: input.organizationId,
    actorPersonId: input.createdByPersonId,
    action: INVENTORY_AUDIT_ACTIVITY_ACTIONS.AUDIT_CREATED,
    entityType: "inventory_audit",
    entityId: created.id,
    afterJson: JSON.stringify(created),
  });

  return created;
}

export async function listInventoryAudits(input: { organizationId: string; includeArchived?: boolean }) {
  const audits = await db.inventoryAudit.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      auditType: true,
      scope: true,
      nextScheduledAt: true,
      lastExecutedAt: true,
      sessions: {
        orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { id: true, status: true, startedAt: true, completedAt: true },
      },
      _count: { select: { sessions: true } },
    },
  });

  return audits.map((audit) => ({
    ...audit,
    latestSession: audit.sessions[0] ?? null,
    totalSessions: audit._count.sessions,
  }));
}

export async function getInventoryAudit(input: { organizationId: string; auditId: string }) {
  return db.inventoryAudit.findFirst({
    where: { id: input.auditId, organizationId: input.organizationId },
    select: {
      id: true,
      name: true,
      description: true,
      auditType: true,
      scope: true,
      scopeReferenceId: true,
      cadenceDays: true,
      nextScheduledAt: true,
      lastExecutedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      sessions: {
        orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
        take: 12,
        select: {
          id: true,
          title: true,
          status: true,
          plannedAt: true,
          startedAt: true,
          completedAt: true,
          startedBy: { select: { id: true, firstName: true, lastName: true } },
          completedBy: { select: { id: true, firstName: true, lastName: true } },
          _count: {
            select: { results: true, discrepancies: true },
          },
        },
      },
    },
  });
}

export async function startInventoryAuditSession(input: StartInventoryAuditSessionInput) {
  const started = await db.$transaction(async (tx) => {
    const session = await tx.inventoryAuditSession.create({
      data: {
        organizationId: input.organizationId,
        inventoryAuditId: input.auditId ?? null,
        title: input.title,
        status: "IN_PROGRESS",
        scopeSnapshotJson: input.scopeSnapshotJson ?? null,
        plannedAt: input.plannedAt ?? null,
        startedAt: new Date(),
        startedByPersonId: input.startedByPersonId ?? null,
        notes: input.notes ?? null,
      },
      select: { id: true, inventoryAuditId: true, title: true, status: true, startedAt: true },
    });

    if (input.auditId) {
      await tx.inventoryAudit.updateMany({
        where: { id: input.auditId, organizationId: input.organizationId },
        data: { lastExecutedAt: new Date() },
      });
    }

    return session;
  });

  await writeAuditEvent({
    organizationId: input.organizationId,
    actorPersonId: input.startedByPersonId ?? null,
    action: INVENTORY_AUDIT_ACTIVITY_ACTIONS.SESSION_STARTED,
    entityType: "inventory_audit_session",
    entityId: started.id,
    afterJson: JSON.stringify(started),
  });

  return started;
}

export async function getInventoryAuditSession(input: { organizationId: string; sessionId: string }) {
  return db.inventoryAuditSession.findFirst({
    where: { id: input.sessionId, organizationId: input.organizationId },
    select: {
      id: true,
      title: true,
      status: true,
      notes: true,
      plannedAt: true,
      startedAt: true,
      completedAt: true,
      audit: { select: { id: true, name: true, auditType: true, scope: true } },
      startedBy: { select: { id: true, firstName: true, lastName: true } },
      completedBy: { select: { id: true, firstName: true, lastName: true } },
      checkpoints: {
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          label: true,
          orderIndex: true,
          status: true,
          expectedItemCount: true,
          verifiedItemCount: true,
          discrepancyCount: true,
          notes: true,
        },
      },
      results: {
        orderBy: [{ verifiedAt: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          verificationStatus: true,
          scannedCode: true,
          expectedQuantity: true,
          observedQuantity: true,
          notes: true,
          verifiedAt: true,
          gearItem: { select: { id: true, name: true } },
          expectedLocation: { select: { id: true, name: true, locationCode: true } },
          observedLocation: { select: { id: true, name: true, locationCode: true } },
          verifiedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      discrepancies: {
        orderBy: [{ detectedAt: "desc" }],
        take: 30,
        select: {
          id: true,
          discrepancyType: true,
          status: true,
          summary: true,
          details: true,
          detectedAt: true,
          resolvedAt: true,
          gearItem: { select: { id: true, name: true } },
          location: { select: { id: true, name: true, locationCode: true } },
          resolvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      _count: { select: { results: true, discrepancies: true } },
    },
  });
}

export async function recordInventoryAuditVerification(input: RecordInventoryAuditVerificationInput) {
  const session = await db.inventoryAuditSession.findFirst({
    where: { id: input.auditSessionId, organizationId: input.organizationId },
    select: { id: true, status: true },
  });

  if (!session || session.status === "CANCELLED" || session.status === "COMPLETED") {
    return null;
  }

  const discrepancyType =
    input.discrepancyType ??
    inferDiscrepancyTypeFromVerification({
      verificationStatus: input.verificationStatus,
      expectedLocationId: input.expectedLocationId,
      observedLocationId: input.observedLocationId,
      expectedCustodyPersonId: input.expectedCustodyPersonId,
      observedCustodyPersonId: input.observedCustodyPersonId,
      expectedQuantity: input.expectedQuantity,
      observedQuantity: input.observedQuantity,
      expectedReadinessState: input.expectedReadinessState,
      observedReadinessState: input.observedReadinessState,
      observedConditionStatus: input.observedConditionStatus,
    });

  const recorded = await db.$transaction(async (tx) => {
    const result = await tx.inventoryAuditResult.create({
      data: {
        organizationId: input.organizationId,
        auditSessionId: input.auditSessionId,
        gearItemId: input.gearItemId ?? null,
        scanEventId: input.scanEventId ?? null,
        verificationStatus: input.verificationStatus,
        expectedLocationId: input.expectedLocationId ?? null,
        observedLocationId: input.observedLocationId ?? null,
        expectedCustodyPersonId: input.expectedCustodyPersonId ?? null,
        observedCustodyPersonId: input.observedCustodyPersonId ?? null,
        expectedQuantity: input.expectedQuantity ?? null,
        observedQuantity: input.observedQuantity ?? null,
        expectedReadinessState: input.expectedReadinessState ?? null,
        observedReadinessState: input.observedReadinessState ?? null,
        observedConditionStatus: input.observedConditionStatus ?? null,
        scannedCode: input.scannedCode ?? null,
        notes: input.notes ?? null,
        verifiedByPersonId: input.verifiedByPersonId ?? null,
        verifiedAt: new Date(),
      },
      select: { id: true, gearItemId: true, verificationStatus: true },
    });

    let discrepancyId: string | null = null;
    if (discrepancyType) {
      const discrepancy = await tx.inventoryAuditDiscrepancy.create({
        data: {
          organizationId: input.organizationId,
          auditSessionId: input.auditSessionId,
          auditResultId: result.id,
          gearItemId: input.gearItemId ?? null,
          locationId: input.observedLocationId ?? input.expectedLocationId ?? null,
          discrepancyType,
          summary: input.notes?.slice(0, 200) || "Discrepancy detected during audit verification.",
          details: input.notes ?? null,
        },
        select: { id: true },
      });
      discrepancyId = discrepancy.id;
    }

    return {
      result,
      discrepancyId,
    };
  });

  await writeAuditEvent({
    organizationId: input.organizationId,
    actorPersonId: input.verifiedByPersonId ?? null,
    action: INVENTORY_AUDIT_ACTIVITY_ACTIONS.VERIFICATION_RECORDED,
    entityType: "inventory_audit_result",
    entityId: recorded.result.id,
    afterJson: JSON.stringify(recorded.result),
    metadataJson: JSON.stringify({
      auditSessionId: input.auditSessionId,
      discrepancyType,
    }),
  });

  if (recorded.discrepancyId) {
    await writeAuditEvent({
      organizationId: input.organizationId,
      actorPersonId: input.verifiedByPersonId ?? null,
      action: INVENTORY_AUDIT_ACTIVITY_ACTIONS.DISCREPANCY_OPENED,
      entityType: "inventory_audit_discrepancy",
      entityId: recorded.discrepancyId,
      metadataJson: JSON.stringify({
        auditSessionId: input.auditSessionId,
        discrepancyType,
      }),
    });
  }

  return { resultId: recorded.result.id, discrepancyType, discrepancyId: recorded.discrepancyId };
}

export async function resolveInventoryAuditDiscrepancy(input: ResolveInventoryAuditDiscrepancyInput) {
  const updated = await db.inventoryAuditDiscrepancy.updateMany({
    where: {
      id: input.discrepancyId,
      organizationId: input.organizationId,
      status: "OPEN",
    },
    data: {
      status: input.dismissed ? "DISMISSED" : "RESOLVED",
      resolvedAt: new Date(),
      resolvedByPersonId: input.resolvedByPersonId ?? null,
      resolutionNotes: input.resolutionNotes ?? null,
    },
  });

  if (updated.count === 0) return null;

  await writeAuditEvent({
    organizationId: input.organizationId,
    actorPersonId: input.resolvedByPersonId ?? null,
    action: INVENTORY_AUDIT_ACTIVITY_ACTIONS.DISCREPANCY_RESOLVED,
    entityType: "inventory_audit_discrepancy",
    entityId: input.discrepancyId,
    metadataJson: JSON.stringify({
      dismissed: Boolean(input.dismissed),
    }),
  });

  return { id: input.discrepancyId };
}

export async function summarizeInventoryAuditSession(input: { organizationId: string; sessionId: string }) {
  const [resultCounts, discrepancyCounts] = await Promise.all([
    db.inventoryAuditResult.groupBy({
      by: ["verificationStatus"],
      where: { organizationId: input.organizationId, auditSessionId: input.sessionId },
      _count: { _all: true },
    }),
    db.inventoryAuditDiscrepancy.groupBy({
      by: ["status"],
      where: { organizationId: input.organizationId, auditSessionId: input.sessionId },
      _count: { _all: true },
    }),
  ]);

  return {
    verification: resultCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.verificationStatus] = row._count._all;
      return acc;
    }, {}),
    discrepancies: discrepancyCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {}),
  };
}

export { INVENTORY_AUDIT_ACTIVITY_ACTIONS };
