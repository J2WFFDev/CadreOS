import Link from "next/link";
import { EntryType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { parseEventEntryPayload } from "@/lib/entries/event-payload";
import { formatEnumLabel } from "@/lib/follow-up-tasks";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type CalendarScope = "PERSONAL" | "ORGANIZATION" | "PROGRAM" | "TEAM";
const CALENDAR_SCOPE_OPTIONS: CalendarScope[] = ["PERSONAL", "ORGANIZATION", "PROGRAM", "TEAM"];

function readParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return "—";
  return value.replace("T", " ");
}

function recurrenceLabel(payload: ReturnType<typeof parseEventEntryPayload>) {
  if (payload.recurrence.frequency === "NONE") return "Does not repeat";
  const cadence = formatEnumLabel(payload.recurrence.frequency);
  const interval = payload.recurrence.interval && payload.recurrence.interval > 1 ? ` every ${payload.recurrence.interval}` : "";
  const end =
    payload.recurrence.endCondition === "ON_DATE" && payload.recurrence.endDate
      ? ` · until ${payload.recurrence.endDate}`
      : payload.recurrence.endCondition === "AFTER_OCCURRENCES" && payload.recurrence.occurrenceCount
        ? ` · ${payload.recurrence.occurrenceCount} occurrences`
        : "";
  const custom = payload.recurrence.customRule ? ` · ${payload.recurrence.customRule}` : "";
  return `${cadence}${interval}${end}${custom}`;
}

export default async function EntryEventSchedulePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Event Schedule" description="Upcoming event entries by calendar scope." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load schedule right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Event Schedule" description="Upcoming event entries by calendar scope." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const organizationId = scope.organizationId;
  const selectedScopeRaw = readParam(params, "scope").toUpperCase();
  const selectedScope = CALENDAR_SCOPE_OPTIONS.includes(selectedScopeRaw as CalendarScope)
    ? (selectedScopeRaw as CalendarScope)
    : "PERSONAL";
  const selectedProgramId = readParam(params, "programId");
  const selectedTeamId = readParam(params, "teamId");

  const entryAccess = await resolveEntryAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (entryAccess.level === "NONE") {
    return (
      <section className="space-y-4">
        <PageHeader title="Event Schedule" description="Upcoming event entries by calendar scope." />
        <ErrorMessage message="You do not have permission to view event entries in this organization." />
      </section>
    );
  }

  const [entries, programs, teams] = await Promise.all([
    db.entry.findMany({
      where: {
        organizationId,
        deletedAt: null,
        type: EntryType.EVENT,
        status: { not: "ARCHIVED" },
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        content: true,
        createdByPersonId: true,
        typePayloads: {
          where: { entryType: EntryType.EVENT },
          orderBy: { updatedAt: "desc" },
          select: { payloadJson: true },
          take: 1,
        },
      },
      take: 500,
    }),
    db.program.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
    db.team.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const scheduleItems = entries
    .map((entry) => {
      const payload = parseEventEntryPayload(entry.typePayloads[0]?.payloadJson);
      return { entry, payload };
    })
    .filter(({ entry, payload }) => {
      if (selectedScope === "PERSONAL") {
        return payload.calendarScope === "PERSONAL" && entry.createdByPersonId === scope.auth.personId;
      }
      if (selectedScope === "ORGANIZATION") {
        return payload.calendarScope === "ORGANIZATION";
      }
      if (selectedScope === "PROGRAM") {
        if (payload.calendarScope !== "PROGRAM") return false;
        return selectedProgramId ? payload.programId === selectedProgramId : true;
      }
      if (payload.calendarScope !== "TEAM") return false;
      return selectedTeamId ? payload.teamId === selectedTeamId : true;
    })
    .sort((a, b) => {
      const aStart = a.payload.startDateTimeLocal ?? "9999-12-31T23:59";
      const bStart = b.payload.startDateTimeLocal ?? "9999-12-31T23:59";
      if (aStart !== bStart) return aStart.localeCompare(bStart);
      return a.entry.title.localeCompare(b.entry.title);
    });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Event Schedule"
        description="Upcoming event entries by calendar scope."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/entries" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              All entries
            </Link>
            <Link href="/entries/inbox" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Entry inbox
            </Link>
          </div>
        }
      />

      <form className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="scope" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Calendar scope
            </label>
            <select id="scope" name="scope" defaultValue={selectedScope} className="w-full rounded-md border px-2 py-1.5 text-sm">
              {CALENDAR_SCOPE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {formatEnumLabel(value)}
                </option>
              ))}
            </select>
          </div>
          {selectedScope === "PROGRAM" ? (
            <div className="space-y-1">
              <label htmlFor="programId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Program
              </label>
              <select id="programId" name="programId" defaultValue={selectedProgramId} className="w-full rounded-md border px-2 py-1.5 text-sm">
                <option value="">All program events</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {selectedScope === "TEAM" ? (
            <div className="space-y-1">
              <label htmlFor="teamId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Team
              </label>
              <select id="teamId" name="teamId" defaultValue={selectedTeamId} className="w-full rounded-md border px-2 py-1.5 text-sm">
                <option value="">All team events</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Apply
          </button>
          <Link href="/entries/schedule" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Reset
          </Link>
        </div>
      </form>

      {scheduleItems.length === 0 ? (
        <EmptyState message="No event entries match the selected calendar scope." actionHref="/entries" actionLabel="Back to entries" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Timezone</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Recurrence</th>
              </tr>
            </thead>
            <tbody>
              {scheduleItems.map(({ entry, payload }) => (
                <tr key={entry.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/entries/${entry.id}`} className="underline">
                      {entry.title}
                    </Link>
                    {entry.content ? <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{entry.content}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{formatEnumLabel(payload.eventType)}</td>
                  <td className="px-4 py-3">{formatDateTimeLocal(payload.startDateTimeLocal)}</td>
                  <td className="px-4 py-3">{formatDateTimeLocal(payload.endDateTimeLocal)}</td>
                  <td className="px-4 py-3 text-zinc-600">{payload.timezone || "UTC"}</td>
                  <td className="px-4 py-3 text-zinc-600">{payload.location || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatEnumLabel(payload.calendarScope)}</td>
                  <td className="px-4 py-3 text-zinc-600">{recurrenceLabel(payload)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
