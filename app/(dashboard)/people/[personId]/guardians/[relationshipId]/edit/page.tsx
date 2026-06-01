import { GuardianRelationshipRole, RelationshipType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import {
  evaluatePersonOperationalContentAccess,
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function hasSearchParam(searchParams: SearchParams, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(searchParams, key);
}

function derivePersonOperationalScope(person: {
  roles: Array<{
    program: { id: string } | null;
    team: { id: string; program: { id: string } | null } | null;
  }>;
  roster: Array<{
    team: { id: string; program: { id: string } };
  }>;
}) {
  return {
    teamIds: Array.from(
      new Set([
        ...person.roles.map((role) => role.team?.id ?? null),
        ...person.roster.map((membership) => membership.team.id),
      ].filter((value): value is string => Boolean(value))),
    ),
    programIds: Array.from(
      new Set([
        ...person.roles.map((role) => role.program?.id ?? role.team?.program?.id ?? null),
        ...person.roster.map((membership) => membership.team.program.id),
      ].filter((value): value is string => Boolean(value))),
    ),
  };
}

export default async function EditPersonGuardianRelationshipPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string; relationshipId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { personId, relationshipId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load guardian relationship workflow right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
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
    workflow: "people.guardians.edit.access",
    entityType: "person",
    entityId: personId,
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to guardian relationship maintenance.
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
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your role scope is incomplete for safe guardian relationship evaluation. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!guardianAccess.canEditGuardianLinkageWhereSupported) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have permission to update guardian relationships.
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
        roles: Array<{
          program: { id: string } | null;
          team: { id: string; program: { id: string } | null } | null;
        }>;
        roster: Array<{
          team: { id: string; program: { id: string } };
        }>;
      }
    | null = null;
  let relationship:
    | {
        id: string;
        relationshipType: string;
        guardianRole: string;
        guardianPersonId: string;
        guardian: { id: string; firstName: string; lastName: string; email: string | null };
      }
    | null = null;
  let guardians: Array<{ id: string; firstName: string; lastName: string; email: string | null }> = [];

  try {
    [person, relationship, guardians] = await Promise.all([
      db.person.findFirst({
        where: {
          id: personId,
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          roles: {
            select: {
              program: { select: { id: true } },
              team: {
                select: {
                  id: true,
                  program: { select: { id: true } },
                },
              },
            },
          },
          roster: {
            select: {
              team: {
                select: {
                  id: true,
                  program: { select: { id: true } },
                },
              },
            },
          },
        },
      }),
      db.athleteGuardianRelationship.findFirst({
        where: {
          id: relationshipId,
          organizationId: scope.organizationId,
          athletePersonId: personId,
        },
        select: {
          id: true,
          guardianPersonId: true,
          relationshipType: true,
          guardianRole: true,
          guardian: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      db.person.findMany({
        where: {
          organizationId: scope.organizationId,
          id: { not: personId },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <ErrorMessage message="Unable to load guardian relationship workflow right now. Please try again later." />
      </section>
    );
  }

  if (!person) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Person not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const personAccessDecision = evaluatePersonOperationalContentAccess(
    actorRoleContext,
    derivePersonOperationalScope(person),
  );
  logAuthorizationDecision(personAccessDecision, {
    workflow: "people.guardians.edit.scope",
    entityType: "person",
    entityId: person.id,
  });

  if (!personAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have access to this person within your current team/program scope.
          </p>
        </div>
      </section>
    );
  }

  if (!relationship) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Relationship not found for this person in the selected organization.
          </p>
          <div className="mt-3">
            <BackLink href={`/people/${person.id}/guardians`} label="Back to guardian relationships" />
          </div>
        </div>
      </section>
    );
  }

  const guardianPersonId = hasSearchParam(resolvedSearchParams, "guardianPersonId")
    ? readSearchParam(resolvedSearchParams, "guardianPersonId")
    : relationship.guardianPersonId;
  const relationshipType = hasSearchParam(resolvedSearchParams, "relationshipType")
    ? readSearchParam(resolvedSearchParams, "relationshipType")
    : relationship.relationshipType;
  const guardianRole = hasSearchParam(resolvedSearchParams, "guardianRole")
    ? readSearchParam(resolvedSearchParams, "guardianRole")
    : relationship.guardianRole;
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <BackLink href={`/people/${person.id}/guardians`} label="Guardian relationships" />
        <h2 className="text-2xl font-semibold tracking-tight">Edit guardian relationship</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Athlete/member: {person.firstName} {person.lastName}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Current guardian: {relationship.guardian.firstName} {relationship.guardian.lastName}
          {relationship.guardian.email ? ` · ${relationship.guardian.email}` : ""}
        </p>
      </div>

      <form
        action={`/people/${person.id}/guardians/${relationship.id}/edit/update`}
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="space-y-1">
          <label htmlFor="guardianPersonId" className="text-sm font-medium">
            Guardian person
          </label>
          <select
            id="guardianPersonId"
            name="guardianPersonId"
            defaultValue={guardianPersonId}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Select a guardian</option>
            {guardians.map((guardian) => (
              <option key={guardian.id} value={guardian.id}>
                {guardian.lastName}, {guardian.firstName} {guardian.email ? `· ${guardian.email}` : ""}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "guardianPersonIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "guardianPersonIdError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="relationshipType" className="text-sm font-medium">
            Relationship type
          </label>
          <select
            id="relationshipType"
            name="relationshipType"
            defaultValue={relationshipType}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(RelationshipType).map((value) => (
              <option key={value} value={value}>
                {formatEnumLabel(value)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "relationshipTypeError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "relationshipTypeError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="guardianRole" className="text-sm font-medium">
            Guardian role
          </label>
          <select
            id="guardianRole"
            name="guardianRole"
            defaultValue={guardianRole}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(GuardianRelationshipRole).map((value) => (
              <option key={value} value={value}>
                {formatEnumLabel(value)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "guardianRoleError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "guardianRoleError")}</p>
          ) : null}
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          This update preserves lifecycle status, roster history, role assignments, attendance, notes, tasks, FieldOps,
          and GearOps records.
        </p>

        <FormActions submitLabel="Update relationship" cancelHref={`/people/${person.id}/guardians`} />
      </form>
    </section>
  );
}
