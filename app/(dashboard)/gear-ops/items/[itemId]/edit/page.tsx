import { GearConditionStatus, GearInventoryType, GearItemLifecycleStatus } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
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

export default async function EditGearItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { itemId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear item</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load gear item edit right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.edit.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let item: {
    id: string;
    name: string;
    inventoryType: GearInventoryType;
    lifecycleStatus: GearItemLifecycleStatus;
    conditionStatus: GearConditionStatus | null;
    sku: string | null;
    serialNumber: string | null;
    barcodeValue: string | null;
    quantityOnHand: number;
    quantityMin: number | null;
    notes: string | null;
    gearCategoryId: string;
    programId: string | null;
  } | null = null;
  let categories: Array<{ id: string; name: string; inventoryType: GearInventoryType }> | null = null;
  let programs: Array<{ id: string; name: string }> | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load gear item edit right now. Please try again later.";

  try {
    [item, categories, programs] = await Promise.all([
      db.gearItem.findFirst({
        where: {
          id: itemId,
          AND: [access.where],
        },
        select: {
          id: true,
          name: true,
          inventoryType: true,
          lifecycleStatus: true,
          conditionStatus: true,
          sku: true,
          serialNumber: true,
          barcodeValue: true,
          quantityOnHand: true,
          quantityMin: true,
          notes: true,
          gearCategoryId: true,
          programId: true,
        },
      }),
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
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before editing gear items.";
    }
  }

  if (queryFailed || !categories || !programs) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear item</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!item) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Gear item not found in the selected organization scope.
          </p>
        </div>
        <BackLink href="/gear-ops/items" label="Items" />
      </section>
    );
  }

  const name = readSearchParam(resolvedSearchParams, "name") || item.name;
  const gearCategoryId = readSearchParam(resolvedSearchParams, "gearCategoryId") || item.gearCategoryId;
  const inventoryType = readSearchParam(resolvedSearchParams, "inventoryType") || item.inventoryType;
  const programId = readSearchParam(resolvedSearchParams, "programId") ?? item.programId ?? "";
  const sku = readSearchParam(resolvedSearchParams, "sku") ?? item.sku ?? "";
  const serialNumber = readSearchParam(resolvedSearchParams, "serialNumber") ?? item.serialNumber ?? "";
  const barcodeValue = readSearchParam(resolvedSearchParams, "barcodeValue") ?? item.barcodeValue ?? "";
  const quantityOnHand =
    readSearchParam(resolvedSearchParams, "quantityOnHand") || String(item.quantityOnHand);
  const quantityMin =
    readSearchParam(resolvedSearchParams, "quantityMin") ?? (item.quantityMin !== null ? String(item.quantityMin) : "");
  const lifecycleStatus = readSearchParam(resolvedSearchParams, "lifecycleStatus") || item.lifecycleStatus;
  const conditionStatus = readSearchParam(resolvedSearchParams, "conditionStatus") ?? item.conditionStatus ?? "";
  const notes = readSearchParam(resolvedSearchParams, "notes") ?? item.notes ?? "";
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
        <GearOpsSubnav current="items" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear item</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form
        action={`/gear-ops/items/${item.id}/edit/update`}
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="lifecycleStatus" className="text-sm font-medium">
              Lifecycle status
            </label>
            <select
              id="lifecycleStatus"
              name="lifecycleStatus"
              defaultValue={lifecycleStatus}
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
              defaultValue={quantityOnHand}
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

        <FormActions submitLabel="Save gear item" cancelHref={`/gear-ops/items/${item.id}`} />
      </form>
    </section>
  );
}
