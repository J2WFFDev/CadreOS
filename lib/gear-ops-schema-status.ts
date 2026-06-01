import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type GearOpsSchemaRequirement = {
  table: string;
  columns: string[];
};

export type GearOpsSchemaScope =
  | "core"
  | "category-creation"
  | "item-creation"
  | "item-list"
  | "item-detail"
  | "reservation-creation"
  | "kits"
  | "reports"
  | "event-templates"
  | "audits"
  | "admin";

export type GearOpsSchemaStatus = {
  connected: boolean;
  schemaReady: boolean;
  missingTables: string[];
  missingColumns: string[];
  checkedTables: string[];
  checkedAt: string;
  databaseProvider: string | null;
  pendingActions: string[];
  setupRequired: boolean;
  scope: GearOpsSchemaScope;
  failedQuery: string | null;
  failureReason: string | null;
};

type GearOpsSchemaEvaluationInput = {
  scope: GearOpsSchemaScope;
  availableTables: Iterable<string>;
  availableColumnsByTable: Map<string, Set<string>>;
};

const GEAR_CATEGORY_CONFIGURATION_COLUMNS = [
  "organizationId",
  "name",
  "inventoryType",
  "description",
  "templateSlug",
  "behaviorType",
  "custodyMode",
  "requiresReturnInspection",
  "requiresMaintenanceTracking",
  "maintenanceFrequency",
  "maintenanceIntervalDays",
  "primaryIdentifierType",
  "supportsConsumableTracking",
  "consumableLowStockDefault",
  "supportsEventDeployment",
  "reportGroup",
  "reportLabel",
  "isKitContainer",
  "guardianApprovalRequired",
];

const GEAR_CATEGORY_BASIC_COLUMNS = ["organizationId", "name", "inventoryType"];
const PROGRAM_LOOKUP_COLUMNS = ["organizationId", "name"];
const INVENTORY_LOCATION_COLUMNS = ["organizationId", "name", "isActive", "locationType", "parentLocationId"];
const INVENTORY_LOCATION_MINIMAL_COLUMNS = ["organizationId", "name", "locationCode"];
const GEAR_ITEM_CREATE_COLUMNS = [
  "organizationId",
  "programId",
  "gearCategoryId",
  "name",
  "inventoryType",
  "manufacturer",
  "model",
  "sku",
  "serialNumber",
  "qrCodeValue",
  "quantityOnHand",
  "unitType",
  "quantityMin",
  "lifecycleStatus",
  "conditionStatus",
  "inventoryCondition",
  "availabilityStatus",
  "barcodeValue",
  "ownerType",
  "ownerRecordType",
  "ownerRecordId",
  "ownershipNotes",
  "custodyPersonId",
  "locationId",
  "storageLocationText",
  "notes",
];
const GEAR_ITEM_REPORTING_COLUMNS = [
  "organizationId",
  "gearCategoryId",
  "name",
  "inventoryType",
  "lifecycleStatus",
  "conditionStatus",
  "inventoryCondition",
  "availabilityStatus",
  "ownershipType",
  "ownerType",
  "ownerRecordType",
  "ownerRecordId",
  "ownershipNotes",
  "custodyPersonId",
  "readinessState",
  "locationId",
  "storageLocationText",
  "manufacturer",
  "model",
  "qrCodeValue",
  "unitType",
  "quantityOnHand",
  "quantityMin",
  "inspectionDueStatus",
  "maintenanceDueStatus",
  "nextInspectionDueAt",
  "nextMaintenanceDueAt",
];
const GEAR_ASSIGNMENT_COLUMNS = [
  "organizationId",
  "gearItemId",
  "status",
  "assignedToPersonId",
  "assignedToEventId",
  "expectedReturnAt",
  "returnedAt",
];
const GEAR_CHECKOUT_COLUMNS = [
  "organizationId",
  "gearItemId",
  "status",
  "checkedOutById",
  "issuedById",
  "eventId",
  "checkedOutAt",
  "expectedReturnAt",
  "returnedAt",
];
const GEAR_RESERVATION_COLUMNS = [
  "organizationId",
  "gearItemId",
  "status",
  "mode",
  "holdType",
  "purpose",
  "windowStartAt",
  "windowEndAt",
  "conflictSummary",
  "reservedForPersonId",
  "reservedForTeamId",
  "reservedForEventId",
];
const GEAR_MAINTENANCE_LOG_COLUMNS = [
  "organizationId",
  "gearItemId",
  "maintenanceType",
  "performedAt",
  "nextMaintenanceDueAt",
  "isPostEventRecovery",
];
const CONSUMABLE_TRANSACTION_COLUMNS = [
  "organizationId",
  "gearItemId",
  "transactionType",
  "quantityDelta",
  "recordedAt",
];
const EVENT_GEAR_PLAN_COLUMNS = ["organizationId", "eventId", "status", "stagingLocationId", "recoveryLocationId"];
const EVENT_GEAR_REQUIREMENT_COLUMNS = [
  "organizationId",
  "planId",
  "gearCategoryId",
  "label",
  "requirementType",
  "quantityNeeded",
];
const EVENT_GEAR_ASSIGNMENT_COLUMNS = [
  "organizationId",
  "planId",
  "requirementId",
  "gearItemId",
  "assignedByPersonId",
  "stagedAt",
  "recoveredAt",
  "stagedFromLocationId",
  "stagedToLocationId",
  "recoveredToLocationId",
  "conditionOnRecovery",
  "maintenanceFlag",
];
const EVENT_GEAR_TEMPLATE_COLUMNS = [
  "organizationId",
  "name",
  "gearCategoryId",
  "label",
  "requirementType",
  "quantityNeeded",
  "isActive",
];
const GEAR_OPS_SETTINGS_COLUMNS = [
  "organizationId",
  "defaultCustodyMode",
  "enableGuardianApproval",
  "enableConsumableTracking",
  "enableEventDeployment",
  "enableReadinessTracking",
  "enableMaintenanceTracking",
  "defaultReportGroup",
];
const INVENTORY_KIT_LIST_COLUMNS = [
  "organizationId",
  "name",
  "description",
  "kitType",
  "ownerPersonId",
  "assignedToPersonId",
  "readinessLabel",
  "custodyStatus",
  "lastInspectionStatus",
  "isActive",
];
const INVENTORY_KIT_LIST_ITEM_COLUMNS = [
  "organizationId",
  "kitId",
  "removedAt",
];
const INVENTORY_AUDIT_LIST_COLUMNS = [
  "organizationId",
  "name",
  "description",
  "auditType",
  "scope",
  "nextScheduledAt",
  "lastExecutedAt",
  "archivedAt",
];
const INVENTORY_AUDIT_SESSION_LIST_COLUMNS = [
  "organizationId",
  "inventoryAuditId",
  "status",
  "startedAt",
  "completedAt",
];

const GEAR_ITEM_LIST_COLUMNS = [
  "organizationId",
  "gearCategoryId",
  "programId",
  "name",
  "inventoryType",
  "lifecycleStatus",
  "conditionStatus",
  "inventoryCondition",
  "availabilityStatus",
  "ownerType",
  "custodyPersonId",
  "manufacturer",
  "model",
  "unitType",
  "quantityOnHand",
  "quantityMin",
];
const GEAR_ITEM_DETAIL_COLUMNS = [
  "organizationId",
  "gearCategoryId",
  "programId",
  "locationId",
  "name",
  "inventoryType",
  "lifecycleStatus",
  "conditionStatus",
  "inventoryCondition",
  "availabilityStatus",
  "readinessState",
  "ownershipType",
  "ownerType",
  "ownerRecordType",
  "ownerRecordId",
  "ownershipNotes",
  "custodyPersonId",
  "barcodeValue",
  "qrCodeValue",
  "manufacturer",
  "model",
  "sku",
  "serialNumber",
  "unitType",
  "storageLocationText",
  "quantityOnHand",
  "quantityMin",
  "notes",
];
const GEAR_ASSIGNMENT_LIST_COLUMNS = [
  "organizationId",
  "gearItemId",
  "status",
  "assignedAt",
  "assignedToPersonId",
];
const GEAR_CHECKOUT_LIST_COLUMNS = [
  "organizationId",
  "gearItemId",
  "status",
  "checkedOutAt",
  "checkedOutById",
];
const GEAR_MAINTENANCE_LOG_LIST_COLUMNS = [
  "organizationId",
  "gearItemId",
  "maintenanceType",
  "performedAt",
];
const CONSUMABLE_TRANSACTION_LIST_COLUMNS = [
  "organizationId",
  "gearItemId",
  "transactionType",
  "quantityDelta",
  "recordedAt",
];
const GEAR_ASSIGNMENT_DETAIL_COLUMNS = [
  "organizationId",
  "gearItemId",
  "status",
  "assignedAt",
  "expectedReturnAt",
  "returnedAt",
  "notes",
  "assignedByPersonId",
  "assignedToPersonId",
  "assignedToTeamId",
  "assignedToEventId",
];
const GEAR_CHECKOUT_DETAIL_COLUMNS = [
  "organizationId",
  "gearItemId",
  "eventId",
  "checkedOutById",
  "issuedById",
  "returnedById",
  "receivedById",
  "checkedOutAt",
  "expectedReturnAt",
  "returnedAt",
  "status",
  "conditionOnReturn",
  "purposeNotes",
  "returnNotes",
];
const GEAR_RESERVATION_DETAIL_COLUMNS = [
  "organizationId",
  "gearItemId",
  "programId",
  "reservedForPersonId",
  "reservedForTeamId",
  "reservedForEventId",
  "requestedByPersonId",
  "mode",
  "holdType",
  "purpose",
  "status",
  "approvalStatus",
  "quantityRequested",
  "windowStartAt",
  "windowEndAt",
  "notes",
  "releaseReason",
  "conflictSummary",
  "releasedAt",
  "fulfilledAt",
];
const GEAR_MAINTENANCE_LOG_DETAIL_COLUMNS = [
  "organizationId",
  "gearItemId",
  "performedByPersonId",
  "maintenanceType",
  "performedAt",
  "conditionBefore",
  "conditionAfter",
  "notes",
];
const CONSUMABLE_TRANSACTION_DETAIL_COLUMNS = [
  "organizationId",
  "gearItemId",
  "transactionType",
  "quantityDelta",
  "recordedByPersonId",
  "eventId",
  "recordedAt",
  "notes",
];

const CATEGORY_CREATION_REQUIREMENTS: GearOpsSchemaRequirement[] = [
  {
    table: "GearCategory",
    columns: GEAR_CATEGORY_CONFIGURATION_COLUMNS,
  },
];

const CORE_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements(
  CATEGORY_CREATION_REQUIREMENTS,
  [
    { table: "GearItem", columns: GEAR_ITEM_REPORTING_COLUMNS },
    { table: "InventoryLocation", columns: INVENTORY_LOCATION_COLUMNS },
    { table: "GearAssignment", columns: GEAR_ASSIGNMENT_COLUMNS },
    { table: "GearCheckout", columns: GEAR_CHECKOUT_COLUMNS },
    { table: "GearReservation", columns: GEAR_RESERVATION_COLUMNS },
    { table: "GearMaintenanceLog", columns: GEAR_MAINTENANCE_LOG_COLUMNS },
    { table: "ConsumableTransaction", columns: CONSUMABLE_TRANSACTION_COLUMNS },
    { table: "EventGearPlan", columns: EVENT_GEAR_PLAN_COLUMNS },
    { table: "EventGearRequirement", columns: EVENT_GEAR_REQUIREMENT_COLUMNS },
    { table: "EventGearAssignment", columns: EVENT_GEAR_ASSIGNMENT_COLUMNS },
  ],
);

const ITEM_CREATION_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements(
  [{ table: "GearCategory", columns: GEAR_CATEGORY_BASIC_COLUMNS }],
  [{ table: "Program", columns: PROGRAM_LOOKUP_COLUMNS }],
  [{ table: "GearItem", columns: GEAR_ITEM_CREATE_COLUMNS }],
);

const EVENT_TEMPLATE_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements(
  [{ table: "GearCategory", columns: GEAR_CATEGORY_BASIC_COLUMNS }],
  [{ table: "EventGearRequirementTemplate", columns: EVENT_GEAR_TEMPLATE_COLUMNS }],
);

const ADMIN_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements(
  CATEGORY_CREATION_REQUIREMENTS,
  EVENT_TEMPLATE_REQUIREMENTS,
  [{ table: "GearOpsOrganizationSettings", columns: GEAR_OPS_SETTINGS_COLUMNS }],
);

const KIT_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements(
  [{ table: "InventoryKit", columns: INVENTORY_KIT_LIST_COLUMNS }],
  [{ table: "InventoryKitItem", columns: INVENTORY_KIT_LIST_ITEM_COLUMNS }],
);

const REPORT_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements([
  { table: "GearCategory", columns: GEAR_CATEGORY_BASIC_COLUMNS },
  {
    table: "GearItem",
    columns: [
      "organizationId",
      "gearCategoryId",
      "name",
      "inventoryType",
      "lifecycleStatus",
      "conditionStatus",
      "ownershipType",
      "readinessState",
      "locationId",
      "quantityOnHand",
      "quantityMin",
      "inspectionDueStatus",
      "maintenanceDueStatus",
      "nextInspectionDueAt",
      "nextMaintenanceDueAt",
    ],
  },
  { table: "InventoryLocation", columns: ["organizationId", "name"] },
  {
    table: "GearAssignment",
    columns: ["organizationId", "gearItemId", "status", "expectedReturnAt", "returnedAt", "assignedToPersonId", "assignedToEventId"],
  },
  {
    table: "GearCheckout",
    columns: ["organizationId", "gearItemId", "status", "expectedReturnAt", "returnedAt", "checkedOutAt", "checkedOutById", "eventId"],
  },
  { table: "GearReservation", columns: GEAR_RESERVATION_COLUMNS },
  { table: "ConsumableTransaction", columns: CONSUMABLE_TRANSACTION_COLUMNS },
  { table: "EventGearPlan", columns: ["organizationId", "eventId"] },
  { table: "EventGearRequirement", columns: ["organizationId", "planId", "quantityNeeded"] },
  { table: "EventGearAssignment", columns: ["organizationId", "requirementId", "gearItemId", "stagedAt", "recoveredAt"] },
]);

const AUDIT_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements(
  [{ table: "InventoryAudit", columns: INVENTORY_AUDIT_LIST_COLUMNS }],
  [{ table: "InventoryAuditSession", columns: INVENTORY_AUDIT_SESSION_LIST_COLUMNS }],
);

const ITEM_LIST_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements(
  [{ table: "GearItem", columns: GEAR_ITEM_LIST_COLUMNS }],
  [{ table: "GearCategory", columns: GEAR_CATEGORY_BASIC_COLUMNS }],
  [{ table: "Program", columns: PROGRAM_LOOKUP_COLUMNS }],
  [{ table: "GearAssignment", columns: GEAR_ASSIGNMENT_LIST_COLUMNS }],
  [{ table: "GearCheckout", columns: GEAR_CHECKOUT_LIST_COLUMNS }],
  [{ table: "GearMaintenanceLog", columns: GEAR_MAINTENANCE_LOG_LIST_COLUMNS }],
  [{ table: "ConsumableTransaction", columns: CONSUMABLE_TRANSACTION_LIST_COLUMNS }],
);

const ITEM_DETAIL_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements(
  [{ table: "GearItem", columns: GEAR_ITEM_DETAIL_COLUMNS }],
  [{ table: "GearCategory", columns: GEAR_CATEGORY_BASIC_COLUMNS }],
  [{ table: "Program", columns: PROGRAM_LOOKUP_COLUMNS }],
  [{ table: "InventoryLocation", columns: INVENTORY_LOCATION_MINIMAL_COLUMNS }],
  [{ table: "GearAssignment", columns: GEAR_ASSIGNMENT_DETAIL_COLUMNS }],
  [{ table: "GearCheckout", columns: GEAR_CHECKOUT_DETAIL_COLUMNS }],
  [{ table: "GearMaintenanceLog", columns: GEAR_MAINTENANCE_LOG_DETAIL_COLUMNS }],
  [{ table: "ConsumableTransaction", columns: CONSUMABLE_TRANSACTION_DETAIL_COLUMNS }],
);

const RESERVATION_CREATION_REQUIREMENTS: GearOpsSchemaRequirement[] = mergeRequirements(
  [{ table: "GearCategory", columns: ["organizationId", "name", "guardianApprovalRequired"] }],
  [
    {
      table: "GearItem",
      columns: ["organizationId", "gearCategoryId", "name", "inventoryType", "lifecycleStatus", "quantityOnHand", "readinessState", "inventoryCondition"],
    },
  ],
  [{ table: "GearReservation", columns: GEAR_RESERVATION_DETAIL_COLUMNS }],
  [{ table: "GearCheckout", columns: ["organizationId", "gearItemId", "status"] }],
  [{ table: "GearAssignment", columns: ["organizationId", "gearItemId", "status"] }],
);

const GEAR_OPS_SCHEMA_REQUIREMENTS: Record<GearOpsSchemaScope, GearOpsSchemaRequirement[]> = {
  core: CORE_REQUIREMENTS,
  "category-creation": CATEGORY_CREATION_REQUIREMENTS,
  "item-creation": ITEM_CREATION_REQUIREMENTS,
  "item-list": ITEM_LIST_REQUIREMENTS,
  "item-detail": ITEM_DETAIL_REQUIREMENTS,
  "reservation-creation": RESERVATION_CREATION_REQUIREMENTS,
  kits: KIT_REQUIREMENTS,
  reports: REPORT_REQUIREMENTS,
  "event-templates": EVENT_TEMPLATE_REQUIREMENTS,
  audits: AUDIT_REQUIREMENTS,
  admin: ADMIN_REQUIREMENTS,
};

function mergeRequirements(...groups: GearOpsSchemaRequirement[][]): GearOpsSchemaRequirement[] {
  const merged = new Map<string, Set<string>>();

  for (const group of groups) {
    for (const requirement of group) {
      const columns = merged.get(requirement.table) ?? new Set<string>();
      for (const column of requirement.columns) {
        columns.add(column);
      }
      merged.set(requirement.table, columns);
    }
  }

  return [...merged.entries()]
    .map(([table, columns]) => ({ table, columns: [...columns].sort() }))
    .sort((left, right) => left.table.localeCompare(right.table));
}

function getDatabaseProvider(): string | null {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return null;
  }

  try {
    return new URL(databaseUrl).protocol.replace(":", "") || null;
  } catch {
    return null;
  }
}

function buildGearOpsPendingActions(input: { missingTables: string[]; missingColumns: string[] }): string[] {
  const actions: string[] = [];

  if (input.missingTables.length > 0) {
    actions.push(`Create missing tables: ${input.missingTables.join(", ")}`);
  }

  if (input.missingColumns.length > 0) {
    actions.push(`Add missing columns: ${input.missingColumns.join(", ")}`);
  }

  return actions;
}

function getStatusShell(scope: GearOpsSchemaScope, checkedAt: string): Omit<GearOpsSchemaStatus, "connected" | "schemaReady"> {
  return {
    missingTables: [],
    missingColumns: [],
    checkedTables: getGearOpsSchemaRequirements(scope).map((requirement) => requirement.table),
    checkedAt,
    databaseProvider: getDatabaseProvider(),
    pendingActions: [],
    setupRequired: false,
    scope,
    failedQuery: null,
    failureReason: null,
  };
}

function describeSchemaProbeError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const detail = error.message.split("\n").at(0)?.trim();
    return detail || `Prisma error ${error.code}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown schema probe failure";
}

export const GEAR_OPS_ALL_SCOPES: GearOpsSchemaScope[] = Object.keys(
  GEAR_OPS_SCHEMA_REQUIREMENTS,
) as GearOpsSchemaScope[];

export function isGearOpsSchemaScope(value: string | null | undefined): value is GearOpsSchemaScope {
  return Boolean(value && value in GEAR_OPS_SCHEMA_REQUIREMENTS);
}

export function getGearOpsSchemaRequirements(scope: GearOpsSchemaScope): GearOpsSchemaRequirement[] {
  return GEAR_OPS_SCHEMA_REQUIREMENTS[scope].map((requirement) => ({
    table: requirement.table,
    columns: [...requirement.columns],
  }));
}

export function formatGearOpsSchemaMissingDetail(input: {
  missingTables: string[];
  missingColumns: string[];
}): string | null {
  const parts: string[] = [];

  if (input.missingTables.length > 0) {
    parts.push(`tables: ${input.missingTables.join(", ")}`);
  }

  if (input.missingColumns.length > 0) {
    parts.push(`columns: ${input.missingColumns.join(", ")}`);
  }

  return parts.length > 0 ? parts.join(" | ") : null;
}

export function buildGearOpsSchemaUnavailableMessage(
  status: Pick<GearOpsSchemaStatus, "missingTables" | "missingColumns">,
  actionMessage: string,
): string {
  const detail = formatGearOpsSchemaMissingDetail(status);
  return detail
    ? `Database schema is not available yet (${detail}). ${actionMessage}`
    : `Database schema is not available yet. ${actionMessage}`;
}

export function evaluateGearOpsSchemaStatus(input: GearOpsSchemaEvaluationInput): Omit<GearOpsSchemaStatus, "connected" | "checkedAt" | "databaseProvider"> {
  const requirements = getGearOpsSchemaRequirements(input.scope);
  const availableTables = new Set(input.availableTables);
  const missingTables = requirements
    .filter((requirement) => !availableTables.has(requirement.table))
    .map((requirement) => requirement.table)
    .sort();

  const missingColumns: string[] = [];
  for (const requirement of requirements) {
    if (missingTables.includes(requirement.table)) {
      continue;
    }

    const availableColumns = input.availableColumnsByTable.get(requirement.table) ?? new Set<string>();
    for (const column of requirement.columns) {
      if (!availableColumns.has(column)) {
        missingColumns.push(`${requirement.table}.${column}`);
      }
    }
  }

  missingColumns.sort();

  return {
    schemaReady: missingTables.length === 0 && missingColumns.length === 0,
    missingTables,
    missingColumns,
    checkedTables: requirements.map((requirement) => requirement.table),
    pendingActions: buildGearOpsPendingActions({ missingTables, missingColumns }),
    setupRequired: missingTables.length > 0 || missingColumns.length > 0,
    scope: input.scope,
    failedQuery: null,
    failureReason: null,
  };
}

export async function getGearOpsSchemaStatus(scope: GearOpsSchemaScope = "core"): Promise<GearOpsSchemaStatus> {
  const checkedAt = new Date().toISOString();
  const statusShell = getStatusShell(scope, checkedAt);
  const requirements = getGearOpsSchemaRequirements(scope);

  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    return {
      connected: false,
      schemaReady: false,
      ...statusShell,
      setupRequired: true,
      failedQuery: "SELECT 1",
      failureReason: describeSchemaProbeError(error),
    };
  }

  try {
    const tableRows = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT tablename AS table_name
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
    `;

    const availableTables = new Set(tableRows.map((row) => row.table_name));
    const tablesToCheck = requirements.filter((requirement) => availableTables.has(requirement.table));
    const availableColumnsByTable = new Map<string, Set<string>>();

    if (tablesToCheck.length > 0) {
      const tableNameSql = tablesToCheck.map((requirement) => Prisma.sql`${requirement.table}`);
      const columnRows = await db.$queryRaw<Array<{ table_name: string; column_name: string }>>(
        Prisma.sql`
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN (${Prisma.join(tableNameSql)})
          `,
      );

      for (const row of columnRows) {
        const existing = availableColumnsByTable.get(row.table_name) ?? new Set<string>();
        existing.add(row.column_name);
        availableColumnsByTable.set(row.table_name, existing);
      }
    }

    const evaluated = evaluateGearOpsSchemaStatus({
      scope,
      availableTables,
      availableColumnsByTable,
    });

    return {
      connected: true,
      checkedAt,
      databaseProvider: statusShell.databaseProvider,
      ...evaluated,
    };
  } catch (error) {
    return {
      connected: true,
      schemaReady: false,
      ...statusShell,
      setupRequired: true,
      failedQuery: "pg_catalog.pg_tables / information_schema.columns schema probe",
      failureReason: describeSchemaProbeError(error),
    };
  }
}
