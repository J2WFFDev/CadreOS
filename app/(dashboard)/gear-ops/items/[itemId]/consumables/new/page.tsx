import { ConsumableTransactionType, GearInventoryType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { GearOfflineForm } from "@/components/gear-ops/offline-form";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { formatDateTimeInputValue, isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function NewConsumableTransactionPage({
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
        <h2 className="text-2xl font-semibold tracking-tight">New consumable transaction</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load consumable transaction form right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New consumable transaction</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.consumables.new.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New consumable transaction</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let item: { id: string; name: string; inventoryType: GearInventoryType } | null = null;
  let events: Array<{ id: string; title: string }> | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load consumable transaction form right now. Please try again later.";

  try {
    [item, events] = await Promise.all([
      db.gearItem.findFirst({
        where: { id: itemId, AND: [access.where] },
        select: { id: true, name: true, inventoryType: true },
      }),
      db.event.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, title: true },
        orderBy: [{ startsAt: "desc" }],
        take: 50,
      }),
    ]);
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage =
        "Database schema is not available yet. Run database setup before creating consumable transactions.";
    }
  }

  if (queryFailed || !events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New consumable transaction</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!item) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New consumable transaction</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Gear item not found in the selected organization scope.</p>
        </div>
        <BackLink href="/gear-ops/items" label="Items" />
      </section>
    );
  }

  if (item.inventoryType !== GearInventoryType.CONSUMABLE) {
    return (
      <section className="space-y-4">
        <div className="space-y-3">
          <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
          <GearOpsSubnav current="items" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">New consumable transaction</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Consumable transactions only apply to items marked as CONSUMABLE.
          </p>
        </div>
      </section>
    );
  }

  const transactionType =
    readSearchParam(resolvedSearchParams, "transactionType") || ConsumableTransactionType.RECEIVED;
  const quantityDelta = readSearchParam(resolvedSearchParams, "quantityDelta");
  const recordedAt = readSearchParam(resolvedSearchParams, "recordedAt") || formatDateTimeInputValue(new Date());
  const eventId = readSearchParam(resolvedSearchParams, "eventId");
  const notes = readSearchParam(resolvedSearchParams, "notes");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
        <GearOpsSubnav current="items" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">New consumable transaction</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Item: {item.name} · Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <GearOfflineForm
        action={`/gear-ops/items/${item.id}/consumables/create`}
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
        actionType="gear.consumable.create"
        subjectType="GEAR_ITEM"
        subjectId={item.id}
        subjectLabel={item.name}
        permissionKey="gearConsumableTransaction.create"
        returnHref={`/gear-ops/items/${item.id}`}
        queueLabel={`Consumable adjustment · ${item.name}`}
      >
        <div className="space-y-1">
          <label htmlFor="transactionType" className="text-sm font-medium">
            Transaction type
          </label>
          <select
            id="transactionType"
            name="transactionType"
            defaultValue={transactionType}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(ConsumableTransactionType).map((entry) => (
              <option key={entry} value={entry}>
                {formatGearOpsEnum(entry)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "transactionTypeError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "transactionTypeError")}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="quantityDelta" className="text-sm font-medium">
              Quantity delta (units)
            </label>
            <input
              id="quantityDelta"
              name="quantityDelta"
              type="number"
              step={1}
              defaultValue={quantityDelta}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              RECEIVED should be positive. USED, DISTRIBUTED, and DISPOSED should be negative. ADJUSTED may be either.
            </p>
            {readSearchParam(resolvedSearchParams, "quantityDeltaError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "quantityDeltaError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="recordedAt" className="text-sm font-medium">
              Recorded date/time
            </label>
            <input
              id="recordedAt"
              name="recordedAt"
              type="datetime-local"
              defaultValue={recordedAt}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "recordedAtError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "recordedAtError")}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="eventId" className="text-sm font-medium">
            Event context (optional)
          </label>
          <select id="eventId" name="eventId" defaultValue={eventId} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">No event context</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "eventIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "eventIdError")}</p>
          ) : null}
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

        <FormActions submitLabel="Create transaction" cancelHref={`/gear-ops/items/${item.id}`} />
      </GearOfflineForm>
    </section>
  );
}
