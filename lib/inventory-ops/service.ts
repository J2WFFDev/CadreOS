/**
 * Arc 20A — Inventory Operations Architecture
 *
 * Core inventory operations service.
 * Provides movement recording, custody lookup, location management,
 * and kit management operations built on top of GearOps models.
 *
 * All writes are organization-scoped and append-only for movements,
 * ensuring full traceability of inventory lifecycle events.
 */

import { db } from "@/lib/db";
import type {
  AddItemToKitInput,
  CreateInventoryKitInput,
  CreateInventoryLocationInput,
  InventoryKitSummary,
  InventoryLocationSummary,
  InventoryMovementView,
  RecordInventoryMovementInput,
  RemoveItemFromKitInput,
  UpdateInventoryLocationInput,
} from "./types";
import { INVENTORY_ACTIVITY_ACTIONS, lifecycleStatusForMovementType } from "./types";

// ── Movement recording ───────────────────────────────────────────────────────

/**
 * Records an InventoryMovement event for a gear item.
 *
 * Optionally updates the item's lifecycle status and/or location atomically
 * in the same DB transaction. This ensures the item state and its movement
 * history remain consistent.
 *
 * Movement records are immutable once written (append-only audit trail).
 */
export async function recordInventoryMovement(input: RecordInventoryMovementInput) {
  const gearItem = await db.gearItem.findFirst({
    where: { id: input.gearItemId, organizationId: input.organizationId },
    select: { id: true, name: true, lifecycleStatus: true, locationId: true },
  });

  if (!gearItem) return null;

  // Infer lifecycle status change if not explicitly provided
  const impliedStatus = lifecycleStatusForMovementType(input.movementType);
  const nextLifecycleStatus = input.updateLifecycleStatus ?? impliedStatus;
  const nextLocationId =
    input.updateLocationId === "CLEAR"
      ? null
      : input.updateLocationId !== undefined
        ? input.updateLocationId
        : input.toLocationId;

  const movement = await db.$transaction(async (tx) => {
    const movement = await tx.inventoryMovement.create({
      data: {
        organizationId: input.organizationId,
        gearItemId: input.gearItemId,
        movementType: input.movementType,
        fromLocationId: input.fromLocationId ?? gearItem.locationId,
        toLocationId: input.toLocationId ?? null,
        actorPersonId: input.actorPersonId,
        custodyPersonId: input.custodyPersonId ?? null,
        relatedRecordType: input.relatedRecordType ?? null,
        relatedRecordId: input.relatedRecordId ?? null,
        notes: input.notes ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
      select: { id: true, movementType: true, occurredAt: true },
    });

    if (nextLifecycleStatus || nextLocationId !== undefined) {
      await tx.gearItem.update({
        where: { id: gearItem.id },
        data: {
          ...(nextLifecycleStatus ? { lifecycleStatus: nextLifecycleStatus } : {}),
          ...(nextLocationId !== undefined ? { locationId: nextLocationId } : {}),
        },
      });
    }

    return movement;
  });

  return movement;
}

// ── Movement history ─────────────────────────────────────────────────────────

/**
 * Returns the full movement history for a gear item, ordered newest first.
 */
export async function listInventoryMovements(input: {
  organizationId: string;
  gearItemId: string;
  limit?: number;
}): Promise<InventoryMovementView[]> {
  const movements = await db.inventoryMovement.findMany({
    where: {
      organizationId: input.organizationId,
      gearItemId: input.gearItemId,
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: input.limit ?? 50,
    select: {
      id: true,
      movementType: true,
      fromLocation: { select: { id: true, name: true, locationCode: true } },
      toLocation: { select: { id: true, name: true, locationCode: true } },
      actor: { select: { id: true, firstName: true, lastName: true } },
      custodyPerson: { select: { id: true, firstName: true, lastName: true } },
      relatedRecordType: true,
      relatedRecordId: true,
      notes: true,
      occurredAt: true,
    },
  });

  return movements;
}

/**
 * Returns the most recent custody holder for a gear item.
 * Custody is determined by the latest movement with a custodyPersonId set.
 */
export async function getCurrentCustody(input: {
  organizationId: string;
  gearItemId: string;
}): Promise<{ id: string; firstName: string; lastName: string } | null> {
  const latest = await db.inventoryMovement.findFirst({
    where: {
      organizationId: input.organizationId,
      gearItemId: input.gearItemId,
      custodyPersonId: { not: null },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    select: { custodyPerson: { select: { id: true, firstName: true, lastName: true } } },
  });

  return latest?.custodyPerson ?? null;
}

// ── Location management ──────────────────────────────────────────────────────

/**
 * Creates a new InventoryLocation for the organization.
 */
export async function createInventoryLocation(input: CreateInventoryLocationInput) {
  return db.inventoryLocation.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description ?? null,
      locationCode: input.locationCode ?? null,
      parentLocationId: input.parentLocationId ?? null,
    },
    select: { id: true, name: true, locationCode: true },
  });
}

/**
 * Updates an InventoryLocation's editable fields.
 */
export async function updateInventoryLocation(input: UpdateInventoryLocationInput) {
  const existing = await db.inventoryLocation.findFirst({
    where: { id: input.locationId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!existing) return null;

  return db.inventoryLocation.update({
    where: { id: existing.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.locationCode !== undefined ? { locationCode: input.locationCode } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: { id: true, name: true, locationCode: true, isActive: true },
  });
}

/**
 * Lists inventory locations for an organization with item counts.
 */
export async function listInventoryLocations(input: {
  organizationId: string;
  activeOnly?: boolean;
}): Promise<InventoryLocationSummary[]> {
  const locations = await db.inventoryLocation.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      locationCode: true,
      isActive: true,
      parentLocation: { select: { id: true, name: true, locationCode: true } },
      _count: { select: { gearItems: true } },
    },
  });

  return locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    description: loc.description,
    locationCode: loc.locationCode,
    isActive: loc.isActive,
    parentLocation: loc.parentLocation,
    itemCount: loc._count.gearItems,
  }));
}

// ── Kit management ───────────────────────────────────────────────────────────

/**
 * Creates a new InventoryKit.
 */
export async function createInventoryKit(input: CreateInventoryKitInput) {
  return db.inventoryKit.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description ?? null,
      ownerPersonId: input.ownerPersonId ?? null,
    },
    select: { id: true, name: true },
  });
}

/**
 * Adds a gear item to a kit. Idempotent: if the item is already in the kit
 * and not removed, updates the quantity.
 */
export async function addItemToKit(input: AddItemToKitInput) {
  const existing = await db.inventoryKitItem.findFirst({
    where: {
      kitId: input.kitId,
      gearItemId: input.gearItemId,
      removedAt: null,
    },
    select: { id: true },
  });

  if (existing) {
    return db.inventoryKitItem.update({
      where: { id: existing.id },
      data: { quantity: input.quantity ?? 1 },
      select: { id: true },
    });
  }

  return db.inventoryKitItem.create({
    data: {
      organizationId: input.organizationId,
      kitId: input.kitId,
      gearItemId: input.gearItemId,
      quantity: input.quantity ?? 1,
      notes: input.notes ?? null,
    },
    select: { id: true },
  });
}

/**
 * Removes a gear item from a kit (soft-delete via removedAt).
 */
export async function removeItemFromKit(input: RemoveItemFromKitInput) {
  const existing = await db.inventoryKitItem.findFirst({
    where: {
      kitId: input.kitId,
      gearItemId: input.gearItemId,
      removedAt: null,
    },
    select: { id: true },
  });

  if (!existing) return null;

  return db.inventoryKitItem.update({
    where: { id: existing.id },
    data: { removedAt: new Date() },
    select: { id: true },
  });
}

/**
 * Lists inventory kits for an organization.
 */
export async function listInventoryKits(input: {
  organizationId: string;
  activeOnly?: boolean;
}): Promise<InventoryKitSummary[]> {
  const kits = await db.inventoryKit.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      owner: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { items: true } },
    },
  });

  return kits.map((kit) => ({
    id: kit.id,
    name: kit.name,
    description: kit.description,
    isActive: kit.isActive,
    owner: kit.owner,
    itemCount: kit._count.items,
  }));
}

// ── Activity helper ──────────────────────────────────────────────────────────

/**
 * Action constant re-exports for convenience in route handlers.
 */
export { INVENTORY_ACTIVITY_ACTIONS };
