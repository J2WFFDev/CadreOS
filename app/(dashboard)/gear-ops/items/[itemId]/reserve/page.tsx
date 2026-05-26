import {
  GearHoldType,
  GearReservationMode,
  GearReservationPurpose,
  GearReservationStatus,
} from "@prisma/client";

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

export default async function ReserveGearItemPage({
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
        <h2 className="text-2xl font-semibold tracking-tight">Reserve / hold gear item</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load reservation form right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reserve / hold gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.reserve.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reserve / hold gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let item:
    | {
        id: string;
        name: string;
        category: { name: string; guardianApprovalRequired: boolean };
      }
    | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> | null = null;
  let teams: Array<{ id: string; name: string }> | null = null;
  let events: Array<{ id: string; title: string }> | null = null;
  let programs: Array<{ id: string; name: string }> | null = null;
  let queryErrorMessage = "Unable to load reservation form right now. Please try again later.";

  try {
    [item, people, teams, events, programs] = await Promise.all([
      db.gearItem.findFirst({
        where: { id: itemId, AND: [access.where] },
        select: { id: true, name: true, category: { select: { name: true, guardianApprovalRequired: true } } },
      }),
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.team.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.event.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, title: true },
        orderBy: [{ startsAt: "desc" }],
        take: 50,
      }),
      db.program.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
    ]);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before reserving gear items.";
    }
  }

  if (!item || !people || !teams || !events || !programs) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reserve / hold gear item</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const status = readSearchParam(resolvedSearchParams, "status") || GearReservationStatus.ACTIVE;
  const mode = readSearchParam(resolvedSearchParams, "mode") || GearReservationMode.HARD_RESERVATION;
  const purpose = readSearchParam(resolvedSearchParams, "purpose") || GearReservationPurpose.EVENT;
  const holdType = readSearchParam(resolvedSearchParams, "holdType") || GearHoldType.EVENT_HOLD;
  const reservedForPersonId = readSearchParam(resolvedSearchParams, "reservedForPersonId");
  const reservedForTeamId = readSearchParam(resolvedSearchParams, "reservedForTeamId");
  const reservedForEventId = readSearchParam(resolvedSearchParams, "reservedForEventId");
  const programId = readSearchParam(resolvedSearchParams, "programId");
  const quantityRequested = readSearchParam(resolvedSearchParams, "quantityRequested") || "1";
  const windowStartAt = readSearchParam(resolvedSearchParams, "windowStartAt") || formatDateTimeInputValue(now);
  const windowEndAt = readSearchParam(resolvedSearchParams, "windowEndAt") || formatDateTimeInputValue(tomorrow);
  const notes = readSearchParam(resolvedSearchParams, "notes");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/items/${item.id}`} label={item.name} />
        <GearOpsSubnav current="items" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Reserve / hold gear item</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Item: {item.name} · Category: {item.category.name}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <GearOfflineForm
        action={`/gear-ops/items/${item.id}/reserve/create`}
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
        actionType="gear.reservation.create"
        subjectType="GEAR_ITEM"
        subjectId={item.id}
        subjectLabel={item.name}
        permissionKey="gearReservation.create"
        returnHref={`/gear-ops/items/${item.id}`}
        queueLabel={`Gear reservation · ${item.name}`}
      >
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
          Reservations and holds track future intent only. They do not change custody until a checkout, assignment, staging, or deployment action is completed online.
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="status" className="text-sm font-medium">Initial status</label>
            <select id="status" name="status" defaultValue={status} className="w-full rounded-md border px-3 py-2 text-sm">
              {[GearReservationStatus.DRAFT, GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW].map((value) => (
                <option key={value} value={value}>{formatGearOpsEnum(value)}</option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "statusError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "statusError")}</p> : null}
          </div>
          <div className="space-y-1">
            <label htmlFor="mode" className="text-sm font-medium">Reservation strength</label>
            <select id="mode" name="mode" defaultValue={mode} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(GearReservationMode).map((value) => (
                <option key={value} value={value}>{formatGearOpsEnum(value)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="quantityRequested" className="text-sm font-medium">Quantity</label>
            <input id="quantityRequested" name="quantityRequested" defaultValue={quantityRequested} className="w-full rounded-md border px-3 py-2 text-sm" inputMode="numeric" />
            {readSearchParam(resolvedSearchParams, "quantityRequestedError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "quantityRequestedError")}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="purpose" className="text-sm font-medium">Purpose</label>
            <select id="purpose" name="purpose" defaultValue={purpose} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(GearReservationPurpose).map((value) => (
                <option key={value} value={value}>{formatGearOpsEnum(value)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="holdType" className="text-sm font-medium">Hold type (optional)</label>
            <select id="holdType" name="holdType" defaultValue={holdType} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No specific hold type</option>
              {Object.values(GearHoldType).map((value) => (
                <option key={value} value={value}>{formatGearOpsEnum(value)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="windowStartAt" className="text-sm font-medium">Reservation start</label>
            <input id="windowStartAt" name="windowStartAt" type="datetime-local" defaultValue={windowStartAt} className="w-full rounded-md border px-3 py-2 text-sm" />
            {readSearchParam(resolvedSearchParams, "windowStartAtError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "windowStartAtError")}</p> : null}
          </div>
          <div className="space-y-1">
            <label htmlFor="windowEndAt" className="text-sm font-medium">Reservation end</label>
            <input id="windowEndAt" name="windowEndAt" type="datetime-local" defaultValue={windowEndAt} className="w-full rounded-md border px-3 py-2 text-sm" />
            {readSearchParam(resolvedSearchParams, "windowEndAtError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "windowEndAtError")}</p> : null}
          </div>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400">Pick any relevant context references below. Event and program links improve dashboard, reporting, and fulfillment visibility.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="reservedForPersonId" className="text-sm font-medium">Person context (optional)</label>
            <select id="reservedForPersonId" name="reservedForPersonId" defaultValue={reservedForPersonId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No person context</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.lastName}, {person.firstName}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="reservedForTeamId" className="text-sm font-medium">Team context (optional)</label>
            <select id="reservedForTeamId" name="reservedForTeamId" defaultValue={reservedForTeamId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No team context</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="reservedForEventId" className="text-sm font-medium">Event context (optional)</label>
            <select id="reservedForEventId" name="reservedForEventId" defaultValue={reservedForEventId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No event context</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="programId" className="text-sm font-medium">Program context (optional)</label>
            <select id="programId" name="programId" defaultValue={programId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No program context</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>{program.name}</option>
              ))}
            </select>
          </div>
        </div>

        {item.category.guardianApprovalRequired ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            This category can require guardian/admin review before a hard reservation tied to a person is fulfilled.
          </div>
        ) : null}

        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">Notes (optional)</label>
          <textarea id="notes" name="notes" defaultValue={notes} rows={4} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Purpose details, readiness assumptions, maintenance reason, staging note, or approval context." />
          {readSearchParam(resolvedSearchParams, "notesError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "notesError")}</p> : null}
        </div>

        <FormActions submitLabel="Save reservation / hold" cancelHref={`/gear-ops/items/${item.id}`} />
      </GearOfflineForm>
    </section>
  );
}
