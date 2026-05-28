import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
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

export default async function EditPromptPage({
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

  if (!canManagePromptLibrary(accessContext)) {
    return (
      <section className="space-y-4">
        <BackLink href={`/prompts/${promptId}`} label="Prompt detail" />
        <ErrorMessage message="You do not have permission to edit journal prompts." />
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

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <BackLink href={`/prompts/${prompt.id}`} label="Prompt detail" />
        <h2 className="text-xl font-semibold tracking-tight">Edit prompt</h2>
      </div>

      <form
        action={`/prompts/${prompt.id}/edit/update`}
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
            defaultValue={prompt.title}
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
            defaultValue={prompt.promptText}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="category" className="text-sm font-medium">
            Category{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <select
            id="category"
            name="category"
            defaultValue={prompt.category ?? ""}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
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
            defaultValue={prompt.tags.join(", ")}
            placeholder="e.g. reflection, goal, teamwork (comma-separated)"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
          >
            Save changes
          </button>
          <Link
            href={`/prompts/${prompt.id}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
