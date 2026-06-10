import {
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  InventoryOwnershipType,
  InventoryReadinessState,
  type Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";

const TEMPLATE_COLUMNS = [
  "item_name",
  "category",
  "template_key",
  "description",
  "serial_number",
  "asset_tag",
  "asset_id",
  "qr_identifier",
  "owner_source",
  "location",
  "readiness_status",
  "condition",
  "quantity",
  "low_threshold",
  "notes",
  "active",
] as const;

type TemplateColumn = (typeof TEMPLATE_COLUMNS)[number];

export type GearImportMode = "CREATE_ONLY" | "CREATE_OR_UPDATE";

export type GearImportRow = {
  rowNumber: number;
  values: Record<TemplateColumn, string>;
};

export type GearImportIssue = {
  rowNumber: number;
  field: TemplateColumn | "row" | "header";
  message: string;
};

export type GearImportPreviewRow = {
  rowNumber: number;
  action: "CREATE" | "UPDATE";
  identifier: string;
  itemName: string;
  categoryId: string;
  locationId: string | null;
  inventoryType: GearInventoryType;
  lifecycleStatus: GearItemLifecycleStatus;
  conditionStatus: GearConditionStatus | null;
  ownershipType: InventoryOwnershipType | null;
  readinessState: InventoryReadinessState | null;
  quantityOnHand: number;
  quantityMin: number | null;
  serialNumber: string | null;
  barcodeValue: string | null;
  assetId: string | null;
  sku: string | null;
  notes: string | null;
  existingItemId: string | null;
};

export type GearImportPreview = {
  rowCount: number;
  createCount: number;
  updateCount: number;
  issues: GearImportIssue[];
  warnings: GearImportIssue[];
  rows: GearImportPreviewRow[];
};

export type GearImportCommitResult = {
  rowCount: number;
  createdCount: number;
  updatedCount: number;
  issues: GearImportIssue[];
};

export type GearExportDataset =
  | "inventory"
  | "custody"
  | "location"
  | "readiness"
  | "event_plan"
  | "audit_summary";

const HEADER_ALIASES: Record<string, TemplateColumn> = {
  item_name: "item_name",
  name: "item_name",
  category: "category",
  template_key: "template_key",
  category_key: "template_key",
  description: "description",
  serial_number: "serial_number",
  serial: "serial_number",
  asset_tag: "asset_tag",
  barcode: "asset_tag",
  asset_id: "asset_id",
  go_id: "asset_id",
  qr_identifier: "qr_identifier",
  qr_value: "qr_identifier",
  owner_source: "owner_source",
  ownership: "owner_source",
  location: "location",
  readiness_status: "readiness_status",
  readiness: "readiness_status",
  condition: "condition",
  quantity: "quantity",
  low_threshold: "low_threshold",
  quantity_min: "low_threshold",
  notes: "notes",
  active: "active",
};

const OWNERSHIP_ALIAS: Record<string, InventoryOwnershipType> = {
  organization_owned: "ORGANIZATION_OWNED",
  org_owned: "ORGANIZATION_OWNED",
  personally_owned: "PERSONALLY_OWNED",
  personal: "PERSONALLY_OWNED",
  loaned_in: "LOANED_IN",
  loaned_out: "LOANED_OUT",
  donated: "DONATED",
};

const READINESS_ALIAS: Record<string, InventoryReadinessState> = {
  ready: "READY",
  needs_inspection: "NEEDS_INSPECTION",
  maintenance_required: "MAINTENANCE_REQUIRED",
  not_ready: "NOT_READY",
  decommissioned: "DECOMMISSIONED",
};

const CONDITION_ALIAS: Record<string, GearConditionStatus> = {
  new: "NEW",
  good: "GOOD",
  fair: "FAIR",
  poor: "POOR",
  damaged: "DAMAGED",
  retired: "RETIRED",
};

const LIFECYCLE_ALIAS: Record<string, GearItemLifecycleStatus> = {
  active: "ACTIVE",
  assigned: "ASSIGNED",
  checked_out: "CHECKED_OUT",
  reserved: "RESERVED",
  maintenance: "MAINTENANCE",
  quarantined: "QUARANTINED",
  retired: "RETIRED",
  lost: "LOST",
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeHeader(value: string): TemplateColumn | null {
  return HEADER_ALIASES[normalizeToken(value)] ?? null;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function quoteCsv(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

function createTemplateRecord() {
  return TEMPLATE_COLUMNS.reduce(
    (acc, column) => {
      acc[column] = "";
      return acc;
    },
    {} as Record<TemplateColumn, string>,
  );
}

export function parseGearImportCsv(csvText: string): {
  rows: GearImportRow[];
  issues: GearImportIssue[];
  warnings: GearImportIssue[];
} {
  const issues: GearImportIssue[] = [];
  const warnings: GearImportIssue[] = [];
  const lines = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

  if (nonEmptyLines.length === 0) {
    return {
      rows: [],
      issues: [{ rowNumber: 0, field: "row", message: "CSV payload is empty." }],
      warnings,
    };
  }

  const rawHeaders = parseCsvLine(nonEmptyLines[0]);
  const headerMap = rawHeaders.map((header) => normalizeHeader(header));

  rawHeaders.forEach((header, index) => {
    if (!headerMap[index]) {
      warnings.push({
        rowNumber: 1,
        field: "header",
        message: `Unsupported header '${header}' will be ignored.`,
      });
    }
  });

  const rows: GearImportRow[] = [];

  for (let lineIndex = 1; lineIndex < nonEmptyLines.length; lineIndex += 1) {
    const sourceRowNumber = lineIndex + 1;
    const line = nonEmptyLines[lineIndex];
    const values = parseCsvLine(line);
    const row = createTemplateRecord();

    values.forEach((value, index) => {
      const normalizedHeader = headerMap[index];
      if (normalizedHeader) {
        row[normalizedHeader] = value;
      }
    });

    if (Object.values(row).every((value) => value.trim().length === 0)) {
      continue;
    }

    rows.push({ rowNumber: sourceRowNumber, values: row });
  }

  return { rows, issues, warnings };
}

function parseOptionalInt(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function parseBooleanLike(value: string): boolean | null {
  const token = normalizeToken(value);
  if (!token) {
    return null;
  }

  if (["true", "yes", "y", "1", "active"].includes(token)) {
    return true;
  }

  if (["false", "no", "n", "0", "inactive"].includes(token)) {
    return false;
  }

  return null;
}

function pickIdentifier(values: Record<TemplateColumn, string>) {
  const serialNumber = values.serial_number.trim() || null;
  const barcodeValue = values.asset_tag.trim() || values.qr_identifier.trim() || null;
  const assetId = values.asset_id.trim() || null;
  const sku = values.template_key.trim() || null;

  return {
    serialNumber,
    barcodeValue,
    assetId,
    sku,
    identifier: serialNumber || assetId || barcodeValue || sku,
  };
}

export async function previewGearImport(input: {
  organizationId: string;
  csvText: string;
  mode: GearImportMode;
}): Promise<GearImportPreview> {
  const parsed = parseGearImportCsv(input.csvText);
  const issues = [...parsed.issues];
  const warnings = [...parsed.warnings];

  if (parsed.rows.length === 0) {
    if (issues.length === 0) {
      issues.push({ rowNumber: 0, field: "row", message: "No import rows were found." });
    }

    return {
      rowCount: 0,
      createCount: 0,
      updateCount: 0,
      issues,
      warnings,
      rows: [],
    };
  }

  const [categories, locations, existingItems] = await Promise.all([
    db.gearCategory.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true, name: true, templateSlug: true, inventoryType: true },
    }),
    db.inventoryLocation.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true, name: true, locationCode: true },
    }),
    db.gearItem.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true, serialNumber: true, barcodeValue: true, assetId: true, sku: true },
    }),
  ]);

  const categoryByName = new Map(categories.map((category) => [normalizeToken(category.name), category]));
  const categoryByTemplate = new Map(
    categories
      .filter((category) => category.templateSlug)
      .map((category) => [normalizeToken(category.templateSlug ?? ""), category]),
  );
  const locationByName = new Map(locations.map((location) => [normalizeToken(location.name), location]));
  const locationByCode = new Map(
    locations
      .filter((location) => location.locationCode)
      .map((location) => [normalizeToken(location.locationCode ?? ""), location]),
  );

  const existingByIdentifier = new Map<string, { id: string }>();
  for (const item of existingItems) {
    if (item.serialNumber) {
      existingByIdentifier.set(`serial:${normalizeToken(item.serialNumber)}`, { id: item.id });
    }
    if (item.assetId) {
      existingByIdentifier.set(`assetid:${normalizeToken(item.assetId)}`, { id: item.id });
    }
    if (item.barcodeValue) {
      existingByIdentifier.set(`barcode:${normalizeToken(item.barcodeValue)}`, { id: item.id });
    }
    if (item.sku) {
      existingByIdentifier.set(`sku:${normalizeToken(item.sku)}`, { id: item.id });
    }
  }

  const seenIdentifierRows = new Map<string, number>();
  const previewRows: GearImportPreviewRow[] = [];

  for (const row of parsed.rows) {
    const itemName = row.values.item_name.trim();
    if (!itemName) {
      issues.push({ rowNumber: row.rowNumber, field: "item_name", message: "Item name is required." });
    }

    const categoryToken = normalizeToken(row.values.category);
    const templateToken = normalizeToken(row.values.template_key);
    const category =
      (categoryToken ? categoryByName.get(categoryToken) : null) ||
      (templateToken ? categoryByTemplate.get(templateToken) : null) ||
      null;

    if (!category) {
      issues.push({
        rowNumber: row.rowNumber,
        field: "category",
        message: "Category/template key did not match an organization category.",
      });
      continue;
    }

    const identifierParts = pickIdentifier(row.values);
    if (!identifierParts.identifier) {
      issues.push({
        rowNumber: row.rowNumber,
        field: "row",
        message: "Provide serial_number, asset_tag, qr_identifier, or template_key as identifier.",
      });
      continue;
    }

    const identifierKey = identifierParts.serialNumber
      ? `serial:${normalizeToken(identifierParts.serialNumber)}`
      : identifierParts.assetId
        ? `assetid:${normalizeToken(identifierParts.assetId)}`
        : identifierParts.barcodeValue
          ? `barcode:${normalizeToken(identifierParts.barcodeValue)}`
          : `sku:${normalizeToken(identifierParts.sku ?? "")}`;

    if (seenIdentifierRows.has(identifierKey)) {
      issues.push({
        rowNumber: row.rowNumber,
        field: "row",
        message: `Duplicate row identifier also appears on row ${seenIdentifierRows.get(identifierKey)}.`,
      });
      continue;
    }
    seenIdentifierRows.set(identifierKey, row.rowNumber);

    const existing = existingByIdentifier.get(identifierKey) ?? null;
    const action: "CREATE" | "UPDATE" = existing ? "UPDATE" : "CREATE";

    if (action === "UPDATE" && input.mode === "CREATE_ONLY") {
      issues.push({
        rowNumber: row.rowNumber,
        field: "row",
        message: "Identifier already exists; switch to create/update mode to update existing rows.",
      });
      continue;
    }

    const issueCountBeforeValidation = issues.length;

    const readinessToken = normalizeToken(row.values.readiness_status);
    const readinessState = readinessToken ? READINESS_ALIAS[readinessToken] ?? null : null;
    if (readinessToken && !readinessState) {
      issues.push({ rowNumber: row.rowNumber, field: "readiness_status", message: "Invalid readiness status value." });
    }

    const conditionToken = normalizeToken(row.values.condition);
    const conditionStatus = conditionToken ? CONDITION_ALIAS[conditionToken] ?? null : null;
    if (conditionToken && !conditionStatus) {
      issues.push({ rowNumber: row.rowNumber, field: "condition", message: "Invalid condition value." });
    }

    const ownerToken = normalizeToken(row.values.owner_source);
    const ownershipType = ownerToken ? OWNERSHIP_ALIAS[ownerToken] ?? null : null;
    if (ownerToken && !ownershipType) {
      issues.push({ rowNumber: row.rowNumber, field: "owner_source", message: "Invalid ownership/source value." });
    }

    const activeToken = row.values.active.trim();
    const active = activeToken ? parseBooleanLike(activeToken) : null;
    if (activeToken && active === null) {
      issues.push({ rowNumber: row.rowNumber, field: "active", message: "Active value must be true/false or active/inactive." });
    }

    const lifecycleStatus =
      active === false
        ? GearItemLifecycleStatus.RETIRED
        : row.values.readiness_status.trim()
          ? GearItemLifecycleStatus.ACTIVE
          : LIFECYCLE_ALIAS[normalizeToken(row.values.active)] ?? GearItemLifecycleStatus.ACTIVE;

    const quantityValue = parseOptionalInt(row.values.quantity);
    const quantityOnHand = quantityValue ?? (category.inventoryType === "CONSUMABLE" ? 0 : 1);
    if (category.inventoryType === "CONSUMABLE" && quantityValue === null) {
      issues.push({ rowNumber: row.rowNumber, field: "quantity", message: "Consumables require a valid integer quantity." });
    }

    const quantityMin = parseOptionalInt(row.values.low_threshold);
    if (row.values.low_threshold.trim() && quantityMin === null) {
      issues.push({ rowNumber: row.rowNumber, field: "low_threshold", message: "Low threshold must be an integer." });
    }

    const locationToken = normalizeToken(row.values.location);
    const location =
      (locationToken ? locationByCode.get(locationToken) : null) ||
      (locationToken ? locationByName.get(locationToken) : null) ||
      null;

    if (row.values.location.trim() && !location) {
      issues.push({ rowNumber: row.rowNumber, field: "location", message: "Location not found in this organization." });
    }

    if (category.inventoryType === "DURABLE" && row.values.quantity.trim() && quantityOnHand < 0) {
      issues.push({ rowNumber: row.rowNumber, field: "quantity", message: "Durable quantity must be a non-negative integer when provided." });
    }

    if (category.inventoryType === "CONSUMABLE" && row.values.condition.trim()) {
      warnings.push({
        rowNumber: row.rowNumber,
        field: "condition",
        message: "Condition is typically durable-only and may be ignored for consumables.",
      });
    }

    if (issues.length > issueCountBeforeValidation) {
      continue;
    }

    previewRows.push({
      rowNumber: row.rowNumber,
      action,
      identifier: identifierParts.identifier,
      itemName,
      categoryId: category.id,
      locationId: location?.id ?? null,
      inventoryType: category.inventoryType,
      lifecycleStatus,
      conditionStatus,
      ownershipType,
      readinessState,
      quantityOnHand,
      quantityMin,
      serialNumber: identifierParts.serialNumber,
      barcodeValue: identifierParts.barcodeValue,
      assetId: identifierParts.assetId,
      sku: identifierParts.sku,
      notes: [row.values.description.trim(), row.values.notes.trim()].filter(Boolean).join("\n") || null,
      existingItemId: existing?.id ?? null,
    });
  }

  const createCount = previewRows.filter((row) => row.action === "CREATE").length;
  const updateCount = previewRows.filter((row) => row.action === "UPDATE").length;

  return {
    rowCount: parsed.rows.length,
    createCount,
    updateCount,
    issues,
    warnings,
    rows: previewRows,
  };
}

export async function commitGearImport(input: {
  organizationId: string;
  mode: GearImportMode;
  csvText: string;
}): Promise<GearImportCommitResult> {
  const preview = await previewGearImport(input);
  if (preview.issues.length > 0) {
    return {
      rowCount: preview.rowCount,
      createdCount: 0,
      updatedCount: 0,
      issues: preview.issues,
    };
  }

  let createdCount = 0;
  let updatedCount = 0;

  await db.$transaction(async (tx) => {
    for (const row of preview.rows) {
      const data: Prisma.GearItemUncheckedCreateInput = {
        organizationId: input.organizationId,
        gearCategoryId: row.categoryId,
        name: row.itemName,
        inventoryType: row.inventoryType,
        lifecycleStatus: row.lifecycleStatus,
        conditionStatus: row.conditionStatus,
        ownershipType: row.ownershipType,
        readinessState: row.readinessState,
        quantityOnHand: row.quantityOnHand,
        quantityMin: row.quantityMin,
        serialNumber: row.serialNumber,
        barcodeValue: row.barcodeValue,
        assetId: row.assetId,
        sku: row.sku,
        locationId: row.locationId,
        notes: row.notes,
      };

      if (row.action === "UPDATE" && row.existingItemId) {
        await tx.gearItem.updateMany({
          where: { id: row.existingItemId, organizationId: input.organizationId },
          data,
        });
        updatedCount += 1;
      } else {
        await tx.gearItem.create({ data });
        createdCount += 1;
      }
    }
  });

  return {
    rowCount: preview.rowCount,
    createdCount,
    updatedCount,
    issues: [],
  };
}

export function buildGearImportTemplateCsv() {
  const rows = [
    TEMPLATE_COLUMNS.join(","),
    [
      "Practice jersey #12",
      "Apparel",
      "apparel_starter",
      "Blue home jersey",
      "",
      "JER-12",
      "",
      "",
      "ORGANIZATION_OWNED",
      "Equipment Cage A",
      "READY",
      "GOOD",
      "1",
      "",
      "Sized medium",
      "true",
    ]
      .map((value) => quoteCsv(value))
      .join(","),
    [
      "Hydration gel box",
      "Consumables",
      "consumable_starter",
      "Cherry",
      "",
      "GEL-CH-BOX",
      "",
      "",
      "DONATED",
      "Field Stock Trailer",
      "READY",
      "",
      "24",
      "8",
      "Match-day stock",
      "true",
    ]
      .map((value) => quoteCsv(value))
      .join(","),
  ];

  return `${rows.join("\n")}\n`;
}

function toCsv(rows: Array<Array<string | number | null>>) {
  return `${rows.map((row) => row.map((value) => quoteCsv(value)).join(",")).join("\n")}\n`;
}

export async function buildGearExportCsv(input: {
  organizationId: string;
  dataset: GearExportDataset;
}): Promise<{ fileName: string; csv: string }> {
  if (input.dataset === "inventory") {
    const items = await db.gearItem.findMany({
      where: { organizationId: input.organizationId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        inventoryType: true,
        lifecycleStatus: true,
        serialNumber: true,
        assetId: true,
        barcodeValue: true,
        sku: true,
        quantityOnHand: true,
        quantityMin: true,
        readinessState: true,
        ownershipType: true,
        category: { select: { name: true } },
        location: { select: { name: true, locationCode: true } },
      },
    });

    return {
      fileName: "gearops-inventory-export.csv",
      csv: toCsv([
        [
          "item_id",
          "item_name",
          "category",
          "inventory_type",
          "lifecycle_status",
          "serial_number",
          "asset_id",
          "asset_tag",
          "sku",
          "quantity",
          "low_threshold",
          "readiness",
          "owner_source",
          "location",
          "location_code",
        ],
        ...items.map((item) => [
          item.id,
          item.name,
          item.category.name,
          item.inventoryType,
          item.lifecycleStatus,
          item.serialNumber,
          item.assetId,
          item.barcodeValue,
          item.sku,
          item.quantityOnHand,
          item.quantityMin,
          item.readinessState,
          item.ownershipType,
          item.location?.name ?? "",
          item.location?.locationCode ?? "",
        ]),
      ]),
    };
  }

  if (input.dataset === "custody") {
    const items = await db.gearItem.findMany({
      where: { organizationId: input.organizationId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        assignments: {
          where: { status: { in: ["PENDING", "ACTIVE", "OVERDUE"] } },
          orderBy: [{ assignedAt: "desc" }],
          take: 1,
          select: {
            status: true,
            assignedTo: { select: { firstName: true, lastName: true } },
            assignedTeam: { select: { name: true } },
            assignedEvent: { select: { title: true } },
          },
        },
        checkouts: {
          where: { status: { in: ["OPEN", "OVERDUE"] } },
          orderBy: [{ checkedOutAt: "desc" }],
          take: 1,
          select: {
            status: true,
            checkedOutBy: { select: { firstName: true, lastName: true } },
            event: { select: { title: true } },
          },
        },
      },
    });

    return {
      fileName: "gearops-custody-summary-export.csv",
      csv: toCsv([
        ["item_id", "item_name", "checkout_status", "checked_out_by", "checkout_event", "assignment_status", "assigned_to", "assignment_team", "assignment_event"],
        ...items.map((item) => {
          const checkout = item.checkouts[0] ?? null;
          const assignment = item.assignments[0] ?? null;
          return [
            item.id,
            item.name,
            checkout?.status ?? "",
            checkout?.checkedOutBy ? `${checkout.checkedOutBy.firstName} ${checkout.checkedOutBy.lastName}` : "",
            checkout?.event?.title ?? "",
            assignment?.status ?? "",
            assignment?.assignedTo ? `${assignment.assignedTo.firstName} ${assignment.assignedTo.lastName}` : "",
            assignment?.assignedTeam?.name ?? "",
            assignment?.assignedEvent?.title ?? "",
          ];
        }),
      ]),
    };
  }

  if (input.dataset === "location") {
    const locations = await db.inventoryLocation.findMany({
      where: { organizationId: input.organizationId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        locationCode: true,
        _count: { select: { gearItems: true } },
      },
    });

    return {
      fileName: "gearops-location-summary-export.csv",
      csv: toCsv([
        ["location_id", "location_name", "location_code", "item_count"],
        ...locations.map((location) => [location.id, location.name, location.locationCode, location._count.gearItems]),
      ]),
    };
  }

  if (input.dataset === "readiness") {
    const items = await db.gearItem.findMany({
      where: { organizationId: input.organizationId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        readinessState: true,
        lifecycleStatus: true,
        conditionStatus: true,
        category: { select: { name: true } },
      },
    });

    return {
      fileName: "gearops-readiness-summary-export.csv",
      csv: toCsv([
        ["item_id", "item_name", "category", "readiness_state", "lifecycle_status", "condition_status"],
        ...items.map((item) => [
          item.id,
          item.name,
          item.category.name,
          item.readinessState,
          item.lifecycleStatus,
          item.conditionStatus,
        ]),
      ]),
    };
  }

  if (input.dataset === "event_plan") {
    const plans = await db.eventGearPlan.findMany({
      where: { organizationId: input.organizationId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        event: { select: { id: true, title: true, startsAt: true } },
        requirements: { select: { id: true, label: true, quantityNeeded: true } },
        assignments: {
          select: {
            gearItem: { select: { name: true } },
            recoveredAt: true,
          },
        },
      },
    });

    return {
      fileName: "gearops-event-plan-export.csv",
      csv: toCsv([
        ["plan_id", "event_id", "event_title", "event_starts_at", "plan_status", "requirement_count", "assigned_item_count", "missing_or_unreturned_count"],
        ...plans.map((plan) => [
          plan.id,
          plan.event.id,
          plan.event.title,
          plan.event.startsAt.toISOString(),
          plan.status,
          plan.requirements.length,
          plan.assignments.length,
          plan.assignments.filter((assignment) => !assignment.recoveredAt).length,
        ]),
      ]),
    };
  }

  const sessions = await db.inventoryAuditSession.findMany({
    where: { organizationId: input.organizationId },
    orderBy: [{ startedAt: "desc" }],
    select: {
      id: true,
      startedAt: true,
      completedAt: true,
      audit: { select: { id: true, name: true } },
      _count: { select: { results: true, discrepancies: true } },
    },
  });

  return {
    fileName: "gearops-audit-summary-export.csv",
    csv: toCsv([
      ["session_id", "audit_id", "audit_name", "started_at", "completed_at", "result_count", "discrepancy_count"],
      ...sessions.map((session) => [
        session.id,
        session.audit?.id ?? "",
        session.audit?.name ?? "",
        session.startedAt?.toISOString() ?? "",
        session.completedAt?.toISOString() ?? "",
        session._count.results,
        session._count.discrepancies,
      ]),
    ]),
  };
}
