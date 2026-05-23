import { AttendanceStatus, RoleType, ScopeType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { OperationalHistoryPanel } from "@/components/dashboard/operational-history-panel";
import { canReadStaffOnlyContent, resolveActorRoleContext } from "@/lib/authorization";
import { db } from "@/lib/db";
import { isUnresolvedTaskStatus } from "@/lib/follow-up-tasks";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { getOperationalHistory } from "@/lib/operational-history";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function hasSearchParam(searchParams: SearchParams, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(searchParams, key);
}

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function PersonDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { personId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query person details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div id="relationship-summary" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet.
          </p>
        </div>
      </section>
    );
  }

  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canReadStaffOnlyContent(actorRoleContext)) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view person operational workflows.
          </p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let person:
    | {
        id: string;
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
        roles: Array<{
          id: string;
          roleType: string;
          scopeType: string;
          program: { id: string; name: string } | null;
          team: { id: string; name: string; program: { id: string; name: string } | null } | null;
        }>;
        guardianLinks: Array<{
          id: string;
          relationshipType: string;
          athlete: { id: string; firstName: string; lastName: string };
        }>;
        athleteLinks: Array<{
          id: string;
          relationshipType: string;
          guardian: {
            id: string;
            firstName: string;
            lastName: string;
            _count: { userAccounts: number };
            roles: Array<{ id: string }>;
          };
        }>;
        roster: Array<{
          id: string;
          rosterRole: string;
          team: { id: string; name: string; program: { id: string; name: string } };
          season: { id: string; name: string };
        }>;
      }
    | null = null;
  let programs: Array<{ id: string; name: string }> = [];
  let teams: Array<{ id: string; name: string; program: { id: string; name: string } }> = [];
  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;
  const canEditGuardianLinkageWhereSupported = guardianAccess.canEditGuardianLinkageWhereSupported;

  try {
    [person, programs, teams] = await Promise.all([
      db.person.findFirst({
        where: {
          id: personId,
          organizationId: scope.organizationId,
        },
        include: {
          roles: {
            include: {
              program: {
                select: {
                  id: true,
                  name: true,
                },
              },
              team: {
                select: {
                  id: true,
                  name: true,
                  program: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ scopeType: "asc" }, { roleType: "asc" }, { createdAt: "asc" }],
          },
          guardianLinks: {
            include: {
              athlete: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: {
              athlete: {
                lastName: "asc",
              },
            },
          },
          athleteLinks: {
            include: {
              guardian: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  _count: {
                    select: {
                      userAccounts: true,
                    },
                  },
                  roles: {
                    where: {
                      organizationId: scope.organizationId,
                      roleType: RoleType.PARENT_GUARDIAN,
                    },
                    select: {
                      id: true,
                    },
                    take: 1,
                  },
                },
              },
            },
            orderBy: {
              guardian: {
                lastName: "asc",
              },
            },
          },
          roster: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  program: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              season: {
                select: { id: true, name: true },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      }),
      db.program.findMany({
        where: {
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ name: "asc" }],
      }),
      db.team.findMany({
        where: {
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          name: true,
          program: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
      }),
    ]);
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load person details right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (person === null) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Person not found in the selected organization.
          </p>
        </div>
      </section>
    );
  }

  const roleError = readSearchParam(resolvedSearchParams, "roleError");
  const roleTypeError = readSearchParam(resolvedSearchParams, "roleTypeError");
  const scopeTypeError = readSearchParam(resolvedSearchParams, "scopeTypeError");
  const programIdError = readSearchParam(resolvedSearchParams, "programIdError");
  const teamIdError = readSearchParam(resolvedSearchParams, "teamIdError");

  const selectedRoleType = (readSearchParam(resolvedSearchParams, "roleType") || RoleType.ATHLETE) as RoleType;
  const selectedScopeType = (readSearchParam(resolvedSearchParams, "scopeType") || ScopeType.ORGANIZATION) as ScopeType;
  const selectedProgramId = hasSearchParam(resolvedSearchParams, "programId")
    ? readSearchParam(resolvedSearchParams, "programId")
    : "";
  const selectedTeamId = hasSearchParam(resolvedSearchParams, "teamId")
    ? readSearchParam(resolvedSearchParams, "teamId")
    : "";
  const isAthleteProfile =
    person.roles.some((role) => role.roleType === RoleType.ATHLETE) ||
    person.roster.some((membership) => membership.rosterRole === RoleType.ATHLETE);
  const hasGuardianRelationship = canViewGuardianRelationshipDetails && person.athleteLinks.length > 0;
  const hasGuardianAccountLinkGap = person.athleteLinks.some(
    (link) => link.guardian._count.userAccounts === 0,
  );
  const hasInactiveGuardianAccountSignal = person.athleteLinks.some(
    (link) => link.guardian._count.userAccounts > 0 && link.guardian.roles.length === 0,
  );
  const hasPendingOrIncompleteRelationshipSupport = hasGuardianAccountLinkGap || hasInactiveGuardianAccountSignal;
  const personOperationalHistory = await getOperationalHistory({
    organizationId: scope.organizationId,
    personId: person.id,
    limit: 10,
    sinceDays: 45,
  });
  const rosterTeamIds = [...new Set(person.roster.map((membership) => membership.team.id))];
  const now = new Date();
  const upcomingWindowEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const [relatedTasks, relatedNotes, relatedAttendance, upcomingTeamEvents] = await Promise.all([
    db.followUpTask.findMany({
      where: {
        organizationId: scope.organizationId,
        OR: [
          { assigneePersonId: person.id },
          { createdByPersonId: person.id },
          { sourceNote: { is: { athletePersonId: person.id } } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        updatedAt: true,
        sourceEvent: { select: { id: true, title: true } },
        sourceNote: {
          select: {
            id: true,
            event: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
    }),
    db.observationNote.findMany({
      where: {
        organizationId: scope.organizationId,
        OR: [{ athletePersonId: person.id }, { authorPersonId: person.id }],
      },
      select: {
        id: true,
        body: true,
        updatedAt: true,
        event: { select: { id: true, title: true } },
        tasks: { select: { status: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
    }),
    db.attendanceRecord.findMany({
      where: {
        organizationId: scope.organizationId,
        personId: person.id,
      },
      select: {
        id: true,
        status: true,
        markedAt: true,
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            team: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ markedAt: "desc" }],
      take: 6,
    }),
    rosterTeamIds.length === 0
      ? Promise.resolve([])
      : db.event.findMany({
          where: {
            organizationId: scope.organizationId,
            teamId: { in: rosterTeamIds },
            startsAt: { gte: now, lte: upcomingWindowEndsAt },
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            status: true,
            team: { select: { id: true, name: true } },
            tasks: { select: { status: true } },
          },
          orderBy: [{ startsAt: "asc" }],
          take: 6,
        }),
  ]);
  const unresolvedRelatedTaskCount = relatedTasks.filter((task) => isUnresolvedTaskStatus(task.status)).length;
  const unresolvedRelatedNoteTaskCount = relatedNotes.reduce(
    (count, note) => count + note.tasks.filter((task) => isUnresolvedTaskStatus(task.status)).length,
    0,
  );
  const attendanceConcernCount = relatedAttendance.filter(
    (record) => record.status !== AttendanceStatus.PRESENT,
  ).length;
  const upcomingEventsWithOpenTasks = upcomingTeamEvents
    .map((event) => ({
      ...event,
      unresolvedTaskCount: event.tasks.filter((task) => isUnresolvedTaskStatus(task.status)).length,
    }))
    .filter((event) => event.unresolvedTaskCount > 0);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/people" label="People" />
        <h2 className="text-2xl font-semibold tracking-tight">
          {person.firstName} {person.lastName}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{person.email ?? "No email on file"}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{person.phone ?? "No phone on file"}</p>
        <Link href={`/people/${person.id}/edit`} className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Edit person
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-medium">Operational relationship summary</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Use this summary to see unresolved person-linked work, recent attendance context, and upcoming event impact in one place.
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Related notes</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{relatedNotes.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Related follow-up tasks</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{relatedTasks.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Unresolved related items</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {unresolvedRelatedTaskCount + unresolvedRelatedNoteTaskCount}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Recent attendance context</dt>
            <dd className={attendanceConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {relatedAttendance.length} records ({attendanceConcernCount} concerns)
            </dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming team events (14 days)</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{upcomingTeamEvents.length}</dd>
          </div>
          <div>
            <dt className="font-medium">Upcoming events with unresolved tasks</dt>
            <dd className={upcomingEventsWithOpenTasks.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
              {upcomingEventsWithOpenTasks.length}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href={`/notes?athletePersonId=${person.id}`} className="rounded-full border px-2 py-1">
            Person notes
          </Link>
          <Link href={`/notes?athletePersonId=${person.id}&readinessIndicator=needs_review`} className="rounded-full border px-2 py-1">
            Notes needing review
          </Link>
          <Link href={`/tasks?assigneePersonId=${person.id}&resolution=unresolved`} className="rounded-full border px-2 py-1">
            Unresolved person tasks
          </Link>
          <Link href={`/tasks?assigneePersonId=${person.id}&ownershipIndicator=stale_unresolved`} className="rounded-full border px-2 py-1">
            Stale unresolved tasks
          </Link>
          <Link href={`/events?ownerPersonId=${person.id}`} className="rounded-full border px-2 py-1">
            Person-created events
          </Link>
          <Link href={`/tasks?assigneePersonId=${person.id}&changedWindow=last_7d`} className="rounded-full border px-2 py-1">
            Recent related activity
          </Link>
          <Link href="#operational-history" className="rounded-full border px-2 py-1">
            Person change history
          </Link>
        </div>
        {relatedAttendance.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {relatedAttendance.slice(0, 3).map((record) => (
              <li key={record.id} className="rounded-md border p-2">
                <Link href={`/events/${record.event.id}#attendance-workflow`} className="font-medium underline">
                  {record.event.title}
                </Link>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {formatEnumLabel(record.status)} · {record.event.team ? `Team: ${record.event.team.name}` : "No team"} ·{" "}
                  {record.markedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Role assignments</h3>
        {person.roles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No role assignments.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {person.roles.map((role) => (
              <li key={role.id} className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                <span>
                  {formatEnumLabel(role.roleType)} · {formatEnumLabel(role.scopeType)}
                  {role.scopeType === ScopeType.PROGRAM
                    ? ` · Program: ${role.program?.name ?? "Unknown program"}`
                    : ""}
                  {role.scopeType === ScopeType.TEAM
                    ? ` · Team: ${role.team?.name ?? "Unknown team"}${role.team?.program?.name ? ` (${role.team.program.name})` : ""}`
                    : ""}
                </span>
                <form action={`/people/${person.id}/roles/${role.id}/delete`} method="post">
                  <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40">
                    Remove role
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="assign-role" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Assign role</h3>

        {roleError ? <p className="mb-3 text-sm text-red-600">{roleError}</p> : null}

        <form action={`/people/${person.id}/roles/create`} method="post" className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="roleType" className="text-sm font-medium">
              Role type
            </label>
            <select id="roleType" name="roleType" defaultValue={selectedRoleType} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(RoleType).map((roleType) => (
                <option key={roleType} value={roleType}>
                  {formatEnumLabel(roleType)}
                </option>
              ))}
            </select>
            {roleTypeError ? <p className="text-sm text-red-600">{roleTypeError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="scopeType" className="text-sm font-medium">
              Scope type
            </label>
            <select id="scopeType" name="scopeType" defaultValue={selectedScopeType} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(ScopeType).map((scopeType) => (
                <option key={scopeType} value={scopeType}>
                  {formatEnumLabel(scopeType)}
                </option>
              ))}
            </select>
            {scopeTypeError ? <p className="text-sm text-red-600">{scopeTypeError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="programId" className="text-sm font-medium">
              Program (required for PROGRAM scope)
            </label>
            <select id="programId" name="programId" defaultValue={selectedProgramId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            {programIdError ? <p className="text-sm text-red-600">{programIdError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="teamId" className="text-sm font-medium">
              Team (required for TEAM scope)
            </label>
            <select id="teamId" name="teamId" defaultValue={selectedTeamId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.program.name} · {team.name}
                </option>
              ))}
            </select>
            {teamIdError ? <p className="text-sm text-red-600">{teamIdError}</p> : null}
          </div>

          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Assign role
          </button>
        </form>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Guardian / athlete relationships</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Relationship records are visible here. Dedicated create/manage guardian relationship workflows are not yet
          exposed in this MVP slice.
        </p>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Relationship indicators on this page are staff-facing visibility diagnostics only. They do not grant guardian
          access to staff-only data, and onboarding/invitation workflows remain intentionally deferred.
        </p>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          View access: staff role assignments (Org Admin, Program Director, Coach, Assistant Coach). Edit support where
          available:{" "}
          {canEditGuardianLinkageWhereSupported
            ? "you have staff write coverage via existing person/roster/role assignment routes."
            : "staff write permissions are required via existing person/roster/role assignment routes."}
        </p>
        {!canViewGuardianRelationshipDetails ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Guardian relationship details are hidden for this account to prevent private relationship visibility leaks.
          </p>
        ) : isAthleteProfile ? (
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Athlete relationship status:{" "}
            {!hasGuardianRelationship
              ? "Missing guardian relationship."
              : hasPendingOrIncompleteRelationshipSupport
                ? "Guardian relationship exists, but pending/incomplete relationship support remains (missing link and/or inactive guardian account signal)."
                : "Guardian relationship linked and active guardian account signal detected."}
          </p>
        ) : (
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Relationship visibility is intentionally limited for non-athlete profiles.
          </p>
        )}
        {canViewGuardianRelationshipDetails &&
        person.guardianLinks.length === 0 &&
        person.athleteLinks.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No guardian/athlete relationships.</p>
        ) : canViewGuardianRelationshipDetails ? (
          <div className="space-y-3 text-sm">
            {person.guardianLinks.length > 0 ? (
              <div>
                <p className="font-medium">Guardian for</p>
                <ul className="mt-1 list-disc pl-5">
                  {person.guardianLinks.map((link) => (
                    <li key={link.id}>
                      {link.athlete.firstName} {link.athlete.lastName} ({formatEnumLabel(link.relationshipType)})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {person.athleteLinks.length > 0 ? (
              <div>
                <p className="font-medium">Athlete linked to guardians</p>
                <ul className="mt-1 list-disc pl-5">
                  {person.athleteLinks.map((link) => (
                    <li key={link.id}>
                      {link.guardian.firstName} {link.guardian.lastName} ({formatEnumLabel(link.relationshipType)}) ·{" "}
                      {link.guardian._count.userAccounts === 0
                        ? "Guardian account link missing"
                        : link.guardian.roles.length === 0
                          ? "Inactive guardian account signal (linked account, parent/guardian role assignment missing)"
                          : "Guardian account linked and active"}{" "}
                      ·{" "}
                      {link.guardian._count.userAccounts > 0 && link.guardian.roles.length > 0
                        ? "Relationship support complete"
                        : "Pending/incomplete relationship support"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Roster memberships</h3>
        {person.roster.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No roster memberships.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {person.roster.map((membership) => (
              <li key={membership.id}>
                Program:{" "}
                <Link href={`/programs/${membership.team.program.id}`} className="underline">
                  {membership.team.program.name}
                </Link>{" "}
                · Team:{" "}
                <Link href={`/teams/${membership.team.id}`} className="underline">
                  {membership.team.name}
                </Link>{" "}
                · Season: {membership.season.name} · Role:{" "}
                {formatEnumLabel(membership.rosterRole)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <OperationalHistoryPanel
        id="operational-history"
        title="Operational history"
        description="Recent person-linked activity derived from tasks, notes, attendance, roster membership, and role assignment context."
        emptyMessage="No recent person-linked operational history was found in the current review window."
        items={personOperationalHistory}
        action={{ href: `/tasks?assigneePersonId=${person.id}`, label: "Open assigned tasks" }}
        footer={
          <>
            Person history includes items where this person is the assignee, creator/author, participant, or direct
            roster/role subject when that context is derivable from current records.
          </>
        }
      />
    </section>
  );
}
