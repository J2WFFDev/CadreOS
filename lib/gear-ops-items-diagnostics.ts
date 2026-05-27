import { type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  type DatabaseDiagnosticDependency,
  type DatabaseDiagnosticResult,
  logDatabaseDiagnostic,
} from "@/lib/db/diagnostics";
import { getGearOpsSchemaStatus } from "@/lib/gear-ops-schema-status";

type GearOpsItemsProbeDefinition = {
  key: GearOpsItemsDependencyKey;
  label: string;
  operation: string;
  dependency: DatabaseDiagnosticDependency;
  model: string;
  table: string;
  queryType: string;
  code: string;
  clientMessage: string;
  run: () => Promise<void>;
};

export type GearOpsItemsDependencyKey =
  | "itemsSchema"
  | "itemsLoad"
  | "categories"
  | "organizationScope"
  | "templates"
  | "custody"
  | "locations"
  | "audit"
  | "maintenance"
  | "consumables";

export type GearOpsItemsDependencyStatus = {
  key: GearOpsItemsDependencyKey;
  label: string;
  operation: string;
  dependency: DatabaseDiagnosticDependency;
  available: boolean;
  diagnostic: DatabaseDiagnosticResult | null;
};

export type GearOpsItemsReadiness = {
  baseSchemaAvailable: boolean;
  statuses: GearOpsItemsDependencyStatus[];
  requiredFailures: GearOpsItemsDependencyStatus[];
  optionalFailures: GearOpsItemsDependencyStatus[];
  requiredReady: boolean;
  itemsLoadAvailable: boolean;
};

type ProbeDatabaseDependencyInput = Omit<GearOpsItemsProbeDefinition, "run"> & {
  route: string;
  run: () => Promise<void>;
};

async function probeDatabaseDependency(input: ProbeDatabaseDependencyInput): Promise<GearOpsItemsDependencyStatus> {
  try {
    await input.run();
    return {
      key: input.key,
      label: input.label,
      operation: input.operation,
      dependency: input.dependency,
      available: true,
      diagnostic: null,
    };
  } catch (error) {
    const diagnostic = logDatabaseDiagnostic({
      module: "GearOps",
      route: input.route,
      operation: input.operation,
      model: input.model,
      table: input.table,
      queryType: input.queryType,
      dependency: input.dependency,
      error,
      code: input.code,
      clientMessage: input.clientMessage,
    });

    return {
      key: input.key,
      label: input.label,
      operation: input.operation,
      dependency: input.dependency,
      available: false,
      diagnostic,
    };
  }
}

export function summarizeGearOpsItemsReadiness(input: {
  baseSchemaAvailable: boolean;
  statuses: GearOpsItemsDependencyStatus[];
}): GearOpsItemsReadiness {
  const requiredFailures = input.statuses.filter((status) => status.dependency === "required" && !status.available);
  const optionalFailures = input.statuses.filter((status) => status.dependency === "optional" && !status.available);
  const itemsLoadAvailable = input.statuses.find((status) => status.key === "itemsLoad")?.available ?? false;

  return {
    baseSchemaAvailable: input.baseSchemaAvailable,
    statuses: input.statuses,
    requiredFailures,
    optionalFailures,
    requiredReady: input.baseSchemaAvailable && requiredFailures.length === 0,
    itemsLoadAvailable,
  };
}

function buildProbeDefinitions(input: { organizationId: string; route: string }): GearOpsItemsProbeDefinition[] {
  const where: Prisma.OrganizationWhereInput = { id: input.organizationId };

  return [
    {
      key: "itemsLoad",
      label: "GearOps item load",
      operation: "gearops.items.loadProbe",
      dependency: "required",
      model: "GearItem",
      table: "GearItem",
      queryType: "findMany+select+relation",
      code: "GEAROPS_ITEMS_LOAD_PROBE_FAILED",
      clientMessage: "GearOps items could not load because the item load probe failed.",
      run: async () => {
        await db.gearItem.findMany({
          where: { organizationId: input.organizationId },
          select: {
            id: true,
            name: true,
            category: { select: { id: true } },
            program: { select: { id: true } },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1,
        });
      },
    },
    {
      key: "categories",
      label: "GearOps categories",
      operation: "gearops.categories.load",
      dependency: "required",
      model: "GearCategory",
      table: "GearCategory",
      queryType: "count",
      code: "GEAROPS_SCHEMA_GEARCATEGORY_FAILED",
      clientMessage: "GearOps items could not load because the GearCategory readiness check failed.",
      run: async () => {
        await db.gearCategory.count({ where: { organizationId: input.organizationId } });
      },
    },
    {
      key: "organizationScope",
      label: "GearOps organization scope",
      operation: "gearops.organization.scope",
      dependency: "required",
      model: "Organization",
      table: "Organization",
      queryType: "count",
      code: "GEAROPS_SCHEMA_ORGANIZATION_FAILED",
      clientMessage: "GearOps items could not load because the organization scope readiness check failed.",
      run: async () => {
        await db.organization.count({ where });
      },
    },
    {
      key: "templates",
      label: "GearOps templates",
      operation: "gearops.templates.load",
      dependency: "optional",
      model: "EventGearRequirementTemplate",
      table: "EventGearRequirementTemplate",
      queryType: "count",
      code: "GEAROPS_TEMPLATES_OPTIONAL_FAILED",
      clientMessage: "GearOps loaded, but GearOps templates are unavailable.",
      run: async () => {
        await db.eventGearRequirementTemplate.count({ where: { organizationId: input.organizationId } });
      },
    },
    {
      key: "custody",
      label: "GearOps custody/check-out",
      operation: "gearops.custody.load",
      dependency: "optional",
      model: "GearCheckout",
      table: "GearCheckout",
      queryType: "count",
      code: "GEAROPS_CUSTODY_OPTIONAL_FAILED",
      clientMessage: "GearOps loaded, but custody/check-out data is unavailable.",
      run: async () => {
        await db.gearCheckout.count({ where: { organizationId: input.organizationId } });
      },
    },
    {
      key: "locations",
      label: "GearOps locations",
      operation: "gearops.locations.load",
      dependency: "optional",
      model: "InventoryLocation",
      table: "InventoryLocation",
      queryType: "count",
      code: "GEAROPS_LOCATIONS_OPTIONAL_FAILED",
      clientMessage: "GearOps loaded, but location data is unavailable.",
      run: async () => {
        await db.inventoryLocation.count({ where: { organizationId: input.organizationId } });
      },
    },
    {
      key: "audit",
      label: "GearOps audit/history",
      operation: "gearops.audit.load",
      dependency: "optional",
      model: "InventoryAudit",
      table: "InventoryAudit",
      queryType: "count",
      code: "GEAROPS_AUDIT_OPTIONAL_FAILED",
      clientMessage: "GearOps loaded, but audit/history data is unavailable.",
      run: async () => {
        await db.inventoryAudit.count({ where: { organizationId: input.organizationId } });
      },
    },
    {
      key: "maintenance",
      label: "GearOps maintenance records",
      operation: "gearops.maintenance.load",
      dependency: "optional",
      model: "GearMaintenanceLog",
      table: "GearMaintenanceLog",
      queryType: "count",
      code: "GEAROPS_MAINTENANCE_OPTIONAL_FAILED",
      clientMessage: "GearOps loaded, but maintenance records are unavailable.",
      run: async () => {
        await db.gearMaintenanceLog.count({ where: { organizationId: input.organizationId } });
      },
    },
    {
      key: "consumables",
      label: "GearOps consumable transactions",
      operation: "gearops.consumables.load",
      dependency: "optional",
      model: "ConsumableTransaction",
      table: "ConsumableTransaction",
      queryType: "count",
      code: "GEAROPS_CONSUMABLES_OPTIONAL_FAILED",
      clientMessage: "GearOps loaded, but consumable transactions are unavailable.",
      run: async () => {
        await db.consumableTransaction.count({ where: { organizationId: input.organizationId } });
      },
    },
  ];
}

export async function getGearOpsItemsReadiness(input: {
  organizationId: string;
  route?: string;
}): Promise<GearOpsItemsReadiness> {
  const route = input.route ?? "/gear-ops/items";
  let baseSchemaAvailable = false;

  try {
    const schemaStatus = await getGearOpsSchemaStatus("item-list");
    baseSchemaAvailable = schemaStatus.connected && schemaStatus.schemaReady;
  } catch (error) {
    const diagnostic = logDatabaseDiagnostic({
      module: "GearOps",
      route,
      operation: "gearops.schemaProbe",
      model: "GearItem",
      table: "GearItem",
      queryType: "raw SQL",
      dependency: "required",
      error,
      code: "GEAROPS_SCHEMA_PROBE_FAILED",
      clientMessage: "GearOps items could not load because the schema probe failed.",
    });

    return summarizeGearOpsItemsReadiness({
      baseSchemaAvailable: false,
      statuses: [
        {
          key: "itemsSchema",
          label: "GearOps base schema",
          operation: "gearops.schemaProbe",
          dependency: "required",
          available: false,
          diagnostic,
        },
      ],
    });
  }

  const schemaStatus: GearOpsItemsDependencyStatus = {
    key: "itemsSchema",
    label: "GearOps base schema",
    operation: "gearops.schemaProbe",
    dependency: "required",
    available: baseSchemaAvailable,
    diagnostic: baseSchemaAvailable
      ? null
      : {
          ok: false,
          code: "GEAROPS_SCHEMA_ITEMLIST_FAILED",
          message: "GearOps items could not load because the GearItem readiness check failed.",
          hint: "Check server logs for diagnostic code GEAROPS_SCHEMA_ITEMLIST_FAILED.",
          dependency: "required",
          operation: "gearops.schemaProbe",
          prismaCode: null,
        },
  };

  const probes = buildProbeDefinitions({ organizationId: input.organizationId, route });
  const probeStatuses = await Promise.all(
    probes.map((probe) => probeDatabaseDependency({ ...probe, route })),
  );

  return summarizeGearOpsItemsReadiness({
    baseSchemaAvailable,
    statuses: [schemaStatus, ...probeStatuses],
  });
}
