import { GearCheckoutStatus, GearConditionStatus } from "@prisma/client";

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

export default async function CheckoutGearItemPage({
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
        <h2 className="text-2xl font-semibold tracking-tight">Check out gear item</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load checkout form right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Check out gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.checkout.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Check out gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let item: { id: string; name: string } | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> | null = null;
  let events: Array<{ id: string; title: string }> | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load checkout form right now. Please try again later.";

  try {
    [item, people, events] = await Promise.all([
      db.gearItem.findFirst({
        where: { id: itemId, AND: [access.where] },
        select: { id: true, name: true },
      }),
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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
      queryErrorMessage = "Database schema is not available yet. Run database setup before checking out gear items.";
    }
  }

  if (queryFailed || !people || !events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Check out gear item</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!item) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Check out gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Gear item not found in the selected organization scope.</p>
        </div>
        <BackLink href="/gear-ops/items" label="Items" />
      </section>
    );
  }

  const status = readSearchParam(resolvedSearchParams, "status") || GearCheckoutStatus.OPEN;
  const checkedOutById = readSearchParam(resolvedSearchParams, "checkedOutById");
  const issuedById = readSearchParam(resolvedSearchParams, "issuedById");
  const eventId = readSearchParam(resolvedSearchParams, "eventId");
  const checkedOutAt = readSearchParam(resolvedSearchParams, "checkedOutAt") || formatDateTimeInputValue(new Date());
  const expectedReturnAt = readSearchParam(resolvedSearchParams, "expectedReturnAt");
  const returnedAt = readSearchParam(resolvedSearchParams, "returnedAt");
  const returnedById = readSearchParam(resolvedSearchParams, "returnedById");
  const receivedById = readSearchParam(resolvedSearchParams, "receivedById");
  const conditionOnReturn = readSearchParam(resolvedSearchParams, "conditionOnReturn");
  const purposeNotes = readSearchParam(resolvedSearchParams, "purposeNotes");
  const returnNotes = readSearchParam(resolvedSearchParams, "returnNotes");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
        <GearOpsSubnav current="items" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Check out gear item</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Item: {item.name} · Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <GearOfflineForm
        action={`/gear-ops/items/${item.id}/checkout/create`}
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
        actionType="gear.checkout.create"
        subjectType="GEAR_ITEM"
        subjectId={item.id}
        subjectLabel={item.name}
        permissionKey="gearCheckout.create"
        returnHref={`/gear-ops/items/${item.id}`}
        queueLabel={`Gear check-out · ${item.name}`}
      >
        <div className="space-y-1">
          <label htmlFor="status" className="text-sm font-medium">
            Checkout status
          </label>
          <select id="status" name="status" defaultValue={status} className="w-full rounded-md border px-3 py-2 text-sm">
            {Object.values(GearCheckoutStatus).map((s) => (
              <option key={s} value={s}>
                {formatGearOpsEnum(s)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "statusError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "statusError")}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="checkedOutById" className="text-sm font-medium">
              Checked out to person
            </label>
            <select
              id="checkedOutById"
              name="checkedOutById"
              defaultValue={checkedOutById}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.lastName}, {person.firstName}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "checkedOutByIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "checkedOutByIdError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="issuedById" className="text-sm font-medium">
              Issued by person
            </label>
            <select id="issuedById" name="issuedById" defaultValue={issuedById} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Select issuer</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.lastName}, {person.firstName}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "issuedByIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "issuedByIdError")}</p>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="checkedOutAt" className="text-sm font-medium">
              Checked out at
            </label>
            <input
              id="checkedOutAt"
              name="checkedOutAt"
              type="datetime-local"
              defaultValue={checkedOutAt}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "checkedOutAtError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "checkedOutAtError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="expectedReturnAt" className="text-sm font-medium">
              Expected return (optional)
            </label>
            <input
              id="expectedReturnAt"
              name="expectedReturnAt"
              type="datetime-local"
              defaultValue={expectedReturnAt}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "expectedReturnAtError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "expectedReturnAtError")}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="returnedAt" className="text-sm font-medium">
              Returned at (check-in)
            </label>
            <input
              id="returnedAt"
              name="returnedAt"
              type="datetime-local"
              defaultValue={returnedAt}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "returnedAtError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "returnedAtError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="conditionOnReturn" className="text-sm font-medium">
              Condition on return
            </label>
            <select
              id="conditionOnReturn"
              name="conditionOnReturn"
              defaultValue={conditionOnReturn}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No condition recorded</option>
              {Object.values(GearConditionStatus).map((condition) => (
                <option key={condition} value={condition}>
                  {formatGearOpsEnum(condition)}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "conditionOnReturnError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "conditionOnReturnError")}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="returnedById" className="text-sm font-medium">
              Returned by person (check-in)
            </label>
            <select
              id="returnedById"
              name="returnedById"
              defaultValue={returnedById}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No return person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.lastName}, {person.firstName}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "returnedByIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "returnedByIdError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="receivedById" className="text-sm font-medium">
              Received by person (check-in)
            </label>
            <select
              id="receivedById"
              name="receivedById"
              defaultValue={receivedById}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No receiving person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.lastName}, {person.firstName}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "receivedByIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "receivedByIdError")}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="purposeNotes" className="text-sm font-medium">
            Purpose notes (optional)
          </label>
          <textarea
            id="purposeNotes"
            name="purposeNotes"
            defaultValue={purposeNotes}
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "purposeNotesError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "purposeNotesError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="returnNotes" className="text-sm font-medium">
            Return notes (optional)
          </label>
          <textarea
            id="returnNotes"
            name="returnNotes"
            defaultValue={returnNotes}
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "returnNotesError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "returnNotesError")}</p>
          ) : null}
        </div>

        <FormActions submitLabel="Create checkout" cancelHref={`/gear-ops/items/${item.id}`} />
      </GearOfflineForm>
    </section>
  );
}
