import type {
  GearInventoryType,
  GearItemLifecycleStatus,
  InventoryReadinessState,
} from "@prisma/client";

import type { ScanContext } from "@/lib/inventory-scan";

export type OperationContext =
  | "LOOKUP"
  | "CUSTODY_CHECKOUT"
  | "CUSTODY_CHECKIN"
  | "ASSIGNMENT"
  | "READINESS"
  | "AUDIT"
  | "VAULT";

export type RapidOperation = {
  key: string;
  title: string;
  description: string;
  scanContext: ScanContext;
  operationContext: OperationContext;
  primaryActionLabel: string;
  followThroughLabel: string;
};

export type InventoryActionPreset = RapidOperation;

export type QuickCustodyFlow = {
  key: string;
  label: string;
  href: string;
  detail: string;
};

export type MobileInventoryAction = QuickCustodyFlow & {
  tone: "primary" | "secondary" | "support";
};

export const INVENTORY_ACTION_PRESETS: InventoryActionPreset[] = [
  {
    key: "rapid-lookup",
    title: "Rapid lookup",
    description: "Scan or key in a code and jump straight to the item profile.",
    scanContext: "INVENTORY_LOOKUP",
    operationContext: "LOOKUP",
    primaryActionLabel: "Lookup item",
    followThroughLabel: "Open full inventory context",
  },
  {
    key: "rapid-checkout",
    title: "Rapid check-out",
    description: "Issue event or field gear with the fewest possible scan-to-custody steps.",
    scanContext: "CHECKOUT",
    operationContext: "CUSTODY_CHECKOUT",
    primaryActionLabel: "Check out gear",
    followThroughLabel: "Continue to checkout capture",
  },
  {
    key: "rapid-checkin",
    title: "Rapid check-in",
    description: "Verify returned gear quickly and continue directly into return confirmation.",
    scanContext: "CHECKIN",
    operationContext: "CUSTODY_CHECKIN",
    primaryActionLabel: "Check in gear",
    followThroughLabel: "Continue to return verification",
  },
  {
    key: "rapid-assignment",
    title: "Rapid assignment",
    description: "Reassign custody to an athlete, team, or event without extra navigation.",
    scanContext: "ASSIGNMENT",
    operationContext: "ASSIGNMENT",
    primaryActionLabel: "Assign gear",
    followThroughLabel: "Continue to assignment capture",
  },
  {
    key: "rapid-readiness",
    title: "Readiness verify",
    description: "Validate location, lifecycle, and readiness state during setup or recovery.",
    scanContext: "INVENTORY_VERIFICATION",
    operationContext: "READINESS",
    primaryActionLabel: "Verify readiness",
    followThroughLabel: "Open readiness summary",
  },
  {
    key: "rapid-audit",
    title: "Rapid audit",
    description: "Move from scan to audit and history context for cage, vault, and spot checks.",
    scanContext: "AUDIT_PREP",
    operationContext: "AUDIT",
    primaryActionLabel: "Prepare audit",
    followThroughLabel: "Open audit context",
  },
  {
    key: "rapid-vault",
    title: "Vault / cage",
    description: "Use scan-first flows for storage verification and location-based operations.",
    scanContext: "CAGE_VAULT",
    operationContext: "VAULT",
    primaryActionLabel: "Open cage flow",
    followThroughLabel: "Review storage context",
  },
];

function buildAction(
  key: string,
  label: string,
  href: string,
  detail: string,
  tone: MobileInventoryAction["tone"],
): MobileInventoryAction {
  return { key, label, href, detail, tone };
}

export function findRapidOperationPresetByScanContext(scanContext: ScanContext | null | undefined) {
  return INVENTORY_ACTION_PRESETS.find((preset) => preset.scanContext === scanContext) ?? INVENTORY_ACTION_PRESETS[0];
}

export function buildRapidOperationHref(scanContext: ScanContext, scanValue?: string) {
  const params = new URLSearchParams({ scanContext });
  if (scanValue) {
    params.set("scanValue", scanValue);
  }
  return `/gear-ops/scan?${params.toString()}`;
}

export function resolveMobileInventoryActions(input: {
  itemId: string;
  inventoryType: GearInventoryType;
  lifecycleStatus: GearItemLifecycleStatus;
  readinessState: InventoryReadinessState | null;
  scanContext: ScanContext | null;
  nowInputValue: string;
  currentCheckoutId?: string | null;
  currentAssignmentId?: string | null;
  locationId?: string | null;
}) {
  const lookupAction = buildAction(
    "lookup",
    "Open item lookup",
    `/gear-ops/items/${input.itemId}`,
    "Review full inventory details, history, and scan activity.",
    input.scanContext === "INVENTORY_LOOKUP" ? "primary" : "secondary",
  );

  const checkoutAction = input.currentCheckoutId
    ? buildAction(
        "checkout-active",
        "Open active checkout",
        `/gear-ops/items/${input.itemId}/checkouts/${input.currentCheckoutId}/edit`,
        "Continue custody handling on the current open checkout.",
        input.scanContext === "CHECKOUT" ? "primary" : "secondary",
      )
    : buildAction(
        "checkout-new",
        "Rapid check-out",
        `/gear-ops/items/${input.itemId}/checkout?status=OPEN&checkedOutAt=${encodeURIComponent(input.nowInputValue)}`,
        "Start a field-ready checkout with issue time prefilled.",
        input.scanContext === "CHECKOUT" ? "primary" : "secondary",
      );

  const checkinAction = input.currentCheckoutId
    ? buildAction(
        "checkin",
        "Rapid check-in",
        `/gear-ops/items/${input.itemId}/checkouts/${input.currentCheckoutId}/edit?status=RETURNED`,
        "Complete return verification from the active custody record.",
        input.scanContext === "CHECKIN" ? "primary" : "secondary",
      )
    : buildAction(
        "checkin-review",
        "Review custody state",
        `/gear-ops/items/${input.itemId}#checkouts`,
        "No open checkout is recorded for this item.",
        input.scanContext === "CHECKIN" ? "primary" : "support",
      );

  const assignmentAction = input.currentAssignmentId
    ? buildAction(
        "assignment-update",
        "Change assignment",
        `/gear-ops/items/${input.itemId}/assignments/${input.currentAssignmentId}/edit`,
        "Transfer, return, or correct the current assignment context.",
        input.scanContext === "ASSIGNMENT" ? "primary" : "secondary",
      )
    : buildAction(
        "assignment-new",
        "Rapid assignment",
        `/gear-ops/items/${input.itemId}/assign?status=ACTIVE`,
        "Assign directly to a person, team, or event.",
        input.scanContext === "ASSIGNMENT" ? "primary" : "secondary",
      );

  const readinessDetail =
    input.readinessState === "READY"
      ? "Item is marked ready; verify location and custody before continuing."
      : input.readinessState
        ? `Readiness is currently ${input.readinessState.replaceAll("_", " ").toLowerCase()}.`
        : "No readiness state is recorded yet.";

  const readinessAction = buildAction(
    "readiness",
    "Verify readiness",
    `/gear-ops/items/${input.itemId}#readiness`,
    readinessDetail,
    input.scanContext === "INVENTORY_VERIFICATION" ? "primary" : "secondary",
  );

  const maintenanceAction = buildAction(
    "maintenance",
    "Maintenance intake",
    `/gear-ops/items/${input.itemId}/maintenance/new?performedAt=${encodeURIComponent(input.nowInputValue)}`,
    input.lifecycleStatus === "MAINTENANCE"
      ? "Continue maintenance logging for an item already under service."
      : "Create a maintenance log with service time prefilled.",
    input.lifecycleStatus === "MAINTENANCE" ? "secondary" : "support",
  );

  const locationAction = input.locationId
    ? buildAction(
        "location",
        "Open storage location",
        `/gear-ops/locations/${input.locationId}`,
        "Review the cage, vault, or storage context tied to this item.",
        input.scanContext === "CAGE_VAULT" ? "primary" : "support",
      )
    : buildAction(
        "movement-history",
        "Review movement history",
        `/gear-ops/items/${input.itemId}#movement-history`,
        "Use movement history when no fixed cage or vault location is assigned.",
        input.scanContext === "CAGE_VAULT" ? "primary" : "support",
      );

  const auditAction = buildAction(
    "audit",
    "Audit and scan history",
    `/gear-ops/items/${input.itemId}#scan-activity`,
    "Review recent scan outcomes before opening audit workflows.",
    input.scanContext === "AUDIT_PREP" ? "primary" : "secondary",
  );

  const consumableAction =
    input.inventoryType === "CONSUMABLE"
      ? buildAction(
          "consumable-adjust",
          "Adjust consumable count",
          `/gear-ops/items/${input.itemId}/consumables/new?transactionType=ADJUSTED&recordedAt=${encodeURIComponent(input.nowInputValue)}`,
          "Record a quick positive or negative stock correction.",
          "support",
        )
      : null;

  const actionMap: Record<ScanContext | "DEFAULT", MobileInventoryAction> = {
    DEFAULT: lookupAction,
    INVENTORY_LOOKUP: lookupAction,
    CHECKOUT: checkoutAction,
    CHECKIN: checkinAction,
    ASSIGNMENT: assignmentAction,
    INVENTORY_VERIFICATION: readinessAction,
    CAGE_VAULT: locationAction,
    AUDIT_PREP: auditAction,
  };

  const primaryAction = input.scanContext ? actionMap[input.scanContext] : actionMap.DEFAULT;
  const quickCustodyFlows: QuickCustodyFlow[] = [checkoutAction, checkinAction, assignmentAction];
  const actions = [
    primaryAction,
    lookupAction,
    checkoutAction,
    checkinAction,
    assignmentAction,
    readinessAction,
    locationAction,
    auditAction,
    maintenanceAction,
    consumableAction,
  ].filter((action): action is MobileInventoryAction => Boolean(action));

  const seen = new Set<string>();
  const dedupedActions = actions.filter((action) => {
    if (seen.has(action.key)) {
      return false;
    }
    seen.add(action.key);
    return true;
  });

  return {
    primaryAction,
    quickCustodyFlows,
    actions: dedupedActions,
  };
}
