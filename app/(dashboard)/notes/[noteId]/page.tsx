import Link from "next/link";

import { db } from "@/lib/db";
import { compareFollowUpTasks, formatDateTime, formatEnumLabel } from "@/lib/follow-up-tasks";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/phase1c/workflows";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query note details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let note:
    | {
        id: string;
        body: string;
        visibility: string;
        createdAt: Date;
        updatedAt: Date;
        author: { id: string; firstName: string; lastName: string };
        athlete: { id: string; firstName: string; lastName: string } | null;
        team: { id: string; name: string } | null;
        event: { id: string; title: string } | null;
        tasks: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: Date | null;
          assignee: { id: string; firstName: string; lastName: string };
        }>;
      }
    | null = null;
  let queryErrorMessage = "Unable to load note details right now. Please try again later.";

  try {
    note = await db.observationNote.findFirst({
      where: {
        id: noteId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        body: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        athlete: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true } },
        event: { select: { id: true, title: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            dueAt: true,
            assignee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    note?.tasks.sort(compareFollowUpTasks);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading notes.";
    }

    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      </section>
    );
  }

  if (!note) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Note not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Observation note</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/notes" className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Back to notes
          </Link>
          <Link
            href={`/notes/${note.id}/edit`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit note
          </Link>
          <Link
            href={`/tasks/new?sourceNoteId=${note.id}`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Create follow-up task
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Author</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              <Link href={`/people/${note.author.id}`} className="underline">
                {note.author.firstName} {note.author.lastName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-medium">Visibility</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatEnumLabel(note.visibility)}</dd>
          </div>
          <div>
            <dt className="font-medium">Created</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(note.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Updated</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(note.updatedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Athlete / Person</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {note.athlete ? (
                <Link href={`/people/${note.athlete.id}`} className="underline">
                  {note.athlete.firstName} {note.athlete.lastName}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Team</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {note.team ? (
                <Link href={`/teams/${note.team.id}`} className="underline">
                  {note.team.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Event</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {note.event ? (
                <Link href={`/events/${note.event.id}`} className="underline">
                  {note.event.title}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Note body</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{note.body}</p>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Related tasks</h3>
          <Link href={`/tasks/new?sourceNoteId=${note.id}`} className="text-sm underline">
            Create follow-up task
          </Link>
        </div>
        {note.tasks.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No follow-up tasks are linked to this note yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {note.tasks.map((task) => (
              <li key={task.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/tasks/${task.id}`} className="font-medium underline">
                    {task.title}
                  </Link>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{formatEnumLabel(task.status)}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Assignee:{" "}
                  <Link href={`/people/${task.assignee.id}`} className="underline">
                    {task.assignee.firstName} {task.assignee.lastName}
                  </Link>
                  {" · "}Due: {formatDateTime(task.dueAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
