import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { resolveJournalAccessContext } from "@/lib/journals/access";
import {
  canAssignPrompt,
  computeAssignmentDueState,
  isAssignmentOpen,
  labelForAssignmentStatus,
} from "@/lib/journals/prompt-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { JournalAssignmentStatus, RoleType } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function normalizeStatusFilter(
  rawValue: string | string[] | undefined,
): "open" | "completed" | "all" {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (value === "completed") return "completed";
  if (value === "all") return "all";
  return "open";
}

export default async function PromptAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const params = await searchParams;

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Prompt Assignments" description="View and respond to assigned journal prompts." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load assignments right now."} />
      </section>
    );
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  // Athletes see their own assignments; staff see all
  const isStaff = canAssignPrompt(accessContext);
  const isAthlete = accessContext.assignments.some((a) => a.roleType === RoleType.ATHLETE);
  const isGuardian = accessContext.assignments.some(
    (a) => a.roleType === RoleType.PARENT_GUARDIAN,
  );

  if (!isStaff && !isAthlete && !isGuardian) {
    return (
      <section className="space-y-4">
        <PageHeader title="Prompt Assignments" description="View and respond to assigned journal prompts." />
        <ErrorMessage message="You do not have permission to view prompt assignments." />
      </section>
    );
  }

  const statusFilter = normalizeStatusFilter(params.status);
  const now = new Date();

  const openStatuses = [JournalAssignmentStatus.ACTIVE, JournalAssignmentStatus.PENDING];
  const closedStatuses = [
    JournalAssignmentStatus.COMPLETED,
    JournalAssignmentStatus.CANCELLED,
    JournalAssignmentStatus.EXPIRED,
  ];

  // Build where clause depending on role
  const athleteTeamIds = isAthlete
    ? (
        await db.rosterMembership.findMany({
          where: {
            organizationId: scope.organizationId,
            personId: scope.auth.personId ?? "",
          },
          select: { teamId: true },
        })
      ).map((r) => r.teamId)
    : [];

  // Guardian-linked athlete IDs
  const guardianAthleteIds = Array.from(accessContext.linkedGuardianAthleteIds);

  const assignments = await db.journalAssignment.findMany({
    where: {
      organizationId: scope.organizationId,
      ...(statusFilter === "open"
        ? { status: { in: openStatuses } }
        : statusFilter === "completed"
          ? { status: { in: closedStatuses } }
          : {}),
      // Scope to actor's accessible assignments
      ...(!isStaff
        ? {
            OR: [
              // Direct athlete assignment
              ...(scope.auth.personId && isAthlete
                ? [{ assignedToAthletePersonId: scope.auth.personId }]
                : []),
              // Team assignment matching athlete's teams
              ...(athleteTeamIds.length > 0
                ? [{ assignedToTeamId: { in: athleteTeamIds } }]
                : []),
              // Guardian: see assignments for linked athletes
              ...(guardianAthleteIds.length > 0
                ? [{ assignedToAthletePersonId: { in: guardianAthleteIds } }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      dueAt: true,
      scheduledFor: true,
      createdAt: true,
      prompt: { select: { id: true, title: true, category: true } },
      assignedToAthlete: { select: { id: true, firstName: true, lastName: true } },
      assignedToTeam: { select: { id: true, name: true } },
      assignedBy: { select: { firstName: true, lastName: true } },
    },
    take: 300,
  });


  return (
    <section className="space-y-4">
      <PageHeader
        title="Prompt Assignments"
        description="Journal prompts assigned to athletes or teams."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/prompt-assignments?status=open"
              aria-current={statusFilter === "open" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                statusFilter === "open" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Open
            </Link>
            <Link
              href="/prompt-assignments?status=completed"
              aria-current={statusFilter === "completed" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                statusFilter === "completed" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Completed
            </Link>
            <Link
              href="/prompt-assignments?status=all"
              aria-current={statusFilter === "all" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                statusFilter === "all" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              All
            </Link>
            {isStaff ? (
              <Link
                href="/prompts"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Prompt library
              </Link>
            ) : null}
          </div>
        }
      />

      {assignments.length === 0 ? (
        <EmptyState
          message="No assignments found for the selected filter."
          actionHref={isStaff ? "/prompts" : "/journals"}
          actionLabel={isStaff ? "Go to prompt library" : "Back to journals"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Prompt</th>
                <th className="px-4 py-3 font-medium">Assigned to</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => {
                const target = assignment.assignedToAthlete
                  ? `${assignment.assignedToAthlete.firstName} ${assignment.assignedToAthlete.lastName}`.trim()
                  : assignment.assignedToTeam
                    ? `Team: ${assignment.assignedToTeam.name}`
                    : "—";

                const dueState = computeAssignmentDueState(assignment.status, assignment.dueAt, now);
                const open = isAssignmentOpen(assignment.status);

                // Determine if current user can respond: athlete assigned directly or via team
                const isDirectlyAssigned =
                  scope.auth.personId &&
                  assignment.assignedToAthlete?.id === scope.auth.personId;
                const isTeamAssigned =
                  assignment.assignedToTeam &&
                  athleteTeamIds.includes(assignment.assignedToTeam.id);
                const canRespond = isAthlete && open && (isDirectlyAssigned || isTeamAssigned);

                return (
                  <tr key={assignment.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/prompts/${assignment.prompt.id}`} className="underline">
                        {assignment.prompt.title}
                      </Link>
                      {assignment.prompt.category ? (
                        <p className="text-xs text-zinc-500">{assignment.prompt.category}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{target}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          dueState === "overdue"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : dueState === "due_soon"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                              : open
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {dueState === "overdue"
                          ? "Overdue"
                          : labelForAssignmentStatus(assignment.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {assignment.dueAt ? assignment.dueAt.toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {canRespond ? (
                        <Link
                          href={`/journals/create?promptId=${assignment.prompt.id}&assignmentId=${assignment.id}`}
                          className="rounded-md bg-black px-2.5 py-1 text-xs text-white dark:bg-white dark:text-black"
                        >
                          Respond
                        </Link>
                      ) : null}
                    </td>
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
