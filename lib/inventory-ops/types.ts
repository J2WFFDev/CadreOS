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
  category?: string | null;
  notes?: string | null;
  ownerPersonId?: string | null;
  kitType?: import("@prisma/client").GearKitType;
};

/** Input for adding an item to a kit. */
export type AddItemToKitInput = {
  organizationId: string;
  kitId: string;
  gearItemId: string;
  componentRole?: import("@prisma/client").GearKitComponentRole;
  isRequired?: boolean;
  quantity?: number;
  quantityExpected?: number;
  sortOrder?: number;
  notes?: string | null;
};

/** Input for removing an item from a kit. */
export type RemoveItemFromKitInput = {
  organizationId: string;
  kitId: string;
  gearItemId: string;
};

/** Input for updating an inventory kit. */
export type UpdateInventoryKitInput = {
  organizationId: string;
  kitId: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  notes?: string | null;
  ownerPersonId?: string | null;
  kitType?: import("@prisma/client").GearKitType;
  isActive?: boolean;
};

/** Input for kit checkout (full kit). */
export type CheckOutKitInput = {
  organizationId: string;
  kitId: string;
  actorPersonId: string;
  custodyPersonId: string;
  relatedEventId?: string | null;
  notes?: string | null;
  /** If true, only specific child items are checked out with the kit. */
  isPartial?: boolean;
  /** IDs of child gearItems to include when isPartial is true. */
  partialChildGearItemIds?: string[];
};

/** Input for kit check-in (full kit return). */
export type CheckInKitInput = {
  organizationId: string;
  kitId: string;
  actorPersonId: string;
  notes?: string | null;
  /** If true, only specific child items are returned. */
  isPartial?: boolean;
  /** IDs of child gearItems being returned when isPartial is true. */
  partialChildGearItemIds?: string[];
  missingGearItemIds?: string[];
  damagedGearItemIds?: string[];
  maintenanceGearItemIds?: string[];
};

/** Input for assigning a kit to a person, team, or event. */
export type AssignKitInput = {
  organizationId: string;
  kitId: string;
  actorPersonId: string;
  assignToPersonId?: string | null;
  assignToTeamId?: string | null;
  assignToEventId?: string | null;
  notes?: string | null;
};

/** Input for logging a kit inspection. */
export type LogKitInspectionInput = {
  organizationId: string;
  kitId: string;
  inspectedByPersonId: string;
  status: import("@prisma/client").GearKitInspectionStatus;
  notes?: string | null;
  /** JSON-serializable per-item condition observations. */
  itemConditions?: Array<{
    kitItemId: string;
    gearItemId: string;
    conditionStatus?: import("@prisma/client").GearConditionStatus | null;
    notes?: string | null;
  }>;
  /** IDs of gearItems confirmed missing during inspection. */
  missingItemIds?: string[];
};

/** Input for reserving/holding a kit. */
export type ReserveKitInput = {
  organizationId: string;
  kitId: string;
  actorPersonId: string;
  relatedEventId?: string | null;
  notes?: string | null;
};

/** Summary view for an inventory kit. */
export type InventoryKitSummary = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  notes: string | null;
  kitType: import("@prisma/client").GearKitType;
  isActive: boolean;
  readinessLabel: import("@prisma/client").GearKitReadinessLabel;
  custodyStatus: import("@prisma/client").GearKitCustodyStatus;
  lastInspectionStatus: import("@prisma/client").GearKitInspectionStatus | null;
  owner: { id: string; firstName: string; lastName: string } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  itemCount: number;
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

// InventoryKitSummary now defined above with full kit fields.

// ── Activity action constants ────────────────────────────────────────────────

/** Standardized action strings for inventory movement activity integration. */
export const INVENTORY_ACTIVITY_ACTIONS = {
  MOVEMENT_RECORDED: "inventory.movement.recorded",
  LOCATION_CREATED: "inventory.location.created",
  LOCATION_UPDATED: "inventory.location.updated",
  KIT_CREATED: "inventory.kit.created",
  KIT_UPDATED: "inventory.kit.updated",
  KIT_ITEM_ADDED: "inventory.kit.item_added",
  KIT_ITEM_REMOVED: "inventory.kit.item_removed",
  KIT_CHECKED_OUT: "inventory.kit.checked_out",
  KIT_CHECKED_IN: "inventory.kit.checked_in",
  KIT_ASSIGNED: "inventory.kit.assigned",
  KIT_INSPECTION_LOGGED: "inventory.kit.inspection_logged",
  KIT_RESERVED: "inventory.kit.reserved",
  KIT_RESERVATION_RELEASED: "inventory.kit.reservation_released",
  READINESS_STATE_CHANGED: "inventory.readiness_state.changed",
  OWNERSHIP_TYPE_SET: "inventory.ownership_type.set",
  SCAN_EVENT_RECORDED: "inventory.scan_event.recorded",
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
