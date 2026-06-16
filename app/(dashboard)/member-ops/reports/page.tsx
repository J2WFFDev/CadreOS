import Link from "next/link";
import {
  CertificationVerificationStatus,
  MemberLifecycleStatus,
  QualificationAssignmentStatus,
} from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
  type StaffScopeResolution,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  buildMemberOpsLifecycleReportRows,
  buildMemberOpsProgramCoverageRows,
  buildMemberOpsRoleReportRows,
  buildMemberOpsTeamCoverageRows,
  countExpiringSoonMemberOpsRecords,
  summarizeMemberOpsCertificationRecords,
  summarizeMemberOpsQualificationRecords,
} from "@/lib/member-ops-reports";
import {
  EXPIRING_SOON_WINDOW_DAYS,
} from "@/lib/member-ops-qualifications";
import {
  formatMemberOpsOptionalFeatureUnavailableMessage,
  formatMemberOpsPeopleSetupIncompleteMessage,
  logMemberOpsPeopleSchemaIssue,
} from "@/lib/member-ops-schema-guard";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

const REPORTS_LOAD_ERROR_MESSAGE = "Unable to load MemberOps reports right now. Please try again later.";

function matchesScopedTeamOrProgram(
  staffScopeResolution: StaffScopeResolution,
  teamId: string | null,
  programId: string | null,
) {
  if (staffScopeResolution.allowAllStaffScope) {
    return true;
  }

  if (teamId && staffScopeResolution.allowedTeamIds.includes(teamId)) {
    return true;
  }

  if (programId && staffScopeResolution.allowedProgramIds.includes(programId)) {
    return true;
  }

  return false;
}

function SummaryCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function CountTable({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: Array<{ key: string; label: string; count: number }>;
  emptyMessage: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white dark:bg-zinc-900">
      <div className="border-b px-4 py-3">
        <h3 className="text-base font-medium">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-zinc-600 dark:text-zinc-400">{emptyMessage}</p>
      ) : (
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b last:border-b-0">
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.label}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CountList({
  rows,
  emptyMessage,
}: {
  rows: Array<{ key: string; label: string; count: number }>;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">{emptyMessage}</p>;
  }

  return (
    <div className="divide-y text-sm">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3 py-2">
          <span className="text-zinc-700 dark:text-zinc-300">{row.label}</span>
          <span className="font-medium">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

export default async function MemberOpsReportsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Member Reports</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query MemberOps reports right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Member Reports</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
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
  const staffAccessDecision = evaluateStaffOnlyContentAccess(actorRoleContext);
  logAuthorizationDecision(staffAccessDecision, {
    workflow: "member-ops.reports.access",
    entityType: "person",
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Member Reports</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view MemberOps reports.
          </p>
        </div>
      </section>
    );
  }

  const staffScopeResolution = resolveStaffScopeResolution(actorRoleContext);
  if (
    !staffScopeResolution.allowAllStaffScope &&
    (staffScopeResolution.hasAmbiguousScopeAssignments || !staffScopeResolution.hasExplicitScopedAccess)
  ) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Member Reports</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your role scope is incomplete for safe MemberOps report visibility. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  let people:
    | Array<{
        id: string;
        lifecycleStatus: MemberLifecycleStatus;
        roles: Array<{
          roleType: string;
          program: { id: string; name: string } | null;
          team: { id: string; name: string; program: { id: string; name: string } | null } | null;
        }>;
        roster: Array<{
          rosterRole: string;
          team: { id: string; name: string; program: { id: string; name: string } };
        }>;
      }>
    | null = null;
  let peopleLoadErrorMessage: string | null = null;

  try {
    people = await db.person.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(staffScopeResolution.allowAllStaffScope
          ? {}
          : {
              OR: [
                ...(staffScopeResolution.allowedTeamIds.length > 0
                  ? [{ roster: { some: { organizationId: scope.organizationId, teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                  : []),
                ...(staffScopeResolution.allowedTeamIds.length > 0
                  ? [{ roles: { some: { organizationId: scope.organizationId, teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                  : []),
                ...(staffScopeResolution.allowedProgramIds.length > 0
                  ? [{ roster: { some: { organizationId: scope.organizationId, team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                  : []),
                ...(staffScopeResolution.allowedProgramIds.length > 0
                  ? [{ roles: { some: { organizationId: scope.organizationId, programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                  : []),
                ...(staffScopeResolution.allowedProgramIds.length > 0
                  ? [{ roles: { some: { organizationId: scope.organizationId, team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                  : []),
              ],
            }),
      },
      select: {
        id: true,
        lifecycleStatus: true,
        roles: {
          select: {
            roleType: true,
            program: { select: { id: true, name: true } },
            team: {
              select: {
                id: true,
                name: true,
                program: { select: { id: true, name: true } },
              },
            },
          },
        },
        roster: {
          select: {
            rosterRole: true,
            team: {
              select: {
                id: true,
                name: true,
                program: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    people = people.map((person) => ({
      ...person,
      roles: person.roles.filter((assignment) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          assignment.team?.id ?? null,
          assignment.program?.id ?? assignment.team?.program?.id ?? null,
        ),
      ),
      roster: person.roster.filter((membership) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          membership.team.id,
          membership.team.program.id,
        ),
      ),
    }));
  } catch (error) {
    const schemaIssue = logMemberOpsPeopleSchemaIssue("member-ops.reports", error, {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
    });
    peopleLoadErrorMessage = schemaIssue
      ? formatMemberOpsPeopleSetupIncompleteMessage(schemaIssue)
      : REPORTS_LOAD_ERROR_MESSAGE;
    if (!schemaIssue) {
      console.error("[member-ops.reports] Failed to load reports overview", {
        organizationId: scope.organizationId,
        actorPersonId: scope.auth.personId,
        error,
      });
    }
    people = null;
  }

  if (!people) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Member Reports</h2>
        <ErrorMessage message={peopleLoadErrorMessage ?? REPORTS_LOAD_ERROR_MESSAGE} />
      </section>
    );
  }

  const visiblePersonIds = people.map((person) => person.id);
  let qualificationRecords: Array<{ status: QualificationAssignmentStatus; expirationDate: Date | null }> = [];
  let certificationRecords: Array<{ verificationStatus: CertificationVerificationStatus; expirationDate: Date | null }> = [];
  let qualificationSummaryMessage: string | null = null;

  if (visiblePersonIds.length > 0) {
    try {
      [qualificationRecords, certificationRecords] = await Promise.all([
        db.personQualification.findMany({
          where: {
            organizationId: scope.organizationId,
            personId: { in: visiblePersonIds },
          },
          select: {
            status: true,
            expirationDate: true,
          },
        }),
        db.personCertification.findMany({
          where: {
            organizationId: scope.organizationId,
            personId: { in: visiblePersonIds },
          },
          select: {
            verificationStatus: true,
            expirationDate: true,
          },
        }),
      ]);
    } catch (error) {
      const schemaIssue = logMemberOpsPeopleSchemaIssue("member-ops.reports.qualifications", error, {
        organizationId: scope.organizationId,
        actorPersonId: scope.auth.personId,
        visiblePersonCount: visiblePersonIds.length,
      });
      qualificationSummaryMessage = schemaIssue
        ? formatMemberOpsOptionalFeatureUnavailableMessage(
            "Qualification and certification report summaries",
            schemaIssue,
          )
        : "Qualification and certification report summaries are temporarily unavailable right now.";
      if (!schemaIssue) {
        console.error("[member-ops.reports] Failed to load qualification report summaries", {
          organizationId: scope.organizationId,
          actorPersonId: scope.auth.personId,
          visiblePersonCount: visiblePersonIds.length,
          error,
        });
      }
    }
  }

  const lifecycleRows = buildMemberOpsLifecycleReportRows(people);
  const roleRows = buildMemberOpsRoleReportRows(people);
  const programRows = buildMemberOpsProgramCoverageRows(people);
  const teamRows = buildMemberOpsTeamCoverageRows(people);
  const qualificationRows = summarizeMemberOpsQualificationRecords(qualificationRecords);
  const certificationRows = summarizeMemberOpsCertificationRecords(certificationRecords);
  const rosterMembershipCount = people.reduce((count, person) => count + person.roster.length, 0);
  const roleAssignmentCount = people.reduce((count, person) => count + person.roles.length, 0);
  const expiringSoonQualificationCount = countExpiringSoonMemberOpsRecords(qualificationRecords);
  const expiringSoonCertificationCount = countExpiringSoonMemberOpsRecords(certificationRecords);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Member Reports"
        description="Read-only operational summaries for the current MemberOps staff scope."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/people" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Members
            </Link>
            <Link href="/programs" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Programs
            </Link>
            <Link href="/teams" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Teams
            </Link>
            <Link href="/member-ops/lifecycle" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Lifecycle
            </Link>
          </div>
        }
      />

      {people.length === 0 ? (
        <EmptyState message="No members are visible in the current MemberOps scope." actionHref="/people/new" actionLabel="Add a member" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-base font-medium">Read-only foundation</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Reports use existing people, lifecycle, role, roster, program, team, qualification, and certification data. Exports, advanced analytics, BI, and workflow automation remain future work.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Visible members" value={people.length} href="/people" />
            <SummaryCard label="Roster memberships" value={rosterMembershipCount} href="/teams" />
            <SummaryCard label="Scoped role assignments" value={roleAssignmentCount} href="/people" />
            <SummaryCard label="Programs represented" value={programRows.length} href="/programs" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <CountTable
              title="Lifecycle status"
              rows={lifecycleRows}
              emptyMessage="No lifecycle status data is available."
            />
            <CountTable
              title="Role / person type"
              rows={roleRows}
              emptyMessage="No role or roster-role data is available in the current scope."
            />
            <CountTable
              title="Program coverage"
              rows={programRows}
              emptyMessage="No program context is available in the current scope."
            />
            <CountTable
              title="Team coverage"
              rows={teamRows}
              emptyMessage="No team context is available in the current scope."
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium">Qualifications</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Expiring in the next {EXPIRING_SOON_WINDOW_DAYS} days: {expiringSoonQualificationCount}.
                  </p>
                </div>
                <Link href="/people/qualifications" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  Open
                </Link>
              </div>
              {qualificationSummaryMessage ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">{qualificationSummaryMessage}</p>
              ) : (
                <CountList
                  rows={qualificationRows}
                  emptyMessage="No qualification assignment data is available in the current scope."
                />
              )}
            </div>

            <div className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium">Certifications</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Expiring in the next {EXPIRING_SOON_WINDOW_DAYS} days: {expiringSoonCertificationCount}.
                  </p>
                </div>
                <Link href="/people/qualifications" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  Open
                </Link>
              </div>
              {qualificationSummaryMessage ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">{qualificationSummaryMessage}</p>
              ) : (
                <CountList
                  rows={certificationRows}
                  emptyMessage="No certification assignment data is available in the current scope."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
