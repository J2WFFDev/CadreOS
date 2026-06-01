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
import { GearCheckoutStatus, GearReservationStatus, InventoryMovementType } from "@prisma/client";
import { findReservationToFulfill } from "@/lib/gear-reservations";
import type {
  AddItemToKitInput,
  AssignKitInput,
  CheckInKitInput,
  CheckOutKitInput,
  CreateInventoryKitInput,
  CreateInventoryLocationInput,
  InventoryKitSummary,
  InventoryLocationSummary,
  InventoryMovementView,
  LogKitInspectionInput,
  RecordInventoryMovementInput,
  RemoveItemFromKitInput,
  ReserveKitInput,
  UpdateInventoryKitInput,
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
      category: input.category ?? null,
      notes: input.notes ?? null,
      ownerPersonId: input.ownerPersonId ?? null,
      kitType: input.kitType ?? "KIT",
    },
    select: { id: true, name: true, kitType: true },
  });
}

/**
 * Updates an existing InventoryKit's editable fields.
 */
export async function updateInventoryKit(input: UpdateInventoryKitInput) {
  const existing = await db.inventoryKit.findFirst({
    where: { id: input.kitId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!existing) return null;

  return db.inventoryKit.update({
    where: { id: existing.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.ownerPersonId !== undefined ? { ownerPersonId: input.ownerPersonId } : {}),
      ...(input.kitType ? { kitType: input.kitType } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: { id: true, name: true, kitType: true, isActive: true },
  });
}

/**
 * Adds a gear item to a kit. Idempotent: if the item is already in the kit
 * and not removed, updates the quantity and component role.
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
      data: {
        quantity: input.quantity ?? 1,
        quantityExpected: input.quantityExpected ?? input.quantity ?? 1,
        ...(input.componentRole ? { componentRole: input.componentRole } : {}),
        ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      select: { id: true },
    });
  }

  return db.inventoryKitItem.create({
    data: {
      organizationId: input.organizationId,
      kitId: input.kitId,
      gearItemId: input.gearItemId,
      componentRole: input.componentRole ?? "REQUIRED",
      isRequired: input.isRequired ?? true,
      quantity: input.quantity ?? 1,
      quantityExpected: input.quantityExpected ?? input.quantity ?? 1,
      sortOrder: input.sortOrder ?? 0,
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
      category: true,
      notes: true,
      kitType: true,
      isActive: true,
      readinessLabel: true,
      custodyStatus: true,
      lastInspectionStatus: true,
      owner: { select: { id: true, firstName: true, lastName: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { items: { where: { removedAt: null } } } },
    },
  });

  return kits.map((kit) => ({
    id: kit.id,
    name: kit.name,
    description: kit.description,
    category: kit.category,
    notes: kit.notes,
    kitType: kit.kitType,
    isActive: kit.isActive,
    readinessLabel: kit.readinessLabel,
    custodyStatus: kit.custodyStatus,
    lastInspectionStatus: kit.lastInspectionStatus,
    owner: kit.owner,
    assignedTo: kit.assignedTo,
    itemCount: kit._count.items,
  }));
}

// ── Kit custody operations ───────────────────────────────────────────────────

/**
 * Checks out a full kit (or partial kit) to a person.
 *
 * Records a GearKitCustodyEvent and optionally creates individual
 * GearCheckout records for each child gear item involved.
 * Updates the kit's custodyStatus to CHECKED_OUT.
 *
 * Partial checkout is flagged explicitly and does not update kit-level
 * custody status to CHECKED_OUT — custody status remains AVAILABLE with
 * the partial event logged for visibility.
 */
export function resolveKitChildSelection(allKitItemIds: string[], requestedItemIds?: string[] | null) {
  if (requestedItemIds == null) {
    return {
      targetItemIds: allKitItemIds,
      isPartial: false,
    };
  }

  const targetItemIds = allKitItemIds.filter((itemId) => requestedItemIds.includes(itemId));

  return {
    targetItemIds,
    isPartial: targetItemIds.length !== allKitItemIds.length,
  };
}

export async function checkOutKit(input: CheckOutKitInput) {
  const kit = await db.inventoryKit.findFirst({
    where: { id: input.kitId, organizationId: input.organizationId },
    select: {
      id: true,
      custodyStatus: true,
      items: {
        where: { removedAt: null },
        select: { id: true, gearItemId: true },
      },
    },
  });

  if (!kit) return null;

  const allKitItemIds = kit.items.map((i) => i.gearItemId);
  const { targetItemIds, isPartial } = resolveKitChildSelection(allKitItemIds, input.partialChildGearItemIds);
  const isPartialCheckout = input.isPartial ?? isPartial;

  const childItemIdsJson = JSON.stringify(targetItemIds);

  const result = await db.$transaction(async (tx) => {
    const now = new Date();
    const custodyEvent = await tx.gearKitCustodyEvent.create({
      data: {
        organizationId: input.organizationId,
        kitId: input.kitId,
        eventType: isPartialCheckout ? "PARTIAL_CHECKOUT" : "CHECKED_OUT",
        actorPersonId: input.actorPersonId,
        custodyPersonId: input.custodyPersonId,
        relatedEventId: input.relatedEventId ?? null,
        notes: input.notes ?? null,
        childItemIdsJson,
        isPartial: isPartialCheckout,
        occurredAt: now,
      },
      select: { id: true },
    });

    if (!isPartialCheckout) {
      await tx.inventoryKit.update({
        where: { id: kit.id },
        data: {
          custodyStatus: "CHECKED_OUT",
          assignedToPersonId: input.custodyPersonId,
        },
      });
    }

    if (targetItemIds.length > 0) {
      const existingOpenCheckouts = await tx.gearCheckout.findMany({
        where: {
          organizationId: input.organizationId,
          gearItemId: { in: targetItemIds },
          status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] },
        },
        select: { gearItemId: true },
      });
      const existingOpenItemIdSet = new Set(existingOpenCheckouts.map((checkout) => checkout.gearItemId));
      const checkoutItemIds = targetItemIds.filter((itemId) => !existingOpenItemIdSet.has(itemId));

      if (checkoutItemIds.length > 0) {
        await tx.gearCheckout.createMany({
          data: checkoutItemIds.map((itemId) => ({
            organizationId: input.organizationId,
            gearItemId: itemId,
            status: GearCheckoutStatus.OPEN,
            checkedOutById: input.custodyPersonId,
            issuedById: input.actorPersonId,
            eventId: input.relatedEventId ?? null,
            checkedOutAt: now,
            purposeNotes: input.notes ?? null,
          })),
        });

        const reservations = await tx.gearReservation.findMany({
          where: {
            organizationId: input.organizationId,
            gearItemId: { in: checkoutItemIds },
            status: {
              in: [
                GearReservationStatus.ACTIVE,
                GearReservationStatus.PENDING_REVIEW,
                GearReservationStatus.CONFLICT,
              ],
            },
          },
          select: {
            id: true,
            gearItemId: true,
            mode: true,
            status: true,
            approvalStatus: true,
            holdType: true,
            purpose: true,
            quantityRequested: true,
            windowStartAt: true,
            windowEndAt: true,
            reservedForPersonId: true,
            reservedForTeamId: true,
            reservedForEventId: true,
            programId: true,
            conflictSummary: true,
          },
        });

        for (const itemId of checkoutItemIds) {
          const reservationToFulfill = findReservationToFulfill({
            reservations: reservations.filter((reservation) => reservation.gearItemId === itemId),
            personId: input.custodyPersonId,
            eventId: input.relatedEventId ?? null,
          });

          if (!reservationToFulfill) {
            continue;
          }

          await tx.gearReservation.update({
            where: { id: reservationToFulfill.id },
            data: {
              status: GearReservationStatus.FULFILLED,
              fulfilledAt: now,
              releasedByPersonId: input.actorPersonId,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              organizationId: input.organizationId,
              gearItemId: itemId,
              movementType: InventoryMovementType.RESERVATION_RELEASED,
              actorPersonId: input.actorPersonId,
              relatedRecordType: "GEAR_RESERVATION",
              relatedRecordId: reservationToFulfill.id,
              notes: "Reservation fulfilled by kit checkout.",
              occurredAt: now,
            },
          });
        }
      }
    }

    return custodyEvent;
  });

  return result;
}

/**
 * Checks in a kit (or partial return), returning custody to the organization.
 *
 * Records a GearKitCustodyEvent and updates kit custodyStatus to AVAILABLE.
 */
export async function checkInKit(input: CheckInKitInput) {
  const kit = await db.inventoryKit.findFirst({
    where: { id: input.kitId, organizationId: input.organizationId },
    select: {
      id: true,
      custodyStatus: true,
      items: {
        where: { removedAt: null },
        select: { id: true, gearItemId: true },
      },
    },
  });

  if (!kit) return null;

  const allKitItemIds = kit.items.map((i) => i.gearItemId);
  const { targetItemIds, isPartial } = resolveKitChildSelection(allKitItemIds, input.partialChildGearItemIds);
  const isPartialReturn = input.isPartial ?? isPartial;

  const childItemIdsJson = JSON.stringify(targetItemIds);

  return db.$transaction(async (tx) => {
    const now = new Date();
    const missingGearItemIds = new Set(input.missingGearItemIds ?? []);
    const damagedGearItemIds = new Set(input.damagedGearItemIds ?? []);
    const maintenanceGearItemIds = new Set(input.maintenanceGearItemIds ?? []);
    const custodyEvent = await tx.gearKitCustodyEvent.create({
      data: {
        organizationId: input.organizationId,
        kitId: input.kitId,
        eventType: isPartialReturn ? "PARTIAL_RETURN" : "CHECKED_IN",
        actorPersonId: input.actorPersonId,
        custodyPersonId: null,
        notes: input.notes ?? null,
        childItemIdsJson,
        isPartial: isPartialReturn,
        occurredAt: now,
      },
      select: { id: true },
    });

    if (!isPartialReturn) {
      await tx.inventoryKit.update({
        where: { id: kit.id },
        data: {
          custodyStatus: "AVAILABLE",
          assignedToPersonId: null,
        },
      });
    }

    if (targetItemIds.length > 0) {
      await tx.gearCheckout.updateMany({
        where: {
          organizationId: input.organizationId,
          gearItemId: { in: targetItemIds },
          status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] },
        },
        data: {
          status: GearCheckoutStatus.RETURNED,
          returnedAt: now,
          returnedById: input.actorPersonId,
          receivedById: input.actorPersonId,
          returnNotes: input.notes ?? "Returned through kit check-in.",
        },
      });
    }

    if (missingGearItemIds.size > 0 || damagedGearItemIds.size > 0 || maintenanceGearItemIds.size > 0) {
      const itemConditions = targetItemIds
        .filter((itemId) => damagedGearItemIds.has(itemId) || maintenanceGearItemIds.has(itemId))
        .map((itemId) => ({
          gearItemId: itemId,
          conditionStatus: damagedGearItemIds.has(itemId) ? "DAMAGED" : null,
          notes: maintenanceGearItemIds.has(itemId) ? "Needs maintenance from kit return validation." : null,
        }));

      await tx.gearKitInspection.create({
        data: {
          organizationId: input.organizationId,
          kitId: input.kitId,
          inspectedByPersonId: input.actorPersonId,
          status: missingGearItemIds.size > 0 ? "INCOMPLETE" : "PASSED_WITH_NOTES",
          notes: input.notes ?? "Kit return validation recorded item issues.",
          itemConditionsJson: itemConditions.length > 0 ? JSON.stringify(itemConditions) : null,
          missingItemIdsJson:
            missingGearItemIds.size > 0
              ? JSON.stringify(Array.from(missingGearItemIds))
              : null,
        },
      });

      for (const itemId of maintenanceGearItemIds) {
        await tx.gearMaintenanceLog.create({
          data: {
            organizationId: input.organizationId,
            gearItemId: itemId,
            performedByPersonId: input.actorPersonId,
            maintenanceType: "INSPECTION",
            performedAt: now,
            notes: "Auto-created from static kit return validation.",
          },
        });
      }

      if (damagedGearItemIds.size > 0) {
        await tx.gearItem.updateMany({
          where: {
            organizationId: input.organizationId,
            id: { in: [...damagedGearItemIds] },
          },
          data: {
            conditionStatus: "DAMAGED",
            readinessState: "MAINTENANCE_REQUIRED",
          },
        });
      }

      const maintenanceOnlyItemIds = [...maintenanceGearItemIds].filter(
        (itemId) => !damagedGearItemIds.has(itemId),
      );
      if (maintenanceOnlyItemIds.length > 0) {
        await tx.gearItem.updateMany({
          where: {
            organizationId: input.organizationId,
            id: { in: maintenanceOnlyItemIds },
          },
          data: {
            readinessState: "MAINTENANCE_REQUIRED",
          },
        });
      }
    }

    return custodyEvent;
  });
}

/**
 * Assigns a kit to a person, team, or event.
 * Records a GearKitCustodyEvent and updates assignment fields on the kit.
 */
export async function assignKit(input: AssignKitInput) {
  const kit = await db.inventoryKit.findFirst({
    where: { id: input.kitId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!kit) return null;

  return db.$transaction(async (tx) => {
    await tx.inventoryKit.update({
      where: { id: kit.id },
      data: {
        custodyStatus: "ASSIGNED",
        assignedToPersonId: input.assignToPersonId ?? null,
        assignedToTeamId: input.assignToTeamId ?? null,
        assignedToEventId: input.assignToEventId ?? null,
      },
    });

    return tx.gearKitCustodyEvent.create({
      data: {
        organizationId: input.organizationId,
        kitId: input.kitId,
        eventType: "ASSIGNED",
        actorPersonId: input.actorPersonId,
        custodyPersonId: input.assignToPersonId ?? null,
        relatedEventId: input.assignToEventId ?? null,
        notes: input.notes ?? null,
        isPartial: false,
        occurredAt: new Date(),
      },
      select: { id: true },
    });
  });
}

/**
 * Logs a kit inspection result.
 * Updates lastInspectedAt, lastInspectionStatus, and custodyStatus on the kit.
 * Sets custodyStatus to IN_INSPECTION while inspection is INCOMPLETE,
 * and reverts to AVAILABLE when passed.
 */
export async function logKitInspection(input: LogKitInspectionInput) {
  const kit = await db.inventoryKit.findFirst({
    where: { id: input.kitId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!kit) return null;

  const itemConditionsJson = input.itemConditions
    ? JSON.stringify(input.itemConditions)
    : null;
  const missingItemIdsJson = input.missingItemIds
    ? JSON.stringify(input.missingItemIds)
    : null;

  const nextCustodyStatus =
    input.status === "INCOMPLETE" ? "IN_INSPECTION" : "AVAILABLE";

  return db.$transaction(async (tx) => {
    const inspection = await tx.gearKitInspection.create({
      data: {
        organizationId: input.organizationId,
        kitId: input.kitId,
        inspectedByPersonId: input.inspectedByPersonId,
        status: input.status,
        notes: input.notes ?? null,
        itemConditionsJson,
        missingItemIdsJson,
      },
      select: { id: true, status: true },
    });

    await tx.inventoryKit.update({
      where: { id: kit.id },
      data: {
        lastInspectedAt: new Date(),
        lastInspectionStatus: input.status,
        custodyStatus: nextCustodyStatus,
      },
    });

    await tx.gearKitCustodyEvent.create({
      data: {
        organizationId: input.organizationId,
        kitId: input.kitId,
        eventType: "INSPECTION_LOGGED",
        actorPersonId: input.inspectedByPersonId,
        notes: input.notes ?? null,
        isPartial: false,
        occurredAt: new Date(),
      },
    });

    return inspection;
  });
}

/**
 * Reserves/holds a kit for an event or other purpose.
 * Updates custodyStatus to RESERVED and logs the custody event.
 */
export async function reserveKit(input: ReserveKitInput) {
  const kit = await db.inventoryKit.findFirst({
    where: { id: input.kitId, organizationId: input.organizationId },
    select: { id: true, custodyStatus: true },
  });

  if (!kit) return null;

  return db.$transaction(async (tx) => {
    await tx.inventoryKit.update({
      where: { id: kit.id },
      data: {
        custodyStatus: "RESERVED",
        assignedToEventId: input.relatedEventId ?? null,
      },
    });

    return tx.gearKitCustodyEvent.create({
      data: {
        organizationId: input.organizationId,
        kitId: input.kitId,
        eventType: "RESERVED",
        actorPersonId: input.actorPersonId,
        relatedEventId: input.relatedEventId ?? null,
        notes: input.notes ?? null,
        isPartial: false,
        occurredAt: new Date(),
      },
      select: { id: true },
    });
  });
}

/**
 * Releases a kit reservation, returning it to AVAILABLE custody.
 */
export async function releaseKitReservation(input: {
  organizationId: string;
  kitId: string;
  actorPersonId: string;
  notes?: string | null;
}) {
  const kit = await db.inventoryKit.findFirst({
    where: { id: input.kitId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!kit) return null;

  return db.$transaction(async (tx) => {
    await tx.inventoryKit.update({
      where: { id: kit.id },
      data: {
        custodyStatus: "AVAILABLE",
        assignedToEventId: null,
        assignedToPersonId: null,
        assignedToTeamId: null,
      },
    });

    return tx.gearKitCustodyEvent.create({
      data: {
        organizationId: input.organizationId,
        kitId: input.kitId,
        eventType: "RESERVATION_RELEASED",
        actorPersonId: input.actorPersonId,
        notes: input.notes ?? null,
        isPartial: false,
        occurredAt: new Date(),
      },
      select: { id: true },
    });
  });
}

/**
 * Deploys a kit to an event.
 * Updates custodyStatus to DEPLOYED and records the custody event.
 */
export async function deployKitToEvent(input: {
  organizationId: string;
  kitId: string;
  actorPersonId: string;
  eventId: string;
  notes?: string | null;
}) {
  const kit = await db.inventoryKit.findFirst({
    where: { id: input.kitId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!kit) return null;

  return db.$transaction(async (tx) => {
    await tx.inventoryKit.update({
      where: { id: kit.id },
      data: {
        custodyStatus: "DEPLOYED",
        assignedToEventId: input.eventId,
      },
    });

    return tx.gearKitCustodyEvent.create({
      data: {
        organizationId: input.organizationId,
        kitId: input.kitId,
        eventType: "DEPLOYED",
        actorPersonId: input.actorPersonId,
        relatedEventId: input.eventId,
        notes: input.notes ?? null,
        isPartial: false,
        occurredAt: new Date(),
      },
      select: { id: true },
    });
  });
}

/**
 * Recovers a kit from an event deployment, returning it to AVAILABLE.
 */
export async function recoverKitFromEvent(input: {
  organizationId: string;
  kitId: string;
  actorPersonId: string;
  notes?: string | null;
}) {
  const kit = await db.inventoryKit.findFirst({
    where: { id: input.kitId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!kit) return null;

  return db.$transaction(async (tx) => {
    await tx.inventoryKit.update({
      where: { id: kit.id },
      data: {
        custodyStatus: "AVAILABLE",
        assignedToEventId: null,
      },
    });

    return tx.gearKitCustodyEvent.create({
      data: {
        organizationId: input.organizationId,
        kitId: input.kitId,
        eventType: "RECOVERED",
        actorPersonId: input.actorPersonId,
        notes: input.notes ?? null,
        isPartial: false,
        occurredAt: new Date(),
      },
      select: { id: true },
    });
  });
}

/**
 * Lists custody event history for a kit, newest first.
 */
export async function listKitCustodyHistory(input: {
  organizationId: string;
  kitId: string;
  limit?: number;
}) {
  return db.gearKitCustodyEvent.findMany({
    where: {
      organizationId: input.organizationId,
      kitId: input.kitId,
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: input.limit ?? 50,
    select: {
      id: true,
      eventType: true,
      isPartial: true,
      notes: true,
      occurredAt: true,
      actor: { select: { id: true, firstName: true, lastName: true } },
      custodyPerson: { select: { id: true, firstName: true, lastName: true } },
      relatedEvent: { select: { id: true, title: true } },
    },
  });
}

/**
 * Lists inspection history for a kit, newest first.
 */
export async function listKitInspections(input: {
  organizationId: string;
  kitId: string;
  limit?: number;
}) {
  return db.gearKitInspection.findMany({
    where: {
      organizationId: input.organizationId,
      kitId: input.kitId,
    },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit ?? 20,
    select: {
      id: true,
      status: true,
      notes: true,
      itemConditionsJson: true,
      missingItemIdsJson: true,
      createdAt: true,
      inspector: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

// ── Activity helper ──────────────────────────────────────────────────────────

/**
 * Action constant re-exports for convenience in route handlers.
 */
export { INVENTORY_ACTIVITY_ACTIONS };
