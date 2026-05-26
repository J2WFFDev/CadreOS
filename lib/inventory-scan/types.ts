import { GearCheckoutStatus, GearItemLifecycleStatus } from "@prisma/client";

export const INVENTORY_IDENTIFIER_TYPES = [
  "GEAR_ITEM_ID",
  "BARCODE_VALUE",
  "SERIAL_NUMBER",
  "SKU",
  "LOCATION_CODE",
  "UNKNOWN",
] as const;

export type InventoryIdentifierType = (typeof INVENTORY_IDENTIFIER_TYPES)[number];

export const SCAN_CONTEXTS = [
  "INVENTORY_LOOKUP",
  "CHECKOUT",
  "CHECKIN",
  "INVENTORY_VERIFICATION",
  "ASSIGNMENT",
  "CAGE_VAULT",
  "AUDIT_PREP",
] as const;

export type ScanContext = (typeof SCAN_CONTEXTS)[number];

export const LABEL_FORMATS = ["CODE128", "QR_GENERIC", "TEXT_ONLY"] as const;

export type LabelFormat = (typeof LABEL_FORMATS)[number];

export const SCAN_EVENT_RESULTS = ["MATCHED_GEAR_ITEM", "MATCHED_LOCATION", "NOT_FOUND", "INVALID"] as const;

export type ScanEventResult = (typeof SCAN_EVENT_RESULTS)[number];

export const SCAN_EVENT_MATCH_TYPES = ["EXACT", "PREFIX", "FALLBACK"] as const;

export type ScanEventMatchType = (typeof SCAN_EVENT_MATCH_TYPES)[number];

export type InventoryIdentifier = {
  rawValue: string;
  normalizedValue: string;
  identifierType: InventoryIdentifierType;
};

export type ScanEventActivityInput = {
  organizationId: string;
  actorPersonId: string | null;
  scanContext: ScanContext;
  identifier: InventoryIdentifier;
  result: ScanEventResult;
  matchType: ScanEventMatchType;
  gearItemId?: string | null;
  locationId?: string | null;
  workflowTarget?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ScanResolvedGearItem = {
  entityType: "GEAR_ITEM";
  id: string;
  name: string;
  lifecycleStatus: GearItemLifecycleStatus;
  identifierType: InventoryIdentifierType;
  openCheckoutId: string | null;
};

export type ScanResolvedLocation = {
  entityType: "INVENTORY_LOCATION";
  id: string;
  name: string;
  locationCode: string | null;
  identifierType: InventoryIdentifierType;
};

export type ScanResolveMatch = ScanResolvedGearItem | ScanResolvedLocation;

export type ScanResolveResult = {
  identifier: InventoryIdentifier;
  match: ScanResolveMatch | null;
  result: ScanEventResult;
  matchType: ScanEventMatchType;
};

const CUID_PATTERN = /^c[a-z0-9]{24,}$/i;

function stripKnownPrefix(value: string) {
  const prefixes: Array<{ token: string; identifierType: InventoryIdentifierType }> = [
    { token: "ITEM:", identifierType: "GEAR_ITEM_ID" },
    { token: "ID:", identifierType: "GEAR_ITEM_ID" },
    { token: "BARCODE:", identifierType: "BARCODE_VALUE" },
    { token: "BC:", identifierType: "BARCODE_VALUE" },
    { token: "QR:", identifierType: "BARCODE_VALUE" },
    { token: "SERIAL:", identifierType: "SERIAL_NUMBER" },
    { token: "SN:", identifierType: "SERIAL_NUMBER" },
    { token: "SKU:", identifierType: "SKU" },
    { token: "LOC:", identifierType: "LOCATION_CODE" },
    { token: "LOCATION:", identifierType: "LOCATION_CODE" },
  ];

  const upper = value.toUpperCase();
  for (const prefix of prefixes) {
    if (upper.startsWith(prefix.token)) {
      return {
        identifierType: prefix.identifierType,
        value: value.slice(prefix.token.length).trim(),
      };
    }
  }

  return null;
}

export function normalizeInventoryCodeValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateInventoryCodeValue(value: string): { valid: boolean; message?: string } {
  const normalized = normalizeInventoryCodeValue(value);

  if (normalized.length === 0) {
    return { valid: false, message: "Scan value is required." };
  }

  if (normalized.length < 2) {
    return { valid: false, message: "Scan value must be at least 2 characters." };
  }

  if (normalized.length > 160) {
    return { valid: false, message: "Scan value must be 160 characters or less." };
  }

  return { valid: true };
}

export function parseInventoryIdentifier(rawValue: string): InventoryIdentifier {
  const normalizedValue = normalizeInventoryCodeValue(rawValue);
  const prefixed = stripKnownPrefix(normalizedValue);

  if (prefixed) {
    return {
      rawValue,
      normalizedValue: prefixed.value,
      identifierType: prefixed.identifierType,
    };
  }

  if (CUID_PATTERN.test(normalizedValue)) {
    return { rawValue, normalizedValue, identifierType: "GEAR_ITEM_ID" };
  }

  return { rawValue, normalizedValue, identifierType: "UNKNOWN" };
}

export function labelForScanContext(context: ScanContext): string {
  const labels: Record<ScanContext, string> = {
    INVENTORY_LOOKUP: "Inventory lookup",
    CHECKOUT: "Check-out",
    CHECKIN: "Check-in",
    INVENTORY_VERIFICATION: "Inventory verification",
    ASSIGNMENT: "Assignment",
    CAGE_VAULT: "Cage/vault",
    AUDIT_PREP: "Audit prep",
  };

  return labels[context];
}

export function labelForIdentifierType(identifierType: InventoryIdentifierType): string {
  const labels: Record<InventoryIdentifierType, string> = {
    GEAR_ITEM_ID: "Gear item ID",
    BARCODE_VALUE: "Barcode/QR value",
    SERIAL_NUMBER: "Serial number",
    SKU: "SKU",
    LOCATION_CODE: "Location code",
    UNKNOWN: "Unknown",
  };

  return labels[identifierType];
}

export function labelForScanEventResult(result: ScanEventResult): string {
  const labels: Record<ScanEventResult, string> = {
    MATCHED_GEAR_ITEM: "Matched gear item",
    MATCHED_LOCATION: "Matched location",
    NOT_FOUND: "No match found",
    INVALID: "Invalid scan value",
  };

  return labels[result];
}

function appendQuery(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function appendHash(path: string, hash?: string) {
  return hash ? `${path}#${hash}` : path;
}

export function resolveScanTargetPath(input: {
  scanContext: ScanContext;
  match: ScanResolveMatch;
  scanValue: string;
}): string {
  const params = new URLSearchParams({
    scanned: "1",
    scanContext: input.scanContext,
    scanValue: input.scanValue,
    scanEntityType: input.match.entityType,
  });

  if (input.match.entityType === "INVENTORY_LOCATION") {
    return appendQuery(`/gear-ops/locations/${input.match.id}`, params);
  }

  const itemTarget = appendQuery(`/gear-ops/items/${input.match.id}`, params);

  if (input.scanContext === "INVENTORY_LOOKUP") {
    return itemTarget;
  }

  return appendHash(itemTarget, "rapid-ops");
}

export function isOpenCheckoutStatus(status: GearCheckoutStatus): boolean {
  return status === GearCheckoutStatus.OPEN || status === GearCheckoutStatus.OVERDUE;
}
