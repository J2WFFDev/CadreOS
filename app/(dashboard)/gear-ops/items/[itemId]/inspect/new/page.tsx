import { GearInspectionContext, GearItemInspectionResult } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
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

export default async function NewGearInspectionPage({
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
        <h2 className="text-2xl font-semibold tracking-tight">New inspection record</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load inspection form right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New inspection record</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.inspect.new.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New inspection record</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let item: { id: string; name: string } | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load inspection form right now. Please try again later.";

  try {
    [item, people] = await Promise.all([
      db.gearItem.findFirst({
        where: { id: itemId, AND: [access.where] },
        select: { id: true, name: true },
      }),
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before creating inspection records.";
    }
  }

  if (queryFailed || !people) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New inspection record</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!item) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New inspection record</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Gear item not found in the selected organization scope.</p>
        </div>
        <BackLink href="/gear-ops/items" label="Items" />
      </section>
    );
  }

  const result = readSearchParam(resolvedSearchParams, "result") || GearItemInspectionResult.PASSED;
  const context = readSearchParam(resolvedSearchParams, "context") || GearInspectionContext.ROUTINE;
  const inspectedByPersonId = readSearchParam(resolvedSearchParams, "inspectedByPersonId");
  const performedAt = readSearchParam(resolvedSearchParams, "performedAt") || formatDateTimeInputValue(new Date());
  const notes = readSearchParam(resolvedSearchParams, "notes");
  const nextInspectionDueAt = readSearchParam(resolvedSearchParams, "nextInspectionDueAt");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
        <GearOpsSubnav current="items" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">New inspection record</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Item: {item.name} · Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form
        action={`/gear-ops/items/${item.id}/inspect/create`}
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="result" className="text-sm font-medium">
              Inspection result
            </label>
            <select
              id="result"
              name="result"
              defaultValue={result}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {Object.values(GearItemInspectionResult).map((entry) => (
                <option key={entry} value={entry}>
                  {formatGearOpsEnum(entry)}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "resultError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "resultError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="context" className="text-sm font-medium">
              Inspection context
            </label>
            <select
              id="context"
              name="context"
              defaultValue={context}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {Object.values(GearInspectionContext).map((entry) => (
                <option key={entry} value={entry}>
                  {formatGearOpsEnum(entry)}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "contextError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "contextError")}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="inspectedByPersonId" className="text-sm font-medium">
              Inspected by person
            </label>
            <select
              id="inspectedByPersonId"
              name="inspectedByPersonId"
              defaultValue={inspectedByPersonId}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.lastName}, {person.firstName}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "inspectedByPersonIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "inspectedByPersonIdError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="performedAt" className="text-sm font-medium">
              Inspection date/time
            </label>
            <input
              id="performedAt"
              name="performedAt"
              type="datetime-local"
              defaultValue={performedAt}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "performedAtError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "performedAtError")}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="nextInspectionDueAt" className="text-sm font-medium">
            Next inspection due date (optional)
          </label>
          <input
            id="nextInspectionDueAt"
            name="nextInspectionDueAt"
            type="date"
            defaultValue={nextInspectionDueAt}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-xs text-zinc-500">Leave blank to keep the existing next due date unchanged.</p>
          {readSearchParam(resolvedSearchParams, "nextInspectionDueAtError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "nextInspectionDueAtError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">
            Inspection notes (optional)
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

        <FormActions submitLabel="Record inspection" cancelHref={`/gear-ops/items/${item.id}`} />
      </form>
    </section>
  );
}
