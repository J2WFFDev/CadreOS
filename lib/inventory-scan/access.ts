import { resolveInventoryOpsReadAccess, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";

export { type InventoryOpsAccess as InventoryScanAccess } from "@/lib/inventory-ops";

export async function resolveInventoryScanReadAccess(input: {
  organizationId: string;
  actorPersonId: string | null;
  workflow: string;
}) {
  return resolveInventoryOpsReadAccess(input);
}

export async function resolveInventoryScanWriteAccess(input: {
  organizationId: string;
  actorPersonId: string | null;
  workflow: string;
}) {
  return resolveInventoryOpsWriteAccess(input);
}
