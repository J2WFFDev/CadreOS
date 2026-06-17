import Link from "next/link";
import { ProgramParticipationStatus } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { buildProgramParticipationReviewWhere } from "@/lib/member-ops-program-participation";
import {
  formatMemberOpsPeopleSetupIncompleteMessage,
  logMemberOpsPeopleSchemaIssue,
} from "@/lib/member-ops-schema-guard";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

const PARTICIPATION_LOAD_ERROR_MESSAGE =
  "Unable to load program participation records right now. Please try again later.";

function formatPersonName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatParticipationStatus(status: ProgramParticipationStatus) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function MemberOpsProgramParticipationPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program Participation</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query program participation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program Participation</h2>
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
    workflow: "member-ops.program-participation.access",
    entityType: "programParticipation",
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program Participation</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view MemberOps program participation.
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
        <h2 className="text-2xl font-semibold tracking-tight">Program Participation</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your role scope is incomplete for safe program participation visibility. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  let participationRecords:
    | Array<{
        id: string;
        status: ProgramParticipationStatus;
        createdAt: Date;
        updatedAt: Date;
        person: { id: string; firstName: string; lastName: string };
        program: { id: string; name: string };
        season: { id: string; name: string } | null;
      }>
    | null = null;
  let participationLoadErrorMessage: string | null = null;

  try {
    participationRecords = await db.programParticipation.findMany({
      where: buildProgramParticipationReviewWhere({
        organizationId: scope.organizationId,
        staffScopeResolution,
      }),
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        person: { select: { id: true, firstName: true, lastName: true } },
        program: { select: { id: true, name: true } },
        season: { select: { id: true, name: true } },
      },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
    });
  } catch (error) {
    const schemaIssue = logMemberOpsPeopleSchemaIssue("member-ops.program-participation", error, {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
    });
    participationLoadErrorMessage = schemaIssue
      ? formatMemberOpsPeopleSetupIncompleteMessage(schemaIssue)
      : PARTICIPATION_LOAD_ERROR_MESSAGE;
    if (!schemaIssue) {
      console.error("[member-ops.program-participation] Failed to load participation records", {
        organizationId: scope.organizationId,
        actorPersonId: scope.auth.personId,
        error,
      });
    }
    participationRecords = null;
  }

  if (!participationRecords) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program Participation</h2>
        <ErrorMessage message={participationLoadErrorMessage ?? PARTICIPATION_LOAD_ERROR_MESSAGE} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Program Participation"
        description="Review explicit first-class program participation records in the current MemberOps staff scope."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/member-ops/lifecycle" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Lifecycle
            </Link>
            <Link href="/member-ops/reports" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Reports
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-base font-medium">Read-only management foundation</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          ProgramParticipation is first-class program membership context. Existing role and roster behavior remains valid, and lifecycle automation, mutation workflow, and automatic backfill remain future work.
        </p>
      </div>

      {participationRecords.length === 0 ? (
        <EmptyState message="No explicit program participation records are visible in the current MemberOps scope." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Season</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {participationRecords.map((record) => (
                <tr key={record.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/people/${record.person.id}`} className="underline">
                      {formatPersonName(record.person)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/programs/${record.program.id}`} className="underline">
                      {record.program.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {record.season ? record.season.name : "Evergreen"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatParticipationStatus(record.status)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatDate(record.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatDate(record.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
