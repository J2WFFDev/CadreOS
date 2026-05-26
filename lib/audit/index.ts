import { db } from "@/lib/db";

export type AuditWriteInput = {
  organizationId: string;
  actorPersonId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson?: string | null;
  afterJson?: string | null;
  metadataJson?: string | null;
};

export async function writeAuditEvent(input: AuditWriteInput): Promise<void> {
  await db.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.beforeJson ?? null,
      afterJson: input.afterJson ?? null,
      metadataJson: input.metadataJson ?? null,
    },
  });
}
