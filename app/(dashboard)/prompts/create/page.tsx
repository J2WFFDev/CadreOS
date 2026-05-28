import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { resolveJournalAccessContext } from "@/lib/journals/access";
import { canManagePromptLibrary } from "@/lib/journals/prompt-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

const PROMPT_CATEGORIES = [
  "Pre-practice reflection",
  "Post-practice reflection",
  "Match preparation",
  "Match review",
  "Goal setting",
  "Confidence check",
  "Equipment readiness",
  "Teamwork / sportsmanship",
  "Recovery from mistakes",
];

export default async function CreatePromptPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Create prompt" description="Add a new reusable journal prompt." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load prompt creation right now."} />
      </section>
    );
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canManagePromptLibrary(accessContext)) {
    return (
      <section className="space-y-4">
        <PageHeader title="Create prompt" description="Add a new reusable journal prompt." />
        <ErrorMessage message="You do not have permission to create journal prompts." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Create journal prompt"
        description="Prompts are reusable templates that staff and coaches can assign to athletes."
        actions={
          <Link href="/prompts" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Back to prompts
          </Link>
        }
      />

      <form
        action="/prompts/create/save"
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            maxLength={200}
            required
            placeholder="e.g. Post-practice reflection"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="promptText" className="text-sm font-medium">
            Prompt text
          </label>
          <textarea
            id="promptText"
            name="promptText"
            required
            rows={6}
            placeholder="What went well in practice today? What would you do differently?"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            This is the question or reflection cue the athlete will see when responding.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="category" className="text-sm font-medium">
            Category{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <select id="category" name="category" className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">— No category —</option>
            {PROMPT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="tags" className="text-sm font-medium">
            Tags{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <input
            id="tags"
            name="tags"
            placeholder="e.g. reflection, goal, teamwork (comma-separated)"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Enter comma-separated tags to help organize prompts.
          </p>
        </div>

        <button
          type="submit"
          className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
        >
          Create prompt
        </button>
      </form>
    </section>
  );
}
