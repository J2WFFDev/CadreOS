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
  void input;
  return;
}
