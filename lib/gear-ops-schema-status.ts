import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type GearOpsSchemaRequirement = {
  table: string;
  columns: string[];
};

export type GearOpsSchemaScope = "core" | "category-creation";

export type GearOpsSchemaStatus = {
  connected: boolean;
  schemaReady: boolean;
  missingTables: string[];
  missingColumns: string[];
  checkedAt: string;
};

const CATEGORY_CREATION_REQUIREMENTS: GearOpsSchemaRequirement[] = [
  {
    table: "GearCategory",
    columns: [
      "organizationId",
      "name",
      "inventoryType",
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
    ],
  },
];

const CORE_REQUIREMENTS: GearOpsSchemaRequirement[] = [
  ...CATEGORY_CREATION_REQUIREMENTS,
  {
    table: "GearItem",
    columns: ["organizationId", "gearCategoryId", "name", "inventoryType", "lifecycleStatus", "locationId"],
  },
  {
    table: "InventoryLocation",
    columns: ["organizationId", "name", "isActive", "locationType", "parentLocationId"],
  },
  {
    table: "GearAssignment",
    columns: ["organizationId", "gearItemId", "status", "assignedByPersonId"],
  },
  {
    table: "GearCheckout",
    columns: ["organizationId", "gearItemId", "status", "checkedOutById", "issuedById"],
  },
  {
    table: "GearReservation",
    columns: ["organizationId", "gearItemId", "status", "mode", "windowStartAt", "windowEndAt"],
  },
];

function requirementsForScope(scope: GearOpsSchemaScope): GearOpsSchemaRequirement[] {
  return scope === "category-creation" ? CATEGORY_CREATION_REQUIREMENTS : CORE_REQUIREMENTS;
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

export async function getGearOpsSchemaStatus(scope: GearOpsSchemaScope = "core"): Promise<GearOpsSchemaStatus> {
  const checkedAt = new Date().toISOString();
  const requirements = requirementsForScope(scope);

  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    return {
      connected: false,
      schemaReady: false,
      missingTables: [],
      missingColumns: [],
      checkedAt,
    };
  }

  try {
    const tableRows = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT tablename AS table_name
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
    `;

    const availableTables = new Set(tableRows.map((row) => row.table_name));
    const missingTables: string[] = [];

    for (const requirement of requirements) {
      if (!availableTables.has(requirement.table)) {
        missingTables.push(requirement.table);
      }
    }

    const tablesToCheckColumns = requirements.filter((requirement) => !missingTables.includes(requirement.table));
    const availableColumnsByTable = new Map<string, Set<string>>();

    if (tablesToCheckColumns.length > 0) {
      const tableNameSql = tablesToCheckColumns.map((requirement) => Prisma.sql`${requirement.table}`);
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

    const missingColumns: string[] = [];
    for (const requirement of tablesToCheckColumns) {
      const availableColumns = availableColumnsByTable.get(requirement.table) ?? new Set<string>();
      for (const column of requirement.columns) {
        if (!availableColumns.has(column)) {
          missingColumns.push(`${requirement.table}.${column}`);
        }
      }
    }

    return {
      connected: true,
      schemaReady: missingTables.length === 0 && missingColumns.length === 0,
      missingTables: missingTables.sort(),
      missingColumns: missingColumns.sort(),
      checkedAt,
    };
  } catch {
    return {
      connected: true,
      schemaReady: false,
      missingTables: [],
      missingColumns: [],
      checkedAt,
    };
  }
}
