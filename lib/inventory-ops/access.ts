/**
 * Arc 20A — Inventory Operations Architecture
 *
 * Authorization helpers for inventory operations.
 * Inventory read/write access inherits from GearOps staff authorization.
 */

import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";

export type InventoryOpsAccess = {
  allowed: boolean;
  denialMessage?: string;
  organizationId: string;
};

/**
 * Resolves read access to inventory operations (locations, movements, kits).
 * Uses the same staff-scoped authorization model as GearOps catalog reads.
 */
export async function resolveInventoryOpsReadAccess(input: {
  organizationId: string;
  actorPersonId: string | null;
  workflow: string;
}): Promise<InventoryOpsAccess> {
  const gearAccess = await resolveGearOpsReadAccess({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
    workflow: input.workflow,
  });

  return {
    allowed: gearAccess.allowed,
    denialMessage: gearAccess.denialMessage,
    organizationId: input.organizationId,
  };
}

/**
 * Resolves write access to inventory operations.
 * Currently mirrors read access (staff-only), allowing any staff with GearOps
 * visibility to perform inventory write operations. This may be tightened in
 * a future Arc to require explicit GEAR_OPS_ADMIN or similar role.
 */
export async function resolveInventoryOpsWriteAccess(input: {
  organizationId: string;
  actorPersonId: string | null;
  workflow: string;
}): Promise<InventoryOpsAccess> {
  return resolveInventoryOpsReadAccess(input);
}
