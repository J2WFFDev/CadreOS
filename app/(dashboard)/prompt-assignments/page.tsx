import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { labelForPromptAssignmentReadiness } from "@/lib/journals-habits/readiness-ux";
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
const DUE_SOON_WINDOW_DAYS = 3;

function normalizeStatusFilter(
  rawValue: string | string[] | undefined,
): "open" | "completed" | "all" {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (value === "completed") return "completed";
  if (value === "all") return "all";
  return "open";
}

function normalizeDueFilter(
  rawValue: string | string[] | undefined,
): "all" | "overdue" | "due_soon" | "no_due" {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (value === "overdue") return "overdue";
  if (value === "due_soon") return "due_soon";
  if (value === "no_due") return "no_due";
  return "all";
}

function normalizeSingle(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
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
  const dueFilter = normalizeDueFilter(params.due);
  const athleteFilter = normalizeSingle(params.athleteId);
  const teamFilter = normalizeSingle(params.teamId);
  const programFilter = normalizeSingle(params.programId);
  const now = new Date();
  const dueSoonThreshold = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);

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
        : {
            ...(athleteFilter ? { assignedToAthletePersonId: athleteFilter } : {}),
            ...(teamFilter ? { assignedToTeamId: teamFilter } : {}),
            ...(programFilter ? { assignedToTeam: { programId: programFilter } } : {}),
          }),
      ...(dueFilter === "overdue"
        ? { status: { in: openStatuses }, dueAt: { not: null, lt: now } }
        : dueFilter === "due_soon"
          ? { status: { in: openStatuses }, dueAt: { not: null, gte: now, lt: dueSoonThreshold } }
          : dueFilter === "no_due"
            ? { status: { in: openStatuses }, dueAt: null }
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
      assignedToTeam: { select: { id: true, name: true, programId: true, program: { select: { name: true } } } },
      assignedBy: { select: { firstName: true, lastName: true } },
    },
    take: 300,
  });

  const summaryCounts = assignments.reduce(
    (acc, assignment) => {
      const dueState = computeAssignmentDueState(assignment.status, assignment.dueAt, now);
      if (isAssignmentOpen(assignment.status)) acc.open += 1;
      if (!isAssignmentOpen(assignment.status)) acc.closed += 1;
      if (dueState === "overdue") acc.overdue += 1;
      if (dueState === "due_soon") acc.dueSoon += 1;
      return acc;
    },
    { open: 0, closed: 0, overdue: 0, dueSoon: 0 },
  );
  const athleteOptions = Array.from(
    new Map(
      assignments
        .filter((assignment) => Boolean(assignment.assignedToAthlete))
        .map((assignment) => [
          assignment.assignedToAthlete!.id,
          {
            id: assignment.assignedToAthlete!.id,
            label:
              `${assignment.assignedToAthlete!.firstName} ${assignment.assignedToAthlete!.lastName}`.trim() ||
              "Unknown",
          },
        ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));
  const teamOptions = Array.from(
    new Map(
      assignments
        .filter((assignment) => Boolean(assignment.assignedToTeam))
        .map((assignment) => [
          assignment.assignedToTeam!.id,
          { id: assignment.assignedToTeam!.id, label: assignment.assignedToTeam!.name },
        ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));
  const programOptions = Array.from(
    new Map(
      assignments
        .filter((assignment) => Boolean(assignment.assignedToTeam?.programId))
        .map((assignment) => [
          assignment.assignedToTeam!.programId!,
          {
            id: assignment.assignedToTeam!.programId!,
            label:
              assignment.assignedToTeam!.program?.name ??
              assignment.assignedToTeam!.programId!,
          },
        ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));

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
            <Link
              href={`/prompt-assignments?status=${statusFilter}&due=all`}
              aria-current={dueFilter === "all" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                dueFilter === "all" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              All due states
            </Link>
            <Link
              href={`/prompt-assignments?status=${statusFilter}&due=overdue`}
              aria-current={dueFilter === "overdue" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                dueFilter === "overdue" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Overdue
            </Link>
            <Link
              href={`/prompt-assignments?status=${statusFilter}&due=due_soon`}
              aria-current={dueFilter === "due_soon" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                dueFilter === "due_soon" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Due soon
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
      {isStaff ? (
        <form className="grid gap-2 rounded-lg border bg-white p-3 text-sm dark:bg-zinc-900 md:grid-cols-4" method="get">
          <input type="hidden" name="status" value={statusFilter} />
          <input type="hidden" name="due" value={dueFilter} />
          <label className="space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Athlete</span>
            <select name="athleteId" defaultValue={athleteFilter ?? ""} className="w-full rounded-md border px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
              <option value="">All visible athletes</option>
              {athleteOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Team</span>
            <select name="teamId" defaultValue={teamFilter ?? ""} className="w-full rounded-md border px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
              <option value="">All visible teams</option>
              {teamOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Program scope</span>
            <select name="programId" defaultValue={programFilter ?? ""} className="w-full rounded-md border px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
              <option value="">All visible programs</option>
              {programOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Apply
            </button>
            <Link href={`/prompt-assignments?status=${statusFilter}&due=${dueFilter}`} className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Reset
            </Link>
          </div>
        </form>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Open assignments</p>
          <p className="text-lg font-semibold">{summaryCounts.open}</p>
        </div>
        <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Closed assignments</p>
          <p className="text-lg font-semibold">{summaryCounts.closed}</p>
        </div>
        <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Overdue</p>
          <p className="text-lg font-semibold">{summaryCounts.overdue}</p>
        </div>
        <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Due soon</p>
          <p className="text-lg font-semibold">{summaryCounts.dueSoon}</p>
        </div>
      </div>

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
                <th className="px-4 py-3 font-medium">Readiness</th>
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
                      {isGuardian ? (
                        <span>{assignment.prompt.title}</span>
                      ) : (
                        <Link href={`/prompts/${assignment.prompt.id}`} className="underline">
                          {assignment.prompt.title}
                        </Link>
                      )}
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
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {labelForPromptAssignmentReadiness(dueState)}
                      </span>
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
