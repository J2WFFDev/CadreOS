import { GearCheckoutStatus } from "@prisma/client";

import { db } from "@/lib/db";
import type {
  ScanEventActivityInput,
  ScanResolveResult,
} from "./types";
import {
  parseInventoryIdentifier,
  SCAN_CONTEXTS,
  validateInventoryCodeValue,
} from "./types";

const OPEN_CHECKOUT_STATUSES: GearCheckoutStatus[] = [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE];

export async function resolveScan(input: {
  organizationId: string;
  scanValue: string;
}): Promise<ScanResolveResult> {
  const validation = validateInventoryCodeValue(input.scanValue);
  const identifier = parseInventoryIdentifier(input.scanValue);
  const identifierValidation = validateInventoryCodeValue(identifier.normalizedValue);

  if (!validation.valid || !identifierValidation.valid) {
    return {
      identifier,
      match: null,
      result: "INVALID",
      matchType: "EXACT",
    };
  }

  if (identifier.identifierType === "GEAR_ITEM_ID") {
    const item = await db.gearItem.findFirst({
      where: {
        id: identifier.normalizedValue,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        name: true,
        lifecycleStatus: true,
        checkouts: {
          where: { status: { in: OPEN_CHECKOUT_STATUSES } },
          orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { id: true },
        },
      },
    });

    if (item) {
      return {
        identifier,
        match: {
          entityType: "GEAR_ITEM",
          id: item.id,
          name: item.name,
          lifecycleStatus: item.lifecycleStatus,
          identifierType: "GEAR_ITEM_ID",
          openCheckoutId: item.checkouts[0]?.id ?? null,
        },
        result: "MATCHED_GEAR_ITEM",
        matchType: "EXACT",
      };
    }
  }

  if (identifier.identifierType === "LOCATION_CODE") {
    const location = await db.inventoryLocation.findFirst({
      where: {
        organizationId: input.organizationId,
        locationCode: { equals: identifier.normalizedValue, mode: "insensitive" },
      },
      select: { id: true, name: true, locationCode: true },
    });

    if (location) {
      return {
        identifier,
        match: {
          entityType: "INVENTORY_LOCATION",
          id: location.id,
          name: location.name,
          locationCode: location.locationCode,
          identifierType: "LOCATION_CODE",
        },
        result: "MATCHED_LOCATION",
        matchType: "EXACT",
      };
    }
  }

  const item = await db.gearItem.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [
        { barcodeValue: { equals: identifier.normalizedValue, mode: "insensitive" } },
        { serialNumber: { equals: identifier.normalizedValue, mode: "insensitive" } },
        { sku: { equals: identifier.normalizedValue, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      lifecycleStatus: true,
      barcodeValue: true,
      serialNumber: true,
      sku: true,
      checkouts: {
        where: { status: { in: OPEN_CHECKOUT_STATUSES } },
        orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { id: true },
      },
    },
  });

  if (item) {
    const identifierType =
      item.barcodeValue?.toLowerCase() === identifier.normalizedValue.toLowerCase()
        ? "BARCODE_VALUE"
        : item.serialNumber?.toLowerCase() === identifier.normalizedValue.toLowerCase()
          ? "SERIAL_NUMBER"
          : "SKU";

    return {
      identifier: {
        ...identifier,
        identifierType,
      },
      match: {
        entityType: "GEAR_ITEM",
        id: item.id,
        name: item.name,
        lifecycleStatus: item.lifecycleStatus,
        identifierType,
        openCheckoutId: item.checkouts[0]?.id ?? null,
      },
      result: "MATCHED_GEAR_ITEM",
      matchType: "EXACT",
    };
  }

  const location = await db.inventoryLocation.findFirst({
    where: {
      organizationId: input.organizationId,
      locationCode: { equals: identifier.normalizedValue, mode: "insensitive" },
    },
    select: { id: true, name: true, locationCode: true },
  });

  if (location) {
    return {
      identifier: {
        ...identifier,
        identifierType: "LOCATION_CODE",
      },
      match: {
        entityType: "INVENTORY_LOCATION",
        id: location.id,
        name: location.name,
        locationCode: location.locationCode,
        identifierType: "LOCATION_CODE",
      },
      result: "MATCHED_LOCATION",
      matchType: "FALLBACK",
    };
  }

  return {
    identifier,
    match: null,
    result: "NOT_FOUND",
    matchType: "EXACT",
  };
}

export async function writeScanEvent(input: ScanEventActivityInput) {
  return db.inventoryScanEvent.create({
    data: {
      organizationId: input.organizationId,
      actorPersonId: input.actorPersonId,
      gearItemId: input.gearItemId ?? null,
      locationId: input.locationId ?? null,
      scanContext: input.scanContext,
      rawValue: input.identifier.rawValue,
      normalizedValue: input.identifier.normalizedValue,
      inventoryIdentifierType: input.identifier.identifierType,
      matchType: input.matchType,
      result: input.result,
      workflowTarget: input.workflowTarget ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    select: { id: true },
  });
}

export function sanitizeScanContext(value: string): (typeof SCAN_CONTEXTS)[number] {
  return SCAN_CONTEXTS.includes(value as (typeof SCAN_CONTEXTS)[number])
    ? (value as (typeof SCAN_CONTEXTS)[number])
    : "INVENTORY_LOOKUP";
}
