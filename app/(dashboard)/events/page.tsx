import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export default async function EventsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query events right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let events:
    | Array<{
        id: string;
        title: string;
        eventType: string;
        status: string;
        startsAt: Date;
        endsAt: Date | null;
        location: string | null;
        program: { id: string; name: string };
        team: { id: string; name: string } | null;
      }>
    | null = null;

  try {
    const now = new Date();
    const [upcomingEvents, pastEvents] = await Promise.all([
      db.event.findMany({
        where: {
          organizationId: scope.organizationId,
          startsAt: { gte: now },
        },
        include: {
          program: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ startsAt: "asc" }],
      }),
      db.event.findMany({
        where: {
          organizationId: scope.organizationId,
          startsAt: { lt: now },
        },
        include: {
          program: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ startsAt: "desc" }],
      }),
    ]);

    events = [...upcomingEvents, ...pastEvents];
  } catch {
    events = null;
  }

  if (!events) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load events right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Schedule and track training sessions, games, and other program events.
          </p>
        </div>
        <Link href="/events/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
          New event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No events have been scheduled yet.</p>
          <Link
            href="/events/new"
            className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Schedule the first event
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/events/${event.id}`} className="underline">
                      {event.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatEnumLabel(event.eventType)}</td>
                  <td className="px-4 py-3">{formatEnumLabel(event.status)}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(event.startsAt)}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(event.endsAt)}</td>
                  <td className="px-4 py-3">{event.program.name}</td>
                  <td className="px-4 py-3">{event.team?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{event.location ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
