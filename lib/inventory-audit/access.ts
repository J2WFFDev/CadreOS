import { resolveInventoryOpsReadAccess, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";

export { type InventoryOpsAccess as InventoryAuditAccess } from "@/lib/inventory-ops";

export async function resolveInventoryAuditReadAccess(input: {
  organizationId: string;
  actorPersonId: string | null;
  workflow: string;
}) {
  return resolveInventoryOpsReadAccess(input);
}

export async function resolveInventoryAuditWriteAccess(input: {
  organizationId: string;
  actorPersonId: string | null;
  workflow: string;
}) {
  return resolveInventoryOpsWriteAccess(input);
}
