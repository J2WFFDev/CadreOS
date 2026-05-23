import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/phase1c/workflows";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date) {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function NotesPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query notes right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let notes:
    | Array<{
        id: string;
        body: string;
        visibility: string;
        createdAt: Date;
        author: { id: string; firstName: string; lastName: string };
        athlete: { id: string; firstName: string; lastName: string } | null;
        team: { id: string; name: string } | null;
        event: { id: string; title: string } | null;
      }>
    | null = null;
  let queryErrorMessage = "Unable to load notes right now. Please try again later.";

  try {
    notes = await db.observationNote.findMany({
      where: { organizationId: scope.organizationId },
      select: {
        id: true,
        body: true,
        visibility: true,
        createdAt: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        athlete: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true } },
        event: { select: { id: true, title: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });
  } catch (error) {
    notes = null;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading notes.";
    }
  }

  if (!notes) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Notes</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Organization: {scope.organizationName ?? scope.organizationId}
          </p>
          <Link href="/notes/new" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            New note
          </Link>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No observation notes found for this organization.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 font-medium">Athlete / Person</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Event</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/notes/${note.id}`} className="underline">
                      {note.body.length > 80 ? `${note.body.slice(0, 80)}…` : note.body}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {note.author.firstName} {note.author.lastName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(note.createdAt)}</td>
                  <td className="px-4 py-3">{formatEnumLabel(note.visibility)}</td>
                  <td className="px-4 py-3">
                    {note.athlete ? (
                      <Link href={`/people/${note.athlete.id}`} className="underline">
                        {note.athlete.firstName} {note.athlete.lastName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {note.team ? (
                      <Link href={`/teams/${note.team.id}`} className="underline">
                        {note.team.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {note.event ? (
                      <Link href={`/events/${note.event.id}`} className="underline">
                        {note.event.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
