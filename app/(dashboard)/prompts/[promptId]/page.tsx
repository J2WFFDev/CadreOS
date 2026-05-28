import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { resolveJournalAccessContext } from "@/lib/journals/access";
import {
  canAssignPrompt,
  canManagePromptLibrary,
  canReadPromptLibrary,
  labelForAssignmentStatus,
} from "@/lib/journals/prompt-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatDateUTC(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ promptId: string }>;
}) {
  const { promptId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <BackLink href="/prompts" label="Prompt library" />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load prompt right now."} />
      </section>
    );
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canReadPromptLibrary(accessContext)) {
    return (
      <section className="space-y-4">
        <BackLink href="/prompts" label="Prompt library" />
        <ErrorMessage message="You do not have permission to view this prompt." />
      </section>
    );
  }

  const prompt = await db.journalPrompt.findFirst({
    where: { id: promptId, organizationId: scope.organizationId },
    select: {
      id: true,
      title: true,
      promptText: true,
      category: true,
      tags: true,
      active: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
      assignments: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          dueAt: true,
          scheduledFor: true,
          createdAt: true,
          assignedToAthlete: { select: { firstName: true, lastName: true } },
          assignedToTeam: { select: { name: true } },
          assignedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!prompt) {
    return (
      <section className="space-y-4">
        <BackLink href="/prompts" label="Prompt library" />
        <ErrorMessage message="Prompt not found in this organization." />
      </section>
    );
  }

  const canManage = canManagePromptLibrary(accessContext);
  const canAssign = canAssignPrompt(accessContext);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <BackLink href="/prompts" label="Prompt library" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{prompt.title}</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              prompt.active
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {prompt.active ? "Active" : "Archived"}
          </span>
        </div>
        {prompt.category ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Category: {prompt.category}</p>
        ) : null}
        {prompt.tags.length > 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Tags: {prompt.tags.join(", ")}
          </p>
        ) : null}
      </div>

      <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Prompt text</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm">{prompt.promptText}</p>
      </article>

      <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <h3 className="font-semibold">Metadata</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Created by</dt>
            <dd>
              {`${prompt.createdBy.firstName} ${prompt.createdBy.lastName}`.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Created</dt>
            <dd>{formatDateUTC(prompt.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Last updated</dt>
            <dd>{formatDateUTC(prompt.updatedAt)}</dd>
          </div>
          {prompt.archivedAt ? (
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Archived</dt>
              <dd>{formatDateUTC(prompt.archivedAt)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2">
        {canManage ? (
          <Link
            href={`/prompts/${prompt.id}/edit`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit prompt
          </Link>
        ) : null}
        {canAssign && prompt.active ? (
          <Link
            href={`/prompts/${prompt.id}/assign`}
            className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
          >
            Assign prompt
          </Link>
        ) : null}
        {canManage && prompt.active ? (
          <form action={`/prompts/${prompt.id}/archive`} method="post">
            <button
              type="submit"
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
            >
              Archive prompt
            </button>
          </form>
        ) : null}
      </div>

      {prompt.assignments.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Assignments ({prompt.assignments.length})</h3>
          <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Assigned to</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Assigned by</th>
                  <th className="px-4 py-3 font-medium">Assigned on</th>
                </tr>
              </thead>
              <tbody>
                {prompt.assignments.map((assignment) => {
                  const target = assignment.assignedToAthlete
                    ? `${assignment.assignedToAthlete.firstName} ${assignment.assignedToAthlete.lastName}`.trim()
                    : assignment.assignedToTeam
                      ? `Team: ${assignment.assignedToTeam.name}`
                      : "—";
                  const assignedBy =
                    `${assignment.assignedBy.firstName} ${assignment.assignedBy.lastName}`.trim() ||
                    "—";
                  return (
                    <tr key={assignment.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">{target}</td>
                      <td className="px-4 py-3">{labelForAssignmentStatus(assignment.status)}</td>
                      <td className="px-4 py-3 text-zinc-500">{formatDateUTC(assignment.dueAt)}</td>
                      <td className="px-4 py-3 text-zinc-500">{assignedBy}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {assignment.createdAt.toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
