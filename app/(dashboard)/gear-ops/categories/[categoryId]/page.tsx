
import {
  ConsumableTransactionType,
  GearAssignmentStatus,
  GearCategoryBehaviorType,
  GearCheckoutStatus,
  GearConditionStatus,
  GearCustodyMode,
  GearIdentifierType,
  GearItemLifecycleStatus,
  type GearInventoryType,
  GearReportGroup,
} from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import {
  formatGearCategoryBehavior,
  formatGearCustodyMode,
  formatGearIdentifierType,
  formatGearReportGroup,
  getReportGroupBadgeClass,
} from "@/lib/gear-category-config";
import { formatGearOpsEnum, getGearLifecycleBadgeClass } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function formatOptionalNumber(value: number | null) {
  return value === null ? "—" : value.toString();
}

function formatOptionalText(value: string | null) {
  return value && value.length > 0 ? value : "—";
}

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function coerceEnumValue<T extends string>(value: string, enumValues: Record<string, T>, fallback: T): T {
  return Object.values(enumValues).includes(value as T) ? (value as T) : fallback;
}

function formatFieldOptions(fieldKey: string, value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    const parsed = JSON.parse(value) as string[];
    return parsed.join(", ");
  } catch (error) {
    console.warn(`Unable to parse gear category field options for ${fieldKey}`, error);
    return value;
  }
}

export default async function GearOpsCategoryDetailsPage({
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
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query gear category details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.categories.detail.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let category:
    | {
        id: string;
        name: string;
        description: string | null;
        inventoryType: GearInventoryType;
        templateSlug: string | null;
        behaviorType: string;
        custodyMode: string;
        requiresReturnInspection: boolean;
        requiresMaintenanceTracking: boolean;
        maintenanceFrequency: string | null;
        maintenanceIntervalDays: number | null;
        primaryIdentifierType: string;
        supportsConsumableTracking: boolean;
        consumableLowStockDefault: number | null;
        supportsEventDeployment: boolean;
        reportGroup: string;
        reportLabel: string | null;
        isKitContainer: boolean;
        guardianApprovalRequired: boolean;
        categoryFields: Array<{
          id: string;
          fieldKey: string;
          fieldLabel: string;
          fieldType: string;
          fieldOptions: string | null;
          required: boolean;
          displayOrder: number;
        }>;
      }
    | null = null;
  let items:
    | Array<{
        id: string;
        name: string;
        inventoryType: GearInventoryType;
        lifecycleStatus: GearItemLifecycleStatus;
        conditionStatus: GearConditionStatus | null;
        quantityOnHand: number;
        quantityMin: number | null;
      }>
    | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load GearOps category details right now. Please try again later.";

  try {
    [category, items] = await Promise.all([
      db.gearCategory.findFirst({
        where: {
          id: categoryId,
          AND: [access.categoryWhere],
        },
        select: {
          id: true,
          name: true,
          description: true,
          inventoryType: true,
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
          categoryFields: {
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              fieldKey: true,
              fieldLabel: true,
              fieldType: true,
              fieldOptions: true,
              required: true,
              displayOrder: true,
            },
          },
        },
      }),
      db.gearItem.findMany({
        where: {
          gearCategoryId: categoryId,
          AND: [access.where],
        },
        select: {
          id: true,
          name: true,
          inventoryType: true,
          lifecycleStatus: true,
          conditionStatus: true,
          quantityOnHand: true,
          quantityMin: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      }),
    ]);
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading GearOps category details.";
    }
  }

  if (queryFailed || !items) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!category) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Category not found in the selected organization scope.</p>
        </div>
      </section>
    );
  }

  const activeItemCount = items.filter((item) => item.lifecycleStatus === GearItemLifecycleStatus.ACTIVE).length;
  const maintenanceLifecycleItemCount = items.filter(
    (item) => item.lifecycleStatus === GearItemLifecycleStatus.MAINTENANCE,
  ).length;
  const conditionConcernCount = items.filter(
    (item) => item.conditionStatus === GearConditionStatus.POOR || item.conditionStatus === GearConditionStatus.DAMAGED,
  ).length;
  const lowAvailabilityConsumables = items.filter(
    (item) =>
      item.inventoryType === "CONSUMABLE" &&
      item.quantityMin !== null &&
      item.quantityOnHand <= item.quantityMin,
  );
  const categoryItemIds = items.map((item) => item.id);
  const now = new Date();
  const [activeAssignmentCount, openCheckoutCount, netUsageAggregate30d, netReplenishmentAggregate30d] =
    categoryItemIds.length === 0
      ? [0, 0, { _sum: { quantityDelta: 0 } }, { _sum: { quantityDelta: 0 } }]
      : await Promise.all([
          db.gearAssignment.count({
            where: {
              organizationId: scope.organizationId,
              gearItemId: { in: categoryItemIds },
              status: { in: [GearAssignmentStatus.PENDING, GearAssignmentStatus.ACTIVE, GearAssignmentStatus.OVERDUE] },
            },
          }),
          db.gearCheckout.count({
            where: {
              organizationId: scope.organizationId,
              gearItemId: { in: categoryItemIds },
              status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] },
            },
          }),
          db.consumableTransaction.aggregate({
            where: {
              organizationId: scope.organizationId,
              gearItemId: { in: categoryItemIds },
              recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
              transactionType: {
                in: [
                  ConsumableTransactionType.USED,
                  ConsumableTransactionType.DISTRIBUTED,
                  ConsumableTransactionType.DISPOSED,
                ],
              },
            },
            _sum: { quantityDelta: true },
          }),
          db.consumableTransaction.aggregate({
            where: {
              organizationId: scope.organizationId,
              gearItemId: { in: categoryItemIds },
              recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
              transactionType: {
                in: [ConsumableTransactionType.RECEIVED],
              },
            },
            _sum: { quantityDelta: true },
          }),
        ]);
  const usageUnits30d = Math.abs(netUsageAggregate30d._sum.quantityDelta ?? 0);
  const replenishmentUnits30d = Math.max(netReplenishmentAggregate30d._sum.quantityDelta ?? 0, 0);
  const netDelta30d = replenishmentUnits30d - usageUnits30d;
  const readinessConcerns = maintenanceLifecycleItemCount + conditionConcernCount + lowAvailabilityConsumables.length + openCheckoutCount;
  const categoryBehaviorType = coerceEnumValue(
    category.behaviorType,
    GearCategoryBehaviorType,
    GearCategoryBehaviorType.SHARED_GEAR,
  );
  const categoryCustodyMode = coerceEnumValue(category.custodyMode, GearCustodyMode, GearCustodyMode.FREE_CHECKOUT);
  const categoryPrimaryIdentifierType = coerceEnumValue(
    category.primaryIdentifierType,
    GearIdentifierType,
    GearIdentifierType.SERIAL_NUMBER,
  );
  const categoryReportGroup = coerceEnumValue(category.reportGroup, GearReportGroup, GearReportGroup.GENERAL);

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <BackLink href="/gear-ops/categories" label="Categories" />
        <GearOpsSubnav current="categories" />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{category.name}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getReportGroupBadgeClass(categoryReportGroup)}`}>
                {formatGearReportGroup(categoryReportGroup)}
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {category.description ?? "No category description has been recorded yet."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {formatGearOpsEnum(category.inventoryType)}
            </span>
            <Link
              href={`/gear-ops/categories/${category.id}/edit`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>

      {readSearchParam(resolvedSearchParams, "fieldError") ? (
        <ErrorMessage message={readSearchParam(resolvedSearchParams, "fieldError")} />
      ) : null}
      {readSearchParam(resolvedSearchParams, "fieldSaved") ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Custom field saved.
        </div>
      ) : null}
      {readSearchParam(resolvedSearchParams, "fieldDeleted") ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Custom field removed.
        </div>
      ) : null}

      <dl className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Active items</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{activeItemCount}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Linked items</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{items.length}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Active assignments / open checkouts</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {activeAssignmentCount} / {openCheckoutCount}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Maintenance lifecycle items</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{maintenanceLifecycleItemCount}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Condition concerns</dt>
          <dd className={conditionConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
            {conditionConcernCount}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Low-availability consumables</dt>
          <dd className={lowAvailabilityConsumables.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
            {lowAvailabilityConsumables.length}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Consumable net delta (30d)</dt>
          <dd className={netDelta30d < 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
            {netDelta30d > 0 ? "+" : ""}
            {netDelta30d} (usage {usageUnits30d} / replenishment {replenishmentUnits30d})
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Readiness concerns</dt>
          <dd className={readinessConcerns > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
            {readinessConcerns}
          </dd>
        </div>
      </dl>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-medium">Category configuration</h3>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Template slug: {category.templateSlug ?? "Custom"}
          </span>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Behavior type</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatGearCategoryBehavior(categoryBehaviorType)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Custody mode</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatGearCustodyMode(categoryCustodyMode)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Primary identifier</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatGearIdentifierType(categoryPrimaryIdentifierType)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Report label</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatOptionalText(category.reportLabel)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Requires return inspection</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatBoolean(category.requiresReturnInspection)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Maintenance tracking</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatBoolean(category.requiresMaintenanceTracking)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Maintenance frequency</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{category.maintenanceFrequency ? formatGearOpsEnum(category.maintenanceFrequency) : "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Maintenance interval days</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatOptionalNumber(category.maintenanceIntervalDays)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Consumable tracking</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatBoolean(category.supportsConsumableTracking)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Low stock default</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatOptionalNumber(category.consumableLowStockDefault)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Supports event deployment</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatBoolean(category.supportsEventDeployment)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Kit container</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatBoolean(category.isKitContainer)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">Guardian approval required</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatBoolean(category.guardianApprovalRequired)}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div>
          <h3 className="text-lg font-medium">Custom fields</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Optional typed metadata fields that can be attached to items in this category.
          </p>
        </div>

        {category.categoryFields.length === 0 ? (
          <EmptyState message="No custom fields are configured for this category yet." />
        ) : (
          <div className="space-y-3">
            {category.categoryFields.map((field) => (
              <article key={field.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-base font-medium">{field.fieldLabel}</h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="font-mono">{field.fieldKey}</span> · {field.fieldType} · order {field.displayOrder}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Required: {formatBoolean(field.required)} · Options: {formatFieldOptions(field.fieldKey, field.fieldOptions)}
                    </p>
                  </div>
                  <form action={`/gear-ops/categories/${category.id}/fields/${field.id}/delete`} method="post">
                    <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Delete
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}

        <form action={`/gear-ops/categories/${category.id}/fields/create`} method="post" className="space-y-4 rounded-lg border p-4">
          <div>
            <h4 className="text-base font-medium">Add field</h4>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="fieldKey" className="text-sm font-medium">
                Field key
              </label>
              <input id="fieldKey" name="fieldKey" className="w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label htmlFor="fieldLabel" className="text-sm font-medium">
                Field label
              </label>
              <input id="fieldLabel" name="fieldLabel" className="w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label htmlFor="fieldType" className="text-sm font-medium">
                Field type
              </label>
              <select id="fieldType" name="fieldType" defaultValue="text" className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="boolean">Boolean</option>
                <option value="select">Select</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="displayOrder" className="text-sm font-medium">
                Display order
              </label>
              <input id="displayOrder" name="displayOrder" type="number" min="0" max="99" defaultValue="0" className="w-full rounded-md border px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="fieldOptions" className="text-sm font-medium">
              Select options (comma-separated)
            </label>
            <input id="fieldOptions" name="fieldOptions" className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="required" value="false" />
            <input type="checkbox" name="required" value="true" />
            Required field
          </label>
          <div className="flex justify-end">
            <button type="submit" className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">
              Add field
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Linked items</h3>
        {items.length === 0 ? (
          <EmptyState message="No linked items are currently visible for this category." />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-medium">
                      <Link href={`/gear-ops/items/${item.id}`} className="underline">
                        {item.name}
                      </Link>
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{formatGearOpsEnum(item.inventoryType)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getGearLifecycleBadgeClass(item.lifecycleStatus)}`}>
                    {formatGearOpsEnum(item.lifecycleStatus)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
