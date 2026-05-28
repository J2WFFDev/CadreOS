import { EntryType, EntryVisibility } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { canEditJournalDraft, resolveJournalAccessContext } from "@/lib/journals/access";
import { hintForJournalVisibility, labelForJournalVisibility } from "@/lib/journals/policy";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function EditJournalDraftPage({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <BackLink href="/journals" label="Journals" />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load journal draft right now."} />
      </section>
    );
  }

  const journal = await db.entry.findFirst({
    where: {
      id: entryId,
      organizationId: scope.organizationId,
      type: EntryType.JOURNAL,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      visibility: true,
      status: true,
      createdByPersonId: true,
      teamId: true,
      team: { select: { programId: true } },
    },
  });

  if (!journal) {
    return (
      <section className="space-y-4">
        <BackLink href="/journals" label="Journals" />
        <ErrorMessage message="Journal entry not found." />
      </section>
    );
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canEditJournalDraft(accessContext, journal)) {
    return (
      <section className="space-y-4">
        <BackLink href={`/journals/${journal.id}`} label="Journal detail" />
        <ErrorMessage message="Only the author can edit a journal draft before submission." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <BackLink href={`/journals/${journal.id}`} label="Journal detail" />
        <Link href="/journals" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          All journals
        </Link>
      </div>

      <form action={`/journals/${journal.id}/edit`} method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input id="title" name="title" defaultValue={journal.title} maxLength={160} required className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label htmlFor="content" className="text-sm font-medium">
            Journal body
          </label>
          <textarea id="content" name="content" defaultValue={journal.content ?? ""} required rows={12} className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label htmlFor="visibility" className="text-sm font-medium">
            Submission visibility policy
          </label>
          <select id="visibility" name="visibility" defaultValue={journal.visibility} className="w-full rounded-md border px-3 py-2 text-sm">
            {Object.values(EntryVisibility).map((visibility) => (
              <option key={visibility} value={visibility}>
                {labelForJournalVisibility(visibility)}
              </option>
            ))}
          </select>
          <ul className="space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {Object.values(EntryVisibility).map((visibility) => (
              <li key={visibility}>
                <span className="font-medium">{labelForJournalVisibility(visibility)}:</span> {hintForJournalVisibility(visibility)}
              </li>
            ))}
          </ul>
        </div>

        <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
          Save draft updates
        </button>
      </form>
    </section>
  );
}
