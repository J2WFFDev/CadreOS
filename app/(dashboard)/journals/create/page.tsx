import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import {
  JOURNAL_PAYLOAD_VISIBILITY_VALUES,
  type JournalPayloadVisibility,
} from "@/lib/entries/journal-payload";
import { canCreateJournal, resolveJournalAccessContext } from "@/lib/journals/access";
import { canRespondToAssignment } from "@/lib/journals/prompt-access";
import {
  MAX_JOURNAL_TITLE_LENGTH,
  labelForJournalPayloadVisibility,
  hintForJournalPayloadVisibility,
} from "@/lib/journals/policy";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CreateJournalPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;

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

  // Optional prompt/assignment context from query params
  const promptIdParam = Array.isArray(params.promptId) ? params.promptId[0] : params.promptId;
  const assignmentIdParam = Array.isArray(params.assignmentId) ? params.assignmentId[0] : params.assignmentId;
  const routeErrorParam = Array.isArray(params.error) ? params.error[0] : params.error;

  let promptContext:
    | {
        id: string;
        title: string;
        promptText: string;
        category: string | null;
      }
    | null = null;
  let assignmentContext:
    | {
        id: string;
        status: string;
        dueAt: Date | null;
      }
    | null = null;
  let queryErrorMessage: string | null = routeErrorParam ?? null;

  try {
    promptContext =
      promptIdParam && scope.organizationId
        ? await db.journalPrompt.findFirst({
            where: { id: promptIdParam, organizationId: scope.organizationId, active: true },
            select: { id: true, title: true, promptText: true, category: true },
          })
        : null;

    if (assignmentIdParam && scope.organizationId) {
      const athleteTeamIds = (
        await db.rosterMembership.findMany({
          where: { organizationId: scope.organizationId, personId: scope.auth.personId ?? "" },
          select: { teamId: true },
        })
      ).map((membership) => membership.teamId);
      const assignment = await db.journalAssignment.findFirst({
            where: {
              id: assignmentIdParam,
              organizationId: scope.organizationId,
              promptId: promptContext?.id ?? "",
            },
            select: {
              id: true,
              promptId: true,
              status: true,
              dueAt: true,
              assignedToAthletePersonId: true,
              assignedToTeamId: true,
              assignedByPersonId: true,
            },
          });
      assignmentContext =
        assignment && canRespondToAssignment(accessContext, assignment, athleteTeamIds)
          ? { id: assignment.id, status: assignment.status, dueAt: assignment.dueAt }
          : null;
      if (!assignmentContext) {
        promptContext = null;
        queryErrorMessage = "This journal prompt assignment could not be found or you do not have access to it.";
      }
    }
  } catch (error) {
    const detail = describeSchemaUnavailableError(error);
    queryErrorMessage = isSchemaUnavailableError(error)
      ? `Journal setup is currently unavailable because ${detail ?? "required journal tables/columns are missing"}.`
      : "Unable to load journal creation context right now.";
    console.error("[journals.create.page] Failed to load journal prompt/assignment context", {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      schemaDetail: detail,
      error,
    });
  }

  const hasPromptContext = Boolean(promptContext);

  return (
    <section className="space-y-4">
      <PageHeader
        title={hasPromptContext ? "Respond to journal prompt" : "Create journal draft"}
        description={
          hasPromptContext
            ? "Write your journal response to the assigned prompt below."
            : "Draft journals are private by default and can be submitted when ready."
        }
        actions={
          <Link href={hasPromptContext ? "/prompt-assignments" : "/journals"} className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            {hasPromptContext ? "Back to assignments" : "Back to journals"}
          </Link>
        }
      />

      {queryErrorMessage ? <ErrorMessage message={queryErrorMessage} /> : null}

      {promptContext ? (
        <article className="rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-800">
          <h3 className="text-sm font-semibold">Assigned prompt</h3>
          {promptContext.category ? (
            <p className="mt-0.5 text-xs text-zinc-500">{promptContext.category}</p>
          ) : null}
          <p className="mt-2 whitespace-pre-wrap text-sm">{promptContext.promptText}</p>
          {assignmentContext?.dueAt ? (
            <p className="mt-2 text-xs text-zinc-500">
              Due: {assignmentContext.dueAt.toISOString().slice(0, 10)}
            </p>
          ) : null}
        </article>
      ) : null}

      <form action="/journals/create/save" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        {/* Pass prompt/assignment context to the save route */}
        {promptContext ? <input type="hidden" name="journalPromptId" value={promptContext.id} /> : null}
        {assignmentContext ? <input type="hidden" name="journalAssignmentId" value={assignmentContext.id} /> : null}

        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            maxLength={MAX_JOURNAL_TITLE_LENGTH}
            required
            defaultValue={promptContext ? `Response: ${promptContext.title}` : undefined}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="content" className="text-sm font-medium">
            Journal body
          </label>
          <textarea id="content" name="content" required rows={12} className="w-full rounded-md border px-3 py-2 text-sm" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Sensitive content is never shown in broad feed/activity surfaces.</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="journalVisibility" className="text-sm font-medium">
            Visibility
          </label>
          <select id="journalVisibility" name="journalVisibility" defaultValue="PRIVATE" className="w-full rounded-md border px-3 py-2 text-sm">
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
              defaultValue={new Date().toISOString().slice(0, 10)}
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
              placeholder="Leave blank to use your name"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
          Save draft
        </button>
      </form>
    </section>
  );
}
