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

export default async function EventDetailsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query event details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let event:
    | {
        id: string;
        title: string;
        eventType: string;
        status: string;
        startsAt: Date;
        endsAt: Date | null;
        location: string | null;
        program: { id: string; name: string };
        team: { id: string; name: string } | null;
        createdBy: { id: string; firstName: string; lastName: string } | null;
      }
    | null = null;

  try {
    event = await db.event.findFirst({
      where: {
        id: eventId,
        organizationId: scope.organizationId,
      },
      include: {
        program: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load event details right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (!event) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Event not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{event.title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/events" className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Back to events
          </Link>
          <Link
            href={`/events/${event.id}/edit`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit event
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Event type</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatEnumLabel(event.eventType)}</dd>
          </div>
          <div>
            <dt className="font-medium">Status</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatEnumLabel(event.status)}</dd>
          </div>
          <div>
            <dt className="font-medium">Program</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{event.program.name}</dd>
          </div>
          <div>
            <dt className="font-medium">Team</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{event.team?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Starts</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(event.startsAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Ends</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(event.endsAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Location</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{event.location ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Created by</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {event.createdBy ? `${event.createdBy.firstName} ${event.createdBy.lastName}` : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
