import { GearCheckoutStatus, GearConditionStatus } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsDateTime, formatGearOpsEnum } from "@/lib/gear-ops";
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

export default async function EditGearCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string; checkoutId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { itemId, checkoutId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit checkout</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load checkout edit right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit checkout</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.checkouts.edit.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit checkout</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let item: { id: string; name: string } | null = null;
  let checkout: {
    id: string;
    status: GearCheckoutStatus;
    checkedOutById: string;
    issuedById: string;
    eventId: string | null;
    checkedOutAt: Date;
    expectedReturnAt: Date | null;
    returnedAt: Date | null;
    returnedById: string | null;
    receivedById: string | null;
    conditionOnReturn: GearConditionStatus | null;
    purposeNotes: string | null;
    returnNotes: string | null;
    checkedOutBy: { id: string; firstName: string; lastName: string };
    issuedBy: { id: string; firstName: string; lastName: string };
  } | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> | null = null;
  let events: Array<{ id: string; title: string }> | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load checkout edit right now. Please try again later.";

  try {
    [item, checkout, people, events] = await Promise.all([
      db.gearItem.findFirst({
        where: { id: itemId, AND: [access.where] },
        select: { id: true, name: true },
      }),
      db.gearCheckout.findFirst({
        where: { id: checkoutId, gearItemId: itemId, organizationId: scope.organizationId },
        select: {
          id: true,
          status: true,
          checkedOutById: true,
          issuedById: true,
          eventId: true,
          checkedOutAt: true,
          expectedReturnAt: true,
          returnedAt: true,
          returnedById: true,
          receivedById: true,
          conditionOnReturn: true,
          purposeNotes: true,
          returnNotes: true,
          checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
          issuedBy: { select: { id: true, firstName: true, lastName: true } },
        },
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
      queryErrorMessage = "Database schema is not available yet. Run database setup before editing checkouts.";
    }
  }

  if (queryFailed || !people || !events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit checkout</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!item) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit checkout</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Gear item not found in the selected organization scope.</p>
        </div>
        <BackLink href="/gear-ops/items" label="Items" />
      </section>
    );
  }

  if (!checkout) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit checkout</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Checkout not found for this gear item.</p>
        </div>
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
      </section>
    );
  }

  const status = readSearchParam(resolvedSearchParams, "status") || checkout.status;
  const checkedOutById = readSearchParam(resolvedSearchParams, "checkedOutById") || checkout.checkedOutById;
  const issuedById = readSearchParam(resolvedSearchParams, "issuedById") || checkout.issuedById;
  const eventId = readSearchParam(resolvedSearchParams, "eventId") || checkout.eventId || "";
  const checkedOutAt =
    readSearchParam(resolvedSearchParams, "checkedOutAt") || formatDateTimeInputValue(checkout.checkedOutAt);
  const expectedReturnAt =
    readSearchParam(resolvedSearchParams, "expectedReturnAt") || formatDateTimeInputValue(checkout.expectedReturnAt);
  const returnedAt =
    readSearchParam(resolvedSearchParams, "returnedAt") || formatDateTimeInputValue(checkout.returnedAt);
  const returnedById = readSearchParam(resolvedSearchParams, "returnedById") || checkout.returnedById || "";
  const receivedById = readSearchParam(resolvedSearchParams, "receivedById") || checkout.receivedById || "";
  const conditionOnReturn = readSearchParam(resolvedSearchParams, "conditionOnReturn") || checkout.conditionOnReturn || "";
  const purposeNotes = readSearchParam(resolvedSearchParams, "purposeNotes") || checkout.purposeNotes || "";
  const returnNotes = readSearchParam(resolvedSearchParams, "returnNotes") || checkout.returnNotes || "";
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
        <GearOpsSubnav current="items" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit checkout</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Item: {item.name} · Checked out {formatGearOpsDateTime(checkout.checkedOutAt)} by {checkout.checkedOutBy.firstName}{" "}
          {checkout.checkedOutBy.lastName} · Issued by {checkout.issuedBy.firstName} {checkout.issuedBy.lastName}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form
        action={`/gear-ops/items/${item.id}/checkouts/${checkout.id}/edit/update`}
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
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

        <FormActions submitLabel="Save checkout" cancelHref={`/gear-ops/items/${item.id}`} />
      </form>
    </section>
  );
}
