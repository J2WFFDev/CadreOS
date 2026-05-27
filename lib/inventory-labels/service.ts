import { GearAssignmentStatus, GearCheckoutStatus, GearInventoryType } from "@prisma/client";

import { db } from "@/lib/db";
import { formatGearOpsDateTime, formatGearOpsEnum } from "@/lib/gear-ops";
import { labelForOwnershipType, labelForReadinessState } from "@/lib/inventory-ops";
import {
  buildDisplayReference,
  buildLabelFileName,
  buildOrganizationIdentifier,
  buildStatusPresentation,
  INVENTORY_LABEL_TEMPLATES,
  isConsumableTemplateAllowed,
  type InventoryLabelFormat,
  type InventoryLabelPreview,
  type InventoryLabelTemplateDefinition,
  type InventoryLabelTemplateKey,
  type PrintableIdentifier,
} from "./types";

function resolvePreferredFormat(templateKey: InventoryLabelTemplateKey, format?: string): InventoryLabelFormat {
  const template = INVENTORY_LABEL_TEMPLATES[templateKey];

  if (!format) {
    return template.defaultFormat;
  }

  return template.formats.includes(format as InventoryLabelFormat)
    ? (format as InventoryLabelFormat)
    : template.defaultFormat;
}

function buildScanReadyIdentifier(input: {
  label: string;
  displayValue: string;
  scanValue: string;
  description: string;
}): PrintableIdentifier {
  return {
    label: input.label,
    displayValue: input.displayValue,
    scanValue: input.scanValue,
    kind: "SCAN_READY",
    description: input.description,
  };
}

function buildFutureIdentifier(input: {
  label: string;
  displayValue: string;
  futureWorkflowValue: string;
  description: string;
}): PrintableIdentifier {
  return {
    label: input.label,
    displayValue: input.displayValue,
    scanValue: null,
    futureWorkflowValue: input.futureWorkflowValue,
    kind: "FUTURE_COMPATIBLE",
    description: input.description,
  };
}

function buildTextOnlyIdentifier(input: {
  label: string;
  displayValue: string;
  description: string;
}): PrintableIdentifier {
  return {
    label: input.label,
    displayValue: input.displayValue,
    scanValue: null,
    kind: "TEXT_ONLY",
    description: input.description,
  };
}

function buildTemplateList(keys: InventoryLabelTemplateKey[]): InventoryLabelTemplateDefinition[] {
  return keys.map((key) => INVENTORY_LABEL_TEMPLATES[key]);
}

function buildFooter(input: { organizationIdentifier: string; printableIdentifier: PrintableIdentifier }) {
  if (input.printableIdentifier.kind === "SCAN_READY" && input.printableIdentifier.scanValue) {
    return `${input.organizationIdentifier} · Scan-ready now`;
  }

  if (input.printableIdentifier.kind === "FUTURE_COMPATIBLE") {
    return `${input.organizationIdentifier} · Future mobile workflow compatible`;
  }

  return `${input.organizationIdentifier} · Text-only operational reference`;
}

function buildSymbols(templateKey: InventoryLabelTemplateKey, printableIdentifier: PrintableIdentifier) {
  const template = INVENTORY_LABEL_TEMPLATES[templateKey];
  const value = printableIdentifier.scanValue ?? printableIdentifier.futureWorkflowValue;

  if (!value) {
    return [];
  }

  return template.symbolKinds.map((kind) => ({
    kind,
    value,
    label: kind === "QR" ? "QR identifier" : "Code 128 identifier",
  }));
}

export async function getInventoryLabelPreview(input: {
  organizationId: string;
  templateKey: InventoryLabelTemplateKey;
  subjectId: string;
  subjectType: "GEAR_ITEM" | "INVENTORY_LOCATION" | "INVENTORY_KIT";
  format?: string;
}): Promise<InventoryLabelPreview | null> {
  const organization = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    return null;
  }

  const organizationIdentifier = buildOrganizationIdentifier(organization.name, organization.id);
  const format = resolvePreferredFormat(input.templateKey, input.format);

  if (input.subjectType === "GEAR_ITEM") {
    const item = await db.gearItem.findFirst({
      where: { id: input.subjectId, organizationId: input.organizationId },
      select: {
        id: true,
        name: true,
        assetId: true,
        inventoryType: true,
        lifecycleStatus: true,
        conditionStatus: true,
        readinessState: true,
        ownershipType: true,
        barcodeValue: true,
        serialNumber: true,
        sku: true,
        quantityOnHand: true,
        quantityMin: true,
        category: { select: { name: true } },
        location: { select: { id: true, name: true, locationCode: true } },
        assignments: {
          where: { status: { in: [GearAssignmentStatus.PENDING, GearAssignmentStatus.ACTIVE, GearAssignmentStatus.OVERDUE] } },
          orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            status: true,
            expectedReturnAt: true,
            assignedTo: { select: { firstName: true, lastName: true } },
            assignedTeam: { select: { name: true } },
            assignedEvent: { select: { title: true } },
          },
        },
        checkouts: {
          where: { status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] } },
          orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            status: true,
            expectedReturnAt: true,
            checkedOutBy: { select: { firstName: true, lastName: true } },
            event: { select: { title: true } },
          },
        },
      },
    });

    if (!item) {
      return null;
    }

    if (input.templateKey === "CONSUMABLE" && !isConsumableTemplateAllowed(item.inventoryType)) {
      return null;
    }

    const availableTemplates = buildTemplateList(
      item.inventoryType === GearInventoryType.CONSUMABLE
        ? ["INVENTORY_ITEM", "CONSUMABLE", "CUSTODY_ASSIGNMENT", "TEMPORARY_OPERATIONAL"]
        : ["INVENTORY_ITEM", "CUSTODY_ASSIGNMENT", "TEMPORARY_OPERATIONAL"],
    );

    const fallbackRef = buildDisplayReference(item.inventoryType === GearInventoryType.CONSUMABLE ? "CON" : "INV", item.id);
    const scanReadyValue = item.assetId?.trim()
      ? `ASSETID:${item.assetId.trim()}`
      : item.barcodeValue?.trim()
        ? `BC:${item.barcodeValue.trim()}`
        : `ITEM:${item.id}`;
    const primaryDisplayId = item.assetId?.trim() || item.barcodeValue?.trim() || item.serialNumber?.trim() || item.sku?.trim() || fallbackRef;
    const printableIdentifier =
      input.templateKey === "TEMPORARY_OPERATIONAL"
        ? buildFutureIdentifier({
            label: "Temporary ref",
            displayValue: fallbackRef,
            futureWorkflowValue: `TEMP:${item.id}`,
            description: "Temporary operational identifier pending permanent relabeling.",
          })
        : buildScanReadyIdentifier({
            label: "Printable identifier",
            displayValue: primaryDisplayId,
            scanValue: scanReadyValue,
            description:
              item.assetId?.trim()
                ? "Encodes the Asset ID for scan workflows."
                : item.barcodeValue?.trim() || item.serialNumber?.trim() || item.sku?.trim()
                  ? "Encodes the existing inventory lookup identifier for scan workflows."
                  : "Encodes the canonical ITEM-prefixed inventory identifier for scan workflows.",
          });

    const assignment = item.assignments[0] ?? null;
    const checkout = item.checkouts[0] ?? null;
    const custodyHint = checkout
      ? `Checked out to ${checkout.checkedOutBy.firstName} ${checkout.checkedOutBy.lastName}${checkout.event ? ` · ${checkout.event.title}` : ""}`
      : assignment
        ? `Assigned ${formatGearOpsEnum(assignment.status).toLowerCase()}${assignment.assignedTo ? ` to ${assignment.assignedTo.firstName} ${assignment.assignedTo.lastName}` : ""}${assignment.assignedTeam ? ` · ${assignment.assignedTeam.name}` : ""}${assignment.assignedEvent ? ` · ${assignment.assignedEvent.title}` : ""}`
        : "No active custody record";

    const hints = [
      `Category · ${item.category.name}`,
      `Type · ${formatGearOpsEnum(item.inventoryType)}`,
      item.location ? `Location · ${item.location.name}${item.location.locationCode ? ` (${item.location.locationCode})` : ""}` : "Location · Unassigned",
      custodyHint,
    ];

    if (item.ownershipType) {
      hints.push(`Ownership · ${labelForOwnershipType(item.ownershipType)}`);
    }

    if (item.readinessState) {
      hints.push(`Readiness · ${labelForReadinessState(item.readinessState)}`);
    }

    if (input.templateKey === "CONSUMABLE") {
      hints.push(`Stock · ${item.quantityOnHand} on hand${item.quantityMin !== null ? ` · min ${item.quantityMin}` : ""}`);
    }

    if (input.templateKey === "CUSTODY_ASSIGNMENT") {
      if (assignment?.expectedReturnAt) {
        hints.push(`Assigned return target · ${formatGearOpsDateTime(assignment.expectedReturnAt)}`);
      }
      if (checkout?.expectedReturnAt) {
        hints.push(`Checkout return target · ${formatGearOpsDateTime(checkout.expectedReturnAt)}`);
      }
    }

    const status = buildStatusPresentation({
      lifecycleStatus: item.lifecycleStatus,
      readinessState: item.readinessState,
      conditionStatus: item.conditionStatus,
    });

    const title =
      input.templateKey === "CONSUMABLE"
        ? "Consumable label"
        : input.templateKey === "CUSTODY_ASSIGNMENT"
          ? "Assignment / custody label"
          : input.templateKey === "TEMPORARY_OPERATIONAL"
            ? "Temporary operational label"
            : "Inventory label";
    const subtitle =
      input.templateKey === "CUSTODY_ASSIGNMENT"
        ? "Custody, issue, and accountability reference"
        : input.templateKey === "CONSUMABLE"
          ? "Stock visibility and audit support"
          : item.category.name;

    const template = INVENTORY_LABEL_TEMPLATES[input.templateKey];
    const renderContext = {
      templateKey: input.templateKey,
      templateLabel: template.label,
      format,
      title,
      subtitle,
      subjectName: item.name,
      organizationName: organization.name,
      organizationIdentifier,
      printableIdentifier,
      statusLabel: status.label,
      statusTone: status.tone,
      hints,
      footer: buildFooter({ organizationIdentifier, printableIdentifier }),
      symbols: buildSymbols(input.templateKey, printableIdentifier),
    };

    return {
      subjectType: "GEAR_ITEM",
      subjectId: item.id,
      template,
      availableTemplates,
      renderContext,
      printJob: {
        title: `${template.label} · ${item.name}`,
        fileName: buildLabelFileName({ templateKey: input.templateKey, subjectName: item.name, subjectId: item.id }),
        contentType: "text/html",
      },
    };
  }

  if (input.subjectType === "INVENTORY_LOCATION") {
    const location = await db.inventoryLocation.findFirst({
      where: { id: input.subjectId, organizationId: input.organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        locationCode: true,
        isActive: true,
        parentLocation: { select: { name: true } },
        _count: { select: { gearItems: true, childLocations: true } },
      },
    });

    if (!location) {
      return null;
    }

    const availableTemplates = buildTemplateList(["INVENTORY_LOCATION", "TEMPORARY_OPERATIONAL"]);
    const printableIdentifier = location.locationCode
      ? buildScanReadyIdentifier({
          label: "Location code",
          displayValue: location.locationCode,
          scanValue: `LOC:${location.locationCode}`,
          description: "Encodes the location code for scan-assisted vault and cage workflows.",
        })
      : input.templateKey === "TEMPORARY_OPERATIONAL"
        ? buildFutureIdentifier({
            label: "Temporary ref",
            displayValue: buildDisplayReference("LOC", location.id),
            futureWorkflowValue: `LOCID:${location.id}`,
            description: "Temporary location identifier until a permanent location code is assigned.",
          })
        : buildTextOnlyIdentifier({
            label: "Location ref",
            displayValue: buildDisplayReference("LOC", location.id),
            description: "Text-only reference. Add a location code to enable scan-ready location labels.",
          });

    const status = buildStatusPresentation({ isActive: location.isActive });
    const template = INVENTORY_LABEL_TEMPLATES[input.templateKey];
    const renderContext = {
      templateKey: input.templateKey,
      templateLabel: template.label,
      format,
      title: input.templateKey === "TEMPORARY_OPERATIONAL" ? "Temporary operational label" : "Vault / equipment cage label",
      subtitle: location.description ?? "Operational storage reference",
      subjectName: location.name,
      organizationName: organization.name,
      organizationIdentifier,
      printableIdentifier,
      statusLabel: status.label,
      statusTone: status.tone,
      hints: [
        location.parentLocation ? `Parent · ${location.parentLocation.name}` : "Parent · None",
        `Items at location · ${location._count.gearItems}`,
        `Sub-locations · ${location._count.childLocations}`,
        printableIdentifier.kind === "TEXT_ONLY" ? "Add a location code for scan-ready labels" : "Scan-friendly storage reference",
      ],
      footer: buildFooter({ organizationIdentifier, printableIdentifier }),
      symbols: buildSymbols(input.templateKey, printableIdentifier),
    };

    return {
      subjectType: "INVENTORY_LOCATION",
      subjectId: location.id,
      template,
      availableTemplates,
      renderContext,
      printJob: {
        title: `${template.label} · ${location.name}`,
        fileName: buildLabelFileName({ templateKey: input.templateKey, subjectName: location.name, subjectId: location.id }),
        contentType: "text/html",
      },
    };
  }

  const kit = await db.inventoryKit.findFirst({
    where: { id: input.subjectId, organizationId: input.organizationId },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      owner: { select: { firstName: true, lastName: true } },
      items: {
        where: { removedAt: null },
        select: { quantity: true },
      },
    },
  });

  if (!kit || (input.templateKey !== "KIT_LOADOUT" && input.templateKey !== "TEMPORARY_OPERATIONAL")) {
    return null;
  }

  const availableTemplates = buildTemplateList(["KIT_LOADOUT", "TEMPORARY_OPERATIONAL"]);
  const printableIdentifier = input.templateKey === "TEMPORARY_OPERATIONAL"
    ? buildFutureIdentifier({
        label: "Temporary ref",
        displayValue: buildDisplayReference("KIT", kit.id),
        futureWorkflowValue: `KIT:${kit.id}`,
        description: "Future-compatible kit reference for mobile scan workflows.",
      })
    : buildFutureIdentifier({
        label: "Kit ref",
        displayValue: buildDisplayReference("KIT", kit.id),
        futureWorkflowValue: `KIT:${kit.id}`,
        description: "Future-compatible kit identifier for mobile loadout and audit workflows.",
      });

  const status = buildStatusPresentation({ isActive: kit.isActive });
  const template = INVENTORY_LABEL_TEMPLATES[input.templateKey];
  const totalQuantity = kit.items.reduce((sum, item) => sum + item.quantity, 0);
  const renderContext = {
    templateKey: input.templateKey,
    templateLabel: template.label,
    format,
    title: input.templateKey === "TEMPORARY_OPERATIONAL" ? "Temporary operational label" : "Kit / loadout label",
    subtitle: kit.description ?? "Reusable operational grouping",
    subjectName: kit.name,
    organizationName: organization.name,
    organizationIdentifier,
    printableIdentifier,
    statusLabel: status.label,
    statusTone: status.tone,
    hints: [
      `Active line items · ${kit.items.length}`,
      `Total quantity represented · ${totalQuantity}`,
      kit.owner ? `Owner · ${kit.owner.firstName} ${kit.owner.lastName}` : "Owner · Unassigned",
      "Future mobile scan compatibility retained via KIT-prefixed identifier",
    ],
    footer: buildFooter({ organizationIdentifier, printableIdentifier }),
    symbols: buildSymbols(input.templateKey, printableIdentifier),
  };

  return {
    subjectType: "INVENTORY_KIT",
    subjectId: kit.id,
    template,
    availableTemplates,
    renderContext,
    printJob: {
      title: `${template.label} · ${kit.name}`,
      fileName: buildLabelFileName({ templateKey: input.templateKey, subjectName: kit.name, subjectId: kit.id }),
      contentType: "text/html",
    },
  };
}
