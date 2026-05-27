
import {
  GearCategoryBehaviorType,
  GearCustodyMode,
  GearIdentifierType,
  GearInventoryType,
  GearMaintenanceFrequency,
  GearReportGroup,
} from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  GearCategoryConfigFields,
  type GearCategoryConfigFieldErrors,
} from "@/components/gear-ops/category-config-fields";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import {
  applyGearCategoryTemplate,
  formatGearReportGroup,
  GEAR_CATEGORY_STARTER_TEMPLATES,
  getReportGroupBadgeClass,
} from "@/lib/gear-category-config";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { formatGearOpsSchemaMissingDetail, getGearOpsSchemaStatus } from "@/lib/gear-ops-schema-status";
import { resolveGearOpsAdminAccess, resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function readEnumSearchParam<T extends string>(
  searchParams: SearchParams,
  key: string,
  enumValues: readonly T[],
  fallback: T,
): T {
  const value = readSearchParam(searchParams, key);
  return enumValues.includes(value as T) ? (value as T) : fallback;
}

function readOptionalEnumSearchParam<T extends string>(
  searchParams: SearchParams,
  key: string,
  enumValues: readonly T[],
  fallback: T | "",
): T | "" {
  const value = readSearchParam(searchParams, key);
  if (!value) {
    return fallback;
  }

  return enumValues.includes(value as T) ? (value as T) : fallback;
}

function readBooleanSearchParam(searchParams: SearchParams, key: string, fallback: boolean): boolean {
  const value = readSearchParam(searchParams, key);
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function readCsvSearchParam(searchParams: SearchParams, key: string): string[] {
  const value = readSearchParam(searchParams, key);
  if (!value.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export default async function NewGearCategoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear category</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load gear category creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.categories.new.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const schemaStatus = await getGearOpsSchemaStatus("category-creation");
  const adminAccess = await resolveGearOpsAdminAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const showSchemaDiagnostics = process.env.NODE_ENV !== "production" || adminAccess.allowed;

  if (!schemaStatus.schemaReady) {
    const detail = showSchemaDiagnostics ? formatGearOpsSchemaMissingDetail(schemaStatus) : null;

    return (
      <section className="space-y-6">
        <PageHeader title="New gear category" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />
        <GearOpsSubnav current="categories" />
        <ErrorMessage
          message={
            detail
              ? `Database schema is not available yet (${detail}). Run database setup before creating gear categories.`
              : "Database schema is not available yet. Run database setup before creating gear categories."
          }
        />
        {showSchemaDiagnostics ? (
          <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
            <p className="font-medium">Missing GearOps schema elements</p>
            {schemaStatus.missingTables.length === 0 && schemaStatus.missingColumns.length === 0 ? (
              <p className="mt-2 text-zinc-700 dark:text-zinc-300">Schema verification failed, but missing elements could not be enumerated.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
                {schemaStatus.missingTables.map((table) => (
                  <li key={`table-${table}`}>Table: {table}</li>
                ))}
                {schemaStatus.missingColumns.map((column) => (
                  <li key={`column-${column}`}>Column: {column}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>
    );
  }

  const defaultTemplate = applyGearCategoryTemplate("generic-asset");
  const name = readSearchParam(resolvedSearchParams, "name");
  const inventoryType = readEnumSearchParam(
    resolvedSearchParams,
    "inventoryType",
    Object.values(GearInventoryType),
    defaultTemplate.inventoryType ?? GearInventoryType.DURABLE,
  );
  const description = readSearchParam(resolvedSearchParams, "description");
  const generalError = readSearchParam(resolvedSearchParams, "error");
  const missingTablesFromError = readCsvSearchParam(resolvedSearchParams, "missingTables");
  const missingColumnsFromError = readCsvSearchParam(resolvedSearchParams, "missingColumns");
  const configErrors: GearCategoryConfigFieldErrors = {
    behaviorType: readSearchParam(resolvedSearchParams, "behaviorTypeError"),
    custodyMode: readSearchParam(resolvedSearchParams, "custodyModeError"),
    primaryIdentifierType: readSearchParam(resolvedSearchParams, "primaryIdentifierTypeError"),
    reportGroup: readSearchParam(resolvedSearchParams, "reportGroupError"),
    reportLabel: readSearchParam(resolvedSearchParams, "reportLabelError"),
    requiresReturnInspection: readSearchParam(resolvedSearchParams, "requiresReturnInspectionError"),
    requiresMaintenanceTracking: readSearchParam(resolvedSearchParams, "requiresMaintenanceTrackingError"),
    maintenanceFrequency: readSearchParam(resolvedSearchParams, "maintenanceFrequencyError"),
    maintenanceIntervalDays: readSearchParam(resolvedSearchParams, "maintenanceIntervalDaysError"),
    supportsConsumableTracking: readSearchParam(resolvedSearchParams, "supportsConsumableTrackingError"),
    consumableLowStockDefault: readSearchParam(resolvedSearchParams, "consumableLowStockDefaultError"),
    supportsEventDeployment: readSearchParam(resolvedSearchParams, "supportsEventDeploymentError"),
    isKitContainer: readSearchParam(resolvedSearchParams, "isKitContainerError"),
    guardianApprovalRequired: readSearchParam(resolvedSearchParams, "guardianApprovalRequiredError"),
    templateSlug: readSearchParam(resolvedSearchParams, "templateSlugError"),
  };
  const configValues = {
    behaviorType: readEnumSearchParam(
      resolvedSearchParams,
      "behaviorType",
      Object.values(GearCategoryBehaviorType),
      defaultTemplate.behaviorType ?? GearCategoryBehaviorType.SHARED_GEAR,
    ),
    custodyMode: readEnumSearchParam(
      resolvedSearchParams,
      "custodyMode",
      Object.values(GearCustodyMode),
      defaultTemplate.custodyMode ?? GearCustodyMode.FREE_CHECKOUT,
    ),
    primaryIdentifierType: readEnumSearchParam(
      resolvedSearchParams,
      "primaryIdentifierType",
      Object.values(GearIdentifierType),
      defaultTemplate.primaryIdentifierType ?? GearIdentifierType.SERIAL_NUMBER,
    ),
    reportGroup: readEnumSearchParam(
      resolvedSearchParams,
      "reportGroup",
      Object.values(GearReportGroup),
      defaultTemplate.reportGroup ?? GearReportGroup.GENERAL,
    ),
    reportLabel: readSearchParam(resolvedSearchParams, "reportLabel") || defaultTemplate.reportLabel || "",
    requiresReturnInspection: readBooleanSearchParam(
      resolvedSearchParams,
      "requiresReturnInspection",
      defaultTemplate.requiresReturnInspection ?? false,
    ),
    requiresMaintenanceTracking: readBooleanSearchParam(
      resolvedSearchParams,
      "requiresMaintenanceTracking",
      defaultTemplate.requiresMaintenanceTracking ?? false,
    ),
    maintenanceFrequency: readOptionalEnumSearchParam(
      resolvedSearchParams,
      "maintenanceFrequency",
      Object.values(GearMaintenanceFrequency),
      defaultTemplate.maintenanceFrequency ?? "",
    ),
    maintenanceIntervalDays:
      readSearchParam(resolvedSearchParams, "maintenanceIntervalDays") || defaultTemplate.maintenanceIntervalDays?.toString() || "",
    supportsConsumableTracking: readBooleanSearchParam(
      resolvedSearchParams,
      "supportsConsumableTracking",
      defaultTemplate.supportsConsumableTracking ?? false,
    ),
    consumableLowStockDefault:
      readSearchParam(resolvedSearchParams, "consumableLowStockDefault") ||
      defaultTemplate.consumableLowStockDefault?.toString() ||
      "",
    supportsEventDeployment: readBooleanSearchParam(
      resolvedSearchParams,
      "supportsEventDeployment",
      defaultTemplate.supportsEventDeployment ?? true,
    ),
    isKitContainer: readBooleanSearchParam(
      resolvedSearchParams,
      "isKitContainer",
      defaultTemplate.isKitContainer ?? false,
    ),
    guardianApprovalRequired: readBooleanSearchParam(
      resolvedSearchParams,
      "guardianApprovalRequired",
      defaultTemplate.guardianApprovalRequired ?? false,
    ),
    templateSlug: readSearchParam(resolvedSearchParams, "templateSlug"),
  };

  return (
    <section className="space-y-6">
      <PageHeader title="New gear category" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />
      <GearOpsSubnav current="categories" />

      {generalError ? <ErrorMessage message={generalError} /> : null}
      {showSchemaDiagnostics && (missingTablesFromError.length > 0 || missingColumnsFromError.length > 0) ? (
        <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
          <p className="font-medium">Missing GearOps schema elements</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
            {missingTablesFromError.map((table) => (
              <li key={`missing-table-${table}`}>Table: {table}</li>
            ))}
            {missingColumnsFromError.map((column) => (
              <li key={`missing-column-${column}`}>Column: {column}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div>
          <h3 className="text-lg font-medium">Start from template</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Create a category instantly from a GearOps starter profile. You can edit the configuration after creation.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {GEAR_CATEGORY_STARTER_TEMPLATES.map((template) => (
            <article key={template.slug} className="flex h-full flex-col justify-between rounded-lg border p-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-medium">{template.displayName}</h4>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getReportGroupBadgeClass(template.defaults.reportGroup)}`}>
                    {formatGearReportGroup(template.defaults.reportGroup)}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{template.description}</p>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Inventory</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">{formatGearOpsEnum(template.defaults.inventoryType)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Custody</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">{formatGearOpsEnum(template.defaults.custodyMode)}</dd>
                  </div>
                </dl>
              </div>
              <form action="/gear-ops/categories/create" method="post" className="mt-4">
                <input type="hidden" name="name" value={template.displayName} />
                <input type="hidden" name="inventoryType" value={template.defaults.inventoryType} />
                <input type="hidden" name="description" value={template.description} />
                <input type="hidden" name="behaviorType" value={template.defaults.behaviorType} />
                <input type="hidden" name="custodyMode" value={template.defaults.custodyMode} />
                <input type="hidden" name="primaryIdentifierType" value={template.defaults.primaryIdentifierType} />
                <input type="hidden" name="reportGroup" value={template.defaults.reportGroup} />
                <input type="hidden" name="reportLabel" value={template.defaults.reportLabel ?? ""} />
                <input type="hidden" name="requiresReturnInspection" value={template.defaults.requiresReturnInspection ? "true" : "false"} />
                <input type="hidden" name="requiresMaintenanceTracking" value={template.defaults.requiresMaintenanceTracking ? "true" : "false"} />
                <input type="hidden" name="maintenanceFrequency" value={template.defaults.maintenanceFrequency ?? ""} />
                <input type="hidden" name="maintenanceIntervalDays" value={template.defaults.maintenanceIntervalDays?.toString() ?? ""} />
                <input type="hidden" name="supportsConsumableTracking" value={template.defaults.supportsConsumableTracking ? "true" : "false"} />
                <input type="hidden" name="consumableLowStockDefault" value={template.defaults.consumableLowStockDefault?.toString() ?? ""} />
                <input type="hidden" name="supportsEventDeployment" value={template.defaults.supportsEventDeployment ? "true" : "false"} />
                <input type="hidden" name="isKitContainer" value={template.defaults.isKitContainer ? "true" : "false"} />
                <input type="hidden" name="guardianApprovalRequired" value={template.defaults.guardianApprovalRequired ? "true" : "false"} />
                <input type="hidden" name="templateSlug" value={template.slug} />
                <button
                  type="submit"
                  className="w-full rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
                >
                  Use template
                </button>
              </form>
            </article>
          ))}
        </div>
      </div>

      <form
        action="/gear-ops/categories/create"
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div>
          <h3 className="text-lg font-medium">Create manually</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Define a custom GearOps category from scratch.</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Category name
          </label>
          <input id="name" name="name" defaultValue={name} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "nameError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "nameError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="inventoryType" className="text-sm font-medium">
            Inventory type
          </label>
          <select
            id="inventoryType"
            name="inventoryType"
            defaultValue={inventoryType}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(GearInventoryType).map((type) => (
              <option key={type} value={type}>
                {formatGearOpsEnum(type)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "inventoryTypeError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "inventoryTypeError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={description}
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "descriptionError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "descriptionError")}</p>
          ) : null}
        </div>

        <GearCategoryConfigFields values={configValues} errors={configErrors} />

        <FormActions submitLabel="Create category" cancelHref="/gear-ops/categories" />
      </form>
    </section>
  );
}
