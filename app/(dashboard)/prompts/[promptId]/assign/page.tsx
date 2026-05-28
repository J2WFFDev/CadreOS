import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { resolveJournalAccessContext } from "@/lib/journals/access";
import { canAssignPrompt } from "@/lib/journals/prompt-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { MemberLifecycleStatus, RoleType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AssignPromptPage({
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
        <ErrorMessage message={scope.errorMessage ?? "Unable to load assignment form right now."} />
      </section>
    );
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canAssignPrompt(accessContext)) {
    return (
      <section className="space-y-4">
        <BackLink href={`/prompts/${promptId}`} label="Prompt detail" />
        <ErrorMessage message="You do not have permission to assign journal prompts." />
      </section>
    );
  }

  const prompt = await db.journalPrompt.findFirst({
    where: { id: promptId, organizationId: scope.organizationId },
    select: { id: true, title: true, active: true },
  });

  if (!prompt) {
    return (
      <section className="space-y-4">
        <BackLink href="/prompts" label="Prompt library" />
        <ErrorMessage message="Prompt not found in this organization." />
      </section>
    );
  }

  if (!prompt.active) {
    return (
      <section className="space-y-4">
        <BackLink href={`/prompts/${prompt.id}`} label="Prompt detail" />
        <ErrorMessage message="This prompt is archived and cannot be assigned. Reactivate the prompt first." />
      </section>
    );
  }

  // Load athletes and teams for the assignment form
  const [athletes, teams] = await Promise.all([
    db.person.findMany({
      where: {
        organizationId: scope.organizationId,
        lifecycleStatus: MemberLifecycleStatus.ACTIVE,
        roles: { some: { roleType: RoleType.ATHLETE, organizationId: scope.organizationId } },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
    db.team.findMany({
      where: { organizationId: scope.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <BackLink href={`/prompts/${prompt.id}`} label="Prompt detail" />
        <h2 className="text-xl font-semibold tracking-tight">Assign prompt</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Assigning: <span className="font-medium">{prompt.title}</span>
        </p>
      </div>

      <form
        action={`/prompts/${prompt.id}/assign/save`}
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Assign to an individual athlete <strong>or</strong> a team. Leave one blank to use the other.
        </p>

        <div className="space-y-1">
          <label htmlFor="athletePersonId" className="text-sm font-medium">
            Assign to athlete{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <select
            id="athletePersonId"
            name="athletePersonId"
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">— Select athlete —</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {`${athlete.lastName}, ${athlete.firstName}`.trim()}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="teamId" className="text-sm font-medium">
            Assign to team{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <select
            id="teamId"
            name="teamId"
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">— Select team —</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="dueAt" className="text-sm font-medium">
            Due date{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <input
            id="dueAt"
            name="dueAt"
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="scheduledFor" className="text-sm font-medium">
            Activate on{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <input
            id="scheduledFor"
            name="scheduledFor"
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Leave blank to make the assignment active immediately.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
          >
            Assign prompt
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
