import { GearConditionStatus, GearMaintenanceType } from "@prisma/client";

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

export default async function EditGearMaintenanceLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string; maintenanceLogId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { itemId, maintenanceLogId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit maintenance log</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load maintenance edit right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit maintenance log</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.maintenance.edit.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit maintenance log</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let item: { id: string; name: string } | null = null;
  let maintenanceLog: {
    id: string;
    maintenanceType: GearMaintenanceType;
    performedByPersonId: string;
    performedAt: Date;
    conditionBefore: GearConditionStatus | null;
    conditionAfter: GearConditionStatus | null;
    notes: string;
    createdAt: Date;
    performedBy: { id: string; firstName: string; lastName: string };
  } | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load maintenance edit right now. Please try again later.";

  try {
    [item, maintenanceLog, people] = await Promise.all([
      db.gearItem.findFirst({
        where: { id: itemId, AND: [access.where] },
        select: { id: true, name: true },
      }),
      db.gearMaintenanceLog.findFirst({
        where: { id: maintenanceLogId, gearItemId: itemId, organizationId: scope.organizationId },
        select: {
          id: true,
          maintenanceType: true,
          performedByPersonId: true,
          performedAt: true,
          conditionBefore: true,
          conditionAfter: true,
          notes: true,
          createdAt: true,
          performedBy: { select: { id: true, firstName: true, lastName: true } },
        },
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
      queryErrorMessage = "Database schema is not available yet. Run database setup before editing maintenance logs.";
    }
  }

  if (queryFailed || !people) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit maintenance log</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!item) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit maintenance log</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Gear item not found in the selected organization scope.</p>
        </div>
        <BackLink href="/gear-ops/items" label="Items" />
      </section>
    );
  }

  if (!maintenanceLog) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit maintenance log</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Maintenance log not found for this gear item.</p>
        </div>
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
      </section>
    );
  }

  const maintenanceType = readSearchParam(resolvedSearchParams, "maintenanceType") || maintenanceLog.maintenanceType;
  const performedByPersonId =
    readSearchParam(resolvedSearchParams, "performedByPersonId") || maintenanceLog.performedByPersonId;
  const performedAt =
    readSearchParam(resolvedSearchParams, "performedAt") || formatDateTimeInputValue(maintenanceLog.performedAt);
  const conditionBefore =
    readSearchParam(resolvedSearchParams, "conditionBefore") || maintenanceLog.conditionBefore || "";
  const conditionAfter = readSearchParam(resolvedSearchParams, "conditionAfter") || maintenanceLog.conditionAfter || "";
  const notes = readSearchParam(resolvedSearchParams, "notes") || maintenanceLog.notes;
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
        <GearOpsSubnav current="items" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit maintenance log</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {formatGearOpsEnum(maintenanceLog.maintenanceType)} · Service {formatGearOpsDateTime(maintenanceLog.performedAt)} ·
          Logged {formatGearOpsDateTime(maintenanceLog.createdAt)} by {maintenanceLog.performedBy.firstName}{" "}
          {maintenanceLog.performedBy.lastName}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form
        action={`/gear-ops/items/${item.id}/maintenance/${maintenanceLog.id}/edit/update`}
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="space-y-1">
          <label htmlFor="maintenanceType" className="text-sm font-medium">
            Maintenance type
          </label>
          <select
            id="maintenanceType"
            name="maintenanceType"
            defaultValue={maintenanceType}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(GearMaintenanceType).map((entry) => (
              <option key={entry} value={entry}>
                {formatGearOpsEnum(entry)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "maintenanceTypeError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "maintenanceTypeError")}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="performedByPersonId" className="text-sm font-medium">
              Performed by person
            </label>
            <select
              id="performedByPersonId"
              name="performedByPersonId"
              defaultValue={performedByPersonId}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.lastName}, {person.firstName}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "performedByPersonIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "performedByPersonIdError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="performedAt" className="text-sm font-medium">
              Service date/time
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="conditionBefore" className="text-sm font-medium">
              Condition before (optional)
            </label>
            <select
              id="conditionBefore"
              name="conditionBefore"
              defaultValue={conditionBefore}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No condition recorded</option>
              {Object.values(GearConditionStatus).map((entry) => (
                <option key={entry} value={entry}>
                  {formatGearOpsEnum(entry)}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "conditionBeforeError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "conditionBeforeError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="conditionAfter" className="text-sm font-medium">
              Condition after (optional)
            </label>
            <select
              id="conditionAfter"
              name="conditionAfter"
              defaultValue={conditionAfter}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">No condition recorded</option>
              {Object.values(GearConditionStatus).map((entry) => (
                <option key={entry} value={entry}>
                  {formatGearOpsEnum(entry)}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "conditionAfterError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "conditionAfterError")}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">
            Service notes
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

        <FormActions submitLabel="Save maintenance log" cancelHref={`/gear-ops/items/${item.id}`} />
      </form>
    </section>
  );
}
