/**
 * Arc 20A — Inventory Operations Architecture
 *
 * Canonical TypeScript type definitions for the InventoryOps domain model.
 * These types represent operational inventory behaviors layered on top of the
 * existing GearOps CRUD foundation.
 */

import type {
  GearItemLifecycleStatus,
  InventoryMovementType,
  InventoryOwnershipType,
  InventoryReadinessState,
} from "@prisma/client";

// ── Re-export Prisma enums for convenience ──────────────────────────────────

export {
  GearItemLifecycleStatus,
  InventoryMovementType,
  InventoryOwnershipType,
  InventoryReadinessState,
};

// ── Inventory state constants ───────────────────────────────────────────────

/** Operational inventory states in display-priority order. */
export const INVENTORY_LIFECYCLE_STATES: GearItemLifecycleStatus[] = [
  "ACTIVE",
  "ASSIGNED",
  "CHECKED_OUT",
  "RESERVED",
  "MAINTENANCE",
  "QUARANTINED",
  "RETIRED",
  "LOST",
];

/** States that indicate the item is operationally unavailable. */
export const INVENTORY_UNAVAILABLE_STATES: GearItemLifecycleStatus[] = [
  "ASSIGNED",
  "CHECKED_OUT",
  "MAINTENANCE",
  "QUARANTINED",
  "RETIRED",
  "LOST",
];

/** States that indicate the item needs operational attention. */
export const INVENTORY_ATTENTION_STATES: GearItemLifecycleStatus[] = [
  "MAINTENANCE",
  "QUARANTINED",
  "LOST",
];

// ── Movement type groupings ─────────────────────────────────────────────────

/** Movement types that represent custody transfers. */
export const CUSTODY_MOVEMENT_TYPES: InventoryMovementType[] = [
  "CHECKED_OUT",
  "CHECKED_IN",
  "ASSIGNED",
  "UNASSIGNED",
  "LOANED_OUT",
  "LOAN_RETURNED",
];

/** Movement types that represent location changes. */
export const LOCATION_MOVEMENT_TYPES: InventoryMovementType[] = [
  "MOVED_TO_LOCATION",
  "TRANSFERRED",
  "SENT_FOR_MAINTENANCE",
  "RETURNED_FROM_MAINTENANCE",
];

/** Movement types that represent lifecycle transitions. */
export const LIFECYCLE_MOVEMENT_TYPES: InventoryMovementType[] = [
  "RESERVED",
  "RESERVATION_RELEASED",
  "LOST",
  "FOUND",
  "RETIRED",
  "RECEIVED",
  "QUARANTINED",
  "QUARANTINE_RELEASED",
];

// ── Input types ─────────────────────────────────────────────────────────────

/** Input for recording an inventory movement event. */
export type RecordInventoryMovementInput = {
  organizationId: string;
  gearItemId: string;
  movementType: InventoryMovementType;
  actorPersonId: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  custodyPersonId?: string | null;
  relatedRecordType?: string | null;
  relatedRecordId?: string | null;
  notes?: string | null;
  occurredAt?: Date | null;
  /** If provided, updates the gear item's lifecycle status after recording movement. */
  updateLifecycleStatus?: GearItemLifecycleStatus | null;
  /** If provided, updates the gear item's location after recording movement. */
  updateLocationId?: string | "CLEAR" | null;
};

/** Input for creating an inventory location. */
export type CreateInventoryLocationInput = {
  organizationId: string;
  name: string;
  description?: string | null;
  locationCode?: string | null;
  parentLocationId?: string | null;
};

/** Input for updating an inventory location. */
export type UpdateInventoryLocationInput = {
  organizationId: string;
  locationId: string;
  name?: string;
  description?: string | null;
  locationCode?: string | null;
  isActive?: boolean;
};

/** Input for creating an inventory kit. */
export type CreateInventoryKitInput = {
  organizationId: string;
  name: string;
  description?: string | null;
  ownerPersonId?: string | null;
};

/** Input for adding an item to a kit. */
export type AddItemToKitInput = {
  organizationId: string;
  kitId: string;
  gearItemId: string;
  quantity?: number;
  notes?: string | null;
};

/** Input for removing an item from a kit. */
export type RemoveItemFromKitInput = {
  organizationId: string;
  kitId: string;
  gearItemId: string;
};

// ── View/projection types ────────────────────────────────────────────────────

/** Minimal location reference for display. */
export type InventoryLocationRef = {
  id: string;
  name: string;
  locationCode: string | null;
};

/** Full inventory movement view for history display. */
export type InventoryMovementView = {
  id: string;
  movementType: InventoryMovementType;
  fromLocation: InventoryLocationRef | null;
  toLocation: InventoryLocationRef | null;
  actor: { id: string; firstName: string; lastName: string };
  custodyPerson: { id: string; firstName: string; lastName: string } | null;
  relatedRecordType: string | null;
  relatedRecordId: string | null;
  notes: string | null;
  occurredAt: Date;
};

/** Summary view for inventory location (list display). */
export type InventoryLocationSummary = {
  id: string;
  name: string;
  description: string | null;
  locationCode: string | null;
  isActive: boolean;
  parentLocation: InventoryLocationRef | null;
  itemCount: number;
};

/** Summary view for an inventory kit. */
export type InventoryKitSummary = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  owner: { id: string; firstName: string; lastName: string } | null;
  itemCount: number;
};

// ── Activity action constants ────────────────────────────────────────────────

/** Standardized action strings for inventory movement activity integration. */
export const INVENTORY_ACTIVITY_ACTIONS = {
  MOVEMENT_RECORDED: "inventory.movement.recorded",
  LOCATION_CREATED: "inventory.location.created",
  LOCATION_UPDATED: "inventory.location.updated",
  KIT_CREATED: "inventory.kit.created",
  KIT_ITEM_ADDED: "inventory.kit.item_added",
  KIT_ITEM_REMOVED: "inventory.kit.item_removed",
  READINESS_STATE_CHANGED: "inventory.readiness_state.changed",
  OWNERSHIP_TYPE_SET: "inventory.ownership_type.set",
} as const;

export type InventoryActivityAction =
  (typeof INVENTORY_ACTIVITY_ACTIONS)[keyof typeof INVENTORY_ACTIVITY_ACTIONS];

// ── State machine transition helpers ────────────────────────────────────────

/**
 * Returns the suggested lifecycle status transition for a given movement type.
 * Returns null when the movement type does not imply a lifecycle change.
 */
export function lifecycleStatusForMovementType(
  movementType: InventoryMovementType,
): GearItemLifecycleStatus | null {
  const map: Partial<Record<InventoryMovementType, GearItemLifecycleStatus>> = {
    CHECKED_OUT: "CHECKED_OUT",
    CHECKED_IN: "ACTIVE",
    ASSIGNED: "ASSIGNED",
    UNASSIGNED: "ACTIVE",
    SENT_FOR_MAINTENANCE: "MAINTENANCE",
    RETURNED_FROM_MAINTENANCE: "ACTIVE",
    RESERVED: "RESERVED",
    RESERVATION_RELEASED: "ACTIVE",
    LOST: "LOST",
    FOUND: "ACTIVE",
    RETIRED: "RETIRED",
    QUARANTINED: "QUARANTINED",
    QUARANTINE_RELEASED: "ACTIVE",
    LOANED_OUT: "ASSIGNED",
    LOAN_RETURNED: "ACTIVE",
  };
  return map[movementType] ?? null;
}

/**
 * Returns a human-readable label for a movement type.
 */
export function labelForMovementType(movementType: InventoryMovementType): string {
  const labels: Record<InventoryMovementType, string> = {
    MOVED_TO_LOCATION: "Moved to location",
    CHECKED_OUT: "Checked out",
    CHECKED_IN: "Checked in",
    ASSIGNED: "Assigned",
    UNASSIGNED: "Unassigned",
    SENT_FOR_MAINTENANCE: "Sent for maintenance",
    RETURNED_FROM_MAINTENANCE: "Returned from maintenance",
    RESERVED: "Reserved",
    RESERVATION_RELEASED: "Reservation released",
    TRANSFERRED: "Transferred",
    LOST: "Marked lost",
    FOUND: "Found",
    RETIRED: "Retired",
    RECEIVED: "Received",
    LOANED_OUT: "Loaned out",
    LOAN_RETURNED: "Loan returned",
    QUARANTINED: "Quarantined",
    QUARANTINE_RELEASED: "Quarantine released",
  };
  return labels[movementType];
}

/**
 * Returns a human-readable label for a readiness state.
 */
export function labelForReadinessState(state: InventoryReadinessState): string {
  const labels: Record<InventoryReadinessState, string> = {
    READY: "Ready",
    NEEDS_INSPECTION: "Needs inspection",
    MAINTENANCE_REQUIRED: "Maintenance required",
    NOT_READY: "Not ready",
    DECOMMISSIONED: "Decommissioned",
  };
  return labels[state];
}

/**
 * Returns a human-readable label for an ownership type.
 */
export function labelForOwnershipType(ownershipType: InventoryOwnershipType): string {
  const labels: Record<InventoryOwnershipType, string> = {
    ORGANIZATION_OWNED: "Organization owned",
    PERSONALLY_OWNED: "Personally owned",
    LOANED_IN: "Loaned in",
    LOANED_OUT: "Loaned out",
    DONATED: "Donated",
  };
  return labels[ownershipType];
}
