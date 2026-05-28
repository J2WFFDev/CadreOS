import { EntryVisibility } from "@prisma/client";
import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { canCreateJournal, resolveJournalAccessContext } from "@/lib/journals/access";
import { hintForJournalVisibility, labelForJournalVisibility } from "@/lib/journals/policy";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function CreateJournalPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Create journal" description="Capture a private draft reflection." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load journal creation right now."} />
      </section>
    );
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canCreateJournal(accessContext)) {
    return (
      <section className="space-y-4">
        <PageHeader title="Create journal" description="Capture a private draft reflection." />
        <ErrorMessage message="You do not have permission to create a journal draft." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Create journal draft"
        description="Draft journals are private by default and can be submitted when ready."
        actions={
          <Link href="/journals" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Back to journals
          </Link>
        }
      />

      <form action="/journals/create" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input id="title" name="title" maxLength={160} required className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>

        <div className="space-y-1">
          <label htmlFor="content" className="text-sm font-medium">
            Journal body
          </label>
          <textarea id="content" name="content" required rows={12} className="w-full rounded-md border px-3 py-2 text-sm" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Sensitive content is never shown in broad feed/activity surfaces.</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="visibility" className="text-sm font-medium">
            Submission visibility policy
          </label>
          <select id="visibility" name="visibility" defaultValue={EntryVisibility.STAFF_ONLY} className="w-full rounded-md border px-3 py-2 text-sm">
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
          Save draft
        </button>
      </form>
    </section>
  );
}
