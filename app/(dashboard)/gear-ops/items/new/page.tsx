import { GearConditionStatus, GearInventoryType, GearItemLifecycleStatus } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function NewGearItemPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear item</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load gear item creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.new.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let categories: Array<{ id: string; name: string; inventoryType: GearInventoryType }> | null = null;
  let programs: Array<{ id: string; name: string }> | null = null;
  let queryErrorMessage = "Unable to load gear item creation options right now. Please try again later.";

  try {
    [categories, programs] = await Promise.all([
      db.gearCategory.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true, inventoryType: true },
        orderBy: [{ name: "asc" }],
      }),
      db.program.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
    ]);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before creating gear items.";
    }
  }

  if (!categories || !programs) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear item</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (categories.length === 0) {
    return (
      <section className="space-y-4">
        <PageHeader title="New gear item" description="Create a new gear inventory item." />
        <GearOpsSubnav current="items" />
        <EmptyState
          message="At least one gear category must exist before creating gear items."
          actionHref="/gear-ops/categories/new"
          actionLabel="Create a category"
        />
      </section>
    );
  }

  const gearCategoryId = readSearchParam(resolvedSearchParams, "gearCategoryId");
  const name = readSearchParam(resolvedSearchParams, "name");
  const inventoryType = readSearchParam(resolvedSearchParams, "inventoryType");
  const programId = readSearchParam(resolvedSearchParams, "programId");
  const sku = readSearchParam(resolvedSearchParams, "sku");
  const serialNumber = readSearchParam(resolvedSearchParams, "serialNumber");
  const barcodeValue = readSearchParam(resolvedSearchParams, "barcodeValue");
  const quantityOnHand = readSearchParam(resolvedSearchParams, "quantityOnHand");
  const quantityMin = readSearchParam(resolvedSearchParams, "quantityMin");
  const lifecycleStatus = readSearchParam(resolvedSearchParams, "lifecycleStatus");
  const conditionStatus = readSearchParam(resolvedSearchParams, "conditionStatus");
  const notes = readSearchParam(resolvedSearchParams, "notes");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <PageHeader title="New gear item" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />
      <GearOpsSubnav current="items" />

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form
        action="/gear-ops/items/create"
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Item name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "nameError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "nameError")}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="gearCategoryId" className="text-sm font-medium">
              Category
            </label>
            <select
              id="gearCategoryId"
              name="gearCategoryId"
              defaultValue={gearCategoryId}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} — {formatGearOpsEnum(category.inventoryType)}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "gearCategoryIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "gearCategoryIdError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="inventoryType" className="text-sm font-medium">
              Inventory type
            </label>
            <select
              id="inventoryType"
              name="inventoryType"
              defaultValue={inventoryType || GearInventoryType.DURABLE}
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="lifecycleStatus" className="text-sm font-medium">
              Lifecycle status
            </label>
            <select
              id="lifecycleStatus"
              name="lifecycleStatus"
              defaultValue={lifecycleStatus || GearItemLifecycleStatus.ACTIVE}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {Object.values(GearItemLifecycleStatus).map((status) => (
                <option key={status} value={status}>
                  {formatGearOpsEnum(status)}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "lifecycleStatusError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "lifecycleStatusError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="conditionStatus" className="text-sm font-medium">
              Condition status <span className="text-zinc-500">(durable items)</span>
            </label>
            <select
              id="conditionStatus"
              name="conditionStatus"
              defaultValue={conditionStatus}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No condition recorded</option>
              {Object.values(GearConditionStatus).map((status) => (
                <option key={status} value={status}>
                  {formatGearOpsEnum(status)}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "conditionStatusError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "conditionStatusError")}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="programId" className="text-sm font-medium">
            Program context (optional)
          </label>
          <select
            id="programId"
            name="programId"
            defaultValue={programId}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">No program context</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "programIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "programIdError")}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="sku" className="text-sm font-medium">
              SKU (optional)
            </label>
            <input
              id="sku"
              name="sku"
              defaultValue={sku}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "skuError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "skuError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="serialNumber" className="text-sm font-medium">
              Serial number <span className="text-zinc-500">(durable items)</span>
            </label>
            <input
              id="serialNumber"
              name="serialNumber"
              defaultValue={serialNumber}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "serialNumberError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "serialNumberError")}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="barcodeValue" className="text-sm font-medium">
              Barcode / QR value (optional)
            </label>
            <input
              id="barcodeValue"
              name="barcodeValue"
              defaultValue={barcodeValue}
              className="w-full rounded-md border px-3 py-2 text-sm font-mono"
            />
            {readSearchParam(resolvedSearchParams, "barcodeValueError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "barcodeValueError")}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="quantityOnHand" className="text-sm font-medium">
              Quantity on hand
            </label>
            <input
              id="quantityOnHand"
              name="quantityOnHand"
              type="number"
              min="0"
              step="1"
              defaultValue={quantityOnHand || "0"}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "quantityOnHandError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "quantityOnHandError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="quantityMin" className="text-sm font-medium">
              Minimum stock quantity <span className="text-zinc-500">(consumable items)</span>
            </label>
            <input
              id="quantityMin"
              name="quantityMin"
              type="number"
              min="0"
              step="1"
              defaultValue={quantityMin}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "quantityMinError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "quantityMinError")}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={notes}
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "notesError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "notesError")}</p>
          ) : null}
        </div>

        <FormActions submitLabel="Create gear item" cancelHref="/gear-ops/items" />
      </form>
    </section>
  );
}
