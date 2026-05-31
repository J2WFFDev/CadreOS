import { EntryType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import {
  JOURNAL_PAYLOAD_VISIBILITY_VALUES,
  type JournalPayloadVisibility,
  parseJournalEntryPayload,
} from "@/lib/entries/journal-payload";
import { canEditJournalDraft, resolveJournalAccessContext } from "@/lib/journals/access";
import {
  MAX_JOURNAL_TITLE_LENGTH,
  hintForJournalPayloadVisibility,
  labelForJournalPayloadVisibility,
} from "@/lib/journals/policy";
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
      typePayloads: {
        where: { entryType: EntryType.JOURNAL },
        select: { entryType: true, payloadJson: true },
        take: 1,
      },
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

  const existingPayload = parseJournalEntryPayload(journal.typePayloads[0]?.payloadJson ?? null);
  const defaultDate = existingPayload.journalDate ?? new Date().toISOString().slice(0, 10);
  const defaultVisibility: JournalPayloadVisibility = existingPayload.journalVisibility ?? "PRIVATE";
  const defaultAuthor = existingPayload.journalAuthor ?? "";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <BackLink href={`/journals/${journal.id}`} label="Journal detail" />
        <Link href="/journals" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          All journals
        </Link>
      </div>

      <form action={`/journals/${journal.id}/edit/update`} method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            defaultValue={journal.title}
            maxLength={MAX_JOURNAL_TITLE_LENGTH}
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="content" className="text-sm font-medium">
            Journal body
          </label>
          <textarea id="content" name="content" defaultValue={journal.content ?? ""} required rows={12} className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>

        {/* Arc 24D.7: journal metadata fields */}
        <div className="space-y-1">
          <label htmlFor="journalVisibility" className="text-sm font-medium">
            Visibility
          </label>
          <select id="journalVisibility" name="journalVisibility" defaultValue={defaultVisibility} className="w-full rounded-md border px-3 py-2 text-sm">
            {JOURNAL_PAYLOAD_VISIBILITY_VALUES.map((vis: JournalPayloadVisibility) => (
              <option key={vis} value={vis}>
                {labelForJournalPayloadVisibility(vis)}
              </option>
            ))}
          </select>
          <ul className="space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {JOURNAL_PAYLOAD_VISIBILITY_VALUES.map((vis: JournalPayloadVisibility) => (
              <li key={vis}>
                <span className="font-medium">{labelForJournalPayloadVisibility(vis)}:</span>{" "}
                {hintForJournalPayloadVisibility(vis)}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="journalDate" className="text-sm font-medium">
              Journal date
            </label>
            <input
              id="journalDate"
              name="journalDate"
              type="date"
              defaultValue={defaultDate}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="journalAuthor" className="text-sm font-medium">
              Author (optional)
            </label>
            <input
              id="journalAuthor"
              name="journalAuthor"
              type="text"
              maxLength={120}
              defaultValue={defaultAuthor}
              placeholder="Leave blank to use your name"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
          Save draft updates
        </button>
      </form>
    </section>
  );
}
