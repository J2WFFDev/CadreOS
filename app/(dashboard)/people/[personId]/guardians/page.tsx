import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
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

export default async function PersonGuardiansPage({
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
        <h2 className="text-2xl font-semibold tracking-tight">Guardian relationships</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load guardian relationship maintenance right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Guardian relationships</h2>
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
    workflow: "people.guardians.access",
    entityType: "person",
    entityId: personId,
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Guardian relationships</h2>
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
        <h2 className="text-2xl font-semibold tracking-tight">Guardian relationships</h2>
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
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;
  const canEditGuardianLinkageWhereSupported = guardianAccess.canEditGuardianLinkageWhereSupported;

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
          team: { id: string; name: string; program: { id: string; name: string } };
        }>;
        athleteLinks: Array<{
          id: string;
          relationshipType: string;
          guardian: {
            id: string;
            firstName: string;
            lastName: string;
            email: string | null;
            phone: string | null;
          };
        }>;
        guardianLinks: Array<{
          id: string;
          relationshipType: string;
          athlete: {
            id: string;
            firstName: string;
            lastName: string;
            email: string | null;
            phone: string | null;
          };
        }>;
      }
    | null = null;

  try {
    person = await db.person.findFirst({
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
                name: true,
                program: { select: { id: true, name: true } },
              },
            },
          },
        },
        athleteLinks: {
          orderBy: [{ guardian: { lastName: "asc" } }, { guardian: { firstName: "asc" } }],
          select: {
            id: true,
            relationshipType: true,
            guardian: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        guardianLinks: {
          orderBy: [{ athlete: { lastName: "asc" } }, { athlete: { firstName: "asc" } }],
          select: {
            id: true,
            relationshipType: true,
            athlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Guardian relationships</h2>
        <ErrorMessage message="Unable to load guardian relationship maintenance right now. Please try again later." />
      </section>
    );
  }

  if (!person) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Guardian relationships</h2>
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
    workflow: "people.guardians.scope",
    entityType: "person",
    entityId: person.id,
  });

  if (!personAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Guardian relationships</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have access to this person within your current team/program scope.
          </p>
        </div>
      </section>
    );
  }

  const visibleAthleteLinks = person.athleteLinks;
  const visibleGuardianLinks = person.guardianLinks;

  const guardianSuccess = readSearchParam(resolvedSearchParams, "guardianSuccess");
  const guardianError = readSearchParam(resolvedSearchParams, "guardianError");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <BackLink href={`/people/${person.id}`} label="Person detail" />
        <h2 className="text-2xl font-semibold tracking-tight">Guardian relationship maintenance</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {person.firstName} {person.lastName}
        </p>
      </div>

      {guardianSuccess ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/40">
          <p className="text-sm text-green-900 dark:text-green-200">{guardianSuccess}</p>
        </div>
      ) : null}
      {guardianError ? <ErrorMessage message={guardianError} /> : null}

      {!canViewGuardianRelationshipDetails ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Guardian relationship details are hidden for this account.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Relationship type is modeled as Parent or Guardian. Primary/emergency indicators and contact-permission
              notes are deferred and not yet modeled in this phase.
            </p>
            {canEditGuardianLinkageWhereSupported ? (
              <Link
                href={`/people/${person.id}/guardians/new`}
                className="mt-3 inline-block rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
              >
                Add guardian relationship
              </Link>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                You do not have permission to create or update guardian relationships.
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="mb-2 text-lg font-medium">As athlete/member: linked guardians</h3>
            {visibleAthleteLinks.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No guardian relationships are linked to this person as an athlete/member.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {visibleAthleteLinks.map((link) => (
                  <li key={link.id} className="rounded-md border p-3">
                    <p className="font-medium">
                      <Link href={`/people/${link.guardian.id}`} className="underline">
                        {link.guardian.firstName} {link.guardian.lastName}
                      </Link>
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">Relationship type: {formatEnumLabel(link.relationshipType)}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">Email: {link.guardian.email ?? "No email on file"}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">Phone: {link.guardian.phone ?? "No phone on file"}</p>
                    {canEditGuardianLinkageWhereSupported ? (
                      <Link
                        href={`/people/${person.id}/guardians/${link.id}/edit`}
                        className="mt-2 inline-block rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        Edit relationship
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="mb-2 text-lg font-medium">As guardian: linked athletes</h3>
            {visibleGuardianLinks.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No athlete relationships are linked to this person as a guardian.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {visibleGuardianLinks.map((link) => (
                  <li key={link.id} className="rounded-md border p-3">
                    <p className="font-medium">
                      <Link href={`/people/${link.athlete.id}`} className="underline">
                        {link.athlete.firstName} {link.athlete.lastName}
                      </Link>
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">Relationship type: {formatEnumLabel(link.relationshipType)}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">Email: {link.athlete.email ?? "No email on file"}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">Phone: {link.athlete.phone ?? "No phone on file"}</p>
                    {canEditGuardianLinkageWhereSupported ? (
                      <Link
                        href={`/people/${link.athlete.id}/guardians/${link.id}/edit`}
                        className="mt-2 inline-block rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        Open athlete edit workflow
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
