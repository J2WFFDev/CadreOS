
import {
  GearCategoryBehaviorType,
  GearCustodyMode,
  GearIdentifierType,
  GearInventoryType,
  GearMaintenanceFrequency,
  GearReportGroup,
} from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import {
  GearCategoryConfigFields,
  type GearCategoryConfigFieldErrors,
} from "@/components/gear-ops/category-config-fields";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
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

export default async function EditGearCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { categoryId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load gear category edit right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.categories.edit.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const category = await db.gearCategory.findFirst({
    where: {
      id: categoryId,
      AND: [access.categoryWhere],
    },
    select: {
      id: true,
      name: true,
      inventoryType: true,
      description: true,
      templateSlug: true,
      behaviorType: true,
      custodyMode: true,
      requiresReturnInspection: true,
      requiresMaintenanceTracking: true,
      maintenanceFrequency: true,
      maintenanceIntervalDays: true,
      primaryIdentifierType: true,
      supportsConsumableTracking: true,
      consumableLowStockDefault: true,
      supportsEventDeployment: true,
      reportGroup: true,
      reportLabel: true,
      isKitContainer: true,
      guardianApprovalRequired: true,
    },
  });

  if (!category) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Gear category not found in the selected organization scope.
          </p>
        </div>
        <BackLink href="/gear-ops/categories" label="Categories" />
      </section>
    );
  }

  const name = readSearchParam(resolvedSearchParams, "name") || category.name;
  const inventoryType = readEnumSearchParam(
    resolvedSearchParams,
    "inventoryType",
    Object.values(GearInventoryType),
    category.inventoryType,
  );
  const description = readSearchParam(resolvedSearchParams, "description") || category.description || "";
  const generalError = readSearchParam(resolvedSearchParams, "error");
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
      category.behaviorType,
    ),
    custodyMode: readEnumSearchParam(
      resolvedSearchParams,
      "custodyMode",
      Object.values(GearCustodyMode),
      category.custodyMode,
    ),
    primaryIdentifierType: readEnumSearchParam(
      resolvedSearchParams,
      "primaryIdentifierType",
      Object.values(GearIdentifierType),
      category.primaryIdentifierType,
    ),
    reportGroup: readEnumSearchParam(
      resolvedSearchParams,
      "reportGroup",
      Object.values(GearReportGroup),
      category.reportGroup,
    ),
    reportLabel: readSearchParam(resolvedSearchParams, "reportLabel") || category.reportLabel || "",
    requiresReturnInspection: readBooleanSearchParam(
      resolvedSearchParams,
      "requiresReturnInspection",
      category.requiresReturnInspection,
    ),
    requiresMaintenanceTracking: readBooleanSearchParam(
      resolvedSearchParams,
      "requiresMaintenanceTracking",
      category.requiresMaintenanceTracking,
    ),
    maintenanceFrequency: readOptionalEnumSearchParam(
      resolvedSearchParams,
      "maintenanceFrequency",
      Object.values(GearMaintenanceFrequency),
      category.maintenanceFrequency ?? "",
    ),
    maintenanceIntervalDays:
      readSearchParam(resolvedSearchParams, "maintenanceIntervalDays") || category.maintenanceIntervalDays?.toString() || "",
    supportsConsumableTracking: readBooleanSearchParam(
      resolvedSearchParams,
      "supportsConsumableTracking",
      category.supportsConsumableTracking,
    ),
    consumableLowStockDefault:
      readSearchParam(resolvedSearchParams, "consumableLowStockDefault") ||
      category.consumableLowStockDefault?.toString() ||
      "",
    supportsEventDeployment: readBooleanSearchParam(
      resolvedSearchParams,
      "supportsEventDeployment",
      category.supportsEventDeployment,
    ),
    isKitContainer: readBooleanSearchParam(resolvedSearchParams, "isKitContainer", category.isKitContainer),
    guardianApprovalRequired: readBooleanSearchParam(
      resolvedSearchParams,
      "guardianApprovalRequired",
      category.guardianApprovalRequired,
    ),
    templateSlug: readSearchParam(resolvedSearchParams, "templateSlug") || category.templateSlug || "",
  };

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/categories/${category.id}`} label={category.name} />
        <GearOpsSubnav current="categories" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form
        action={`/gear-ops/categories/${category.id}/edit/update`}
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
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

        <FormActions submitLabel="Save category" cancelHref={`/gear-ops/categories/${category.id}`} />
      </form>
    </section>
  );
}
