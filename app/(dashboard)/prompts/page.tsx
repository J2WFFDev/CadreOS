import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { resolveJournalAccessContext } from "@/lib/journals/access";
import { canManagePromptLibrary, canReadPromptLibrary } from "@/lib/journals/prompt-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const promptSelect = Prisma.validator<Prisma.JournalPromptSelect>()({
  id: true,
  title: true,
  category: true,
  tags: true,
  active: true,
  archivedAt: true,
  createdAt: true,
  createdBy: { select: { firstName: true, lastName: true } },
  _count: { select: { assignments: true } },
});
type PromptListRow = Prisma.JournalPromptGetPayload<{ select: typeof promptSelect }>;

function normalizeActiveFilter(rawValue: string | string[] | undefined): "active" | "archived" | "all" {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (value === "archived") return "archived";
  if (value === "all") return "all";
  return "active";
}

export default async function PromptsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Prompt Library" description="Manage reusable journal prompts." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load prompts right now."} />
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
        <PageHeader title="Prompt Library" description="Manage reusable journal prompts." />
        <ErrorMessage message="You do not have permission to view the prompt library." />
      </section>
    );
  }

  const canManage = canManagePromptLibrary(accessContext);
  const activeFilter = normalizeActiveFilter(params.active);
  let loadErrorMessage: string | null = null;
  let prompts: PromptListRow[] | null = null;

  try {
    prompts = await db.journalPrompt.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(activeFilter === "active" ? { active: true } : activeFilter === "archived" ? { active: false } : {}),
      },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      select: promptSelect,
      take: 300,
    });
  } catch (error) {
    const detail = describeSchemaUnavailableError(error);
    const detailSuffix = detail ? ` (${detail})` : "";
    loadErrorMessage = isSchemaUnavailableError(error)
      ? `Journal prompts are currently unavailable because setup is incomplete${detailSuffix}.`
      : "Unable to load journal prompts right now.";
    console.error("[prompts.page] Failed to load prompts", {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      schemaDetail: detail,
      error,
    });
  }

  if (!prompts) {
    return (
      <section className="space-y-4">
        <PageHeader title="Prompt Library" description="Manage reusable journal prompts." />
        <EmptyState
          message={loadErrorMessage ?? "Journal prompts are planned for a future EntryOps workflow."}
          actionHref="/entries"
          actionLabel="Back to Entries"
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Prompt Library"
        description="Reusable journal prompts staff and coaches can assign to athletes."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/prompts?active=active"
              aria-current={activeFilter === "active" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                activeFilter === "active" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Active
            </Link>
            <Link
              href="/prompts?active=archived"
              aria-current={activeFilter === "archived" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                activeFilter === "archived" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Archived
            </Link>
            <Link
              href="/prompts?active=all"
              aria-current={activeFilter === "all" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                activeFilter === "all" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              All
            </Link>
            {canManage ? (
              <Link
                href="/prompts/create"
                className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
              >
                Create prompt
              </Link>
            ) : null}
          </div>
        }
      />

      {prompts.length === 0 ? (
        <EmptyState
          message="No prompts found for the selected filter."
          actionHref={canManage ? "/prompts/create" : "/journals"}
          actionLabel={canManage ? "Create first prompt" : "Back to journals"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Prompt</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assignments</th>
                <th className="px-4 py-3 font-medium">Created by</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((prompt) => {
                const authorName =
                  `${prompt.createdBy.firstName} ${prompt.createdBy.lastName}`.trim() || "—";
                return (
                  <tr key={prompt.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/prompts/${prompt.id}`} className="underline">
                        {prompt.title}
                      </Link>
                      {prompt.tags.length > 0 ? (
                        <p className="mt-0.5 text-xs text-zinc-500">{prompt.tags.join(", ")}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {prompt.category ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          prompt.active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {prompt.active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {prompt._count.assignments}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{authorName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
