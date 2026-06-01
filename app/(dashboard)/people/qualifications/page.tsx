import { EligibilityTargetType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  ELIGIBILITY_TARGET_TYPE_LABELS,
  EXPIRING_SOON_WINDOW_DAYS,
  getExpirationState,
} from "@/lib/member-ops-qualifications";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function QualificationCatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Qualifications</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load qualification settings right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Qualifications</h2>
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
    workflow: "people.qualifications.access",
    entityType: "qualificationDefinition",
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Qualifications</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to manage qualification settings.
          </p>
        </div>
      </section>
    );
  }

  const [
    qualificationDefinitions,
    certificationDefinitions,
    eligibilityDefinitions,
    programs,
    teams,
    personQualifications,
    personCertifications,
  ] = await Promise.all([
    db.qualificationDefinition.findMany({
      where: { organizationId: scope.organizationId },
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.certificationDefinition.findMany({
      where: { organizationId: scope.organizationId },
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.eligibilityDefinition.findMany({
      where: { organizationId: scope.organizationId },
      include: {
        team: { select: { name: true } },
        program: { select: { name: true } },
        requiredQualifications: { include: { qualification: { select: { name: true } } } },
        requiredCertifications: { include: { certification: { select: { name: true } } } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.program.findMany({
      where: { organizationId: scope.organizationId },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
    db.team.findMany({
      where: { organizationId: scope.organizationId },
      select: { id: true, name: true, program: { select: { name: true } } },
      orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
    }),
    db.personQualification.findMany({
      where: { organizationId: scope.organizationId, expirationDate: { not: null } },
      select: { expirationDate: true },
    }),
    db.personCertification.findMany({
      where: { organizationId: scope.organizationId, expirationDate: { not: null } },
      select: { expirationDate: true },
    }),
  ]);

  const now = new Date();
  const qualificationExpiringSoonCount = personQualifications.filter(
    (record) => getExpirationState(record.expirationDate, now) === "expiringSoon",
  ).length;
  const qualificationExpiredCount = personQualifications.filter(
    (record) => getExpirationState(record.expirationDate, now) === "expired",
  ).length;
  const certificationExpiringSoonCount = personCertifications.filter(
    (record) => getExpirationState(record.expirationDate, now) === "expiringSoon",
  ).length;
  const certificationExpiredCount = personCertifications.filter(
    (record) => getExpirationState(record.expirationDate, now) === "expired",
  ).length;

  const error = readSearchParam(resolvedSearchParams, "error");
  const success = readSearchParam(resolvedSearchParams, "success");

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/people" label="Members" />
        <h2 className="text-2xl font-semibold tracking-tight">Qualifications, certifications, and eligibility</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Configure MemberOps qualification models, certification models, and simple eligibility foundations.
        </p>
      </div>

      {success ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/40">
          <p className="text-sm text-green-900 dark:text-green-200">{success}</p>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{error}</p>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-medium">Expiration visibility</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Qualification assignments expiring in the next {EXPIRING_SOON_WINDOW_DAYS} days: {qualificationExpiringSoonCount} · Expired: {qualificationExpiredCount}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Certification assignments expiring in the next {EXPIRING_SOON_WINDOW_DAYS} days: {certificationExpiringSoonCount} · Expired: {certificationExpiredCount}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div>
            <h3 className="text-lg font-medium">Qualification model</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create organization-level qualification definitions for member assignment and eligibility.
            </p>
          </div>
          <form action="/people/qualifications/create" method="post" className="grid gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Qualification name</span>
              <input name="name" required className="w-full rounded-md border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Description</span>
              <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Qualification type</span>
              <input name="qualificationType" required placeholder="Safety, Team Eligibility, Coach Certification…" className="w-full rounded-md border px-3 py-2" />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="supportsTeamParticipation" />
                Supports team participation
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="supportsProgramParticipation" />
                Supports program participation
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="supportsEquipmentEligibility" />
                Supports equipment eligibility
              </label>
            </div>
            <button type="submit" className="w-fit rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              Create qualification
            </button>
          </form>
          <div className="space-y-2">
            {qualificationDefinitions.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No qualifications defined yet.</p>
            ) : (
              qualificationDefinitions.map((qualification) => (
                <div key={qualification.id} className="rounded-md border p-3">
                  <p className="font-medium">{qualification.name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {qualification.qualificationType} · {qualification.active ? "Active" : "Inactive"} · Assigned to {qualification._count.assignments} member{qualification._count.assignments === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Supports: {[
                      qualification.supportsTeamParticipation ? "Team participation" : null,
                      qualification.supportsProgramParticipation ? "Program participation" : null,
                      qualification.supportsEquipmentEligibility ? "Equipment eligibility" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "General use"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div>
            <h3 className="text-lg font-medium">Certification model</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create reusable certification definitions for verification and expiration tracking.
            </p>
          </div>
          <form action="/people/certifications/create" method="post" className="grid gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Certification name</span>
              <input name="name" required className="w-full rounded-md border px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Issuing organization</span>
              <input name="issuingOrganization" placeholder="SASP, NRA, Red Cross…" className="w-full rounded-md border px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked />
              Active
            </label>
            <button type="submit" className="w-fit rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              Create certification
            </button>
          </form>
          <div className="space-y-2">
            {certificationDefinitions.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No certifications defined yet.</p>
            ) : (
              certificationDefinitions.map((certification) => (
                <div key={certification.id} className="rounded-md border p-3">
                  <p className="font-medium">{certification.name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {certification.issuingOrganization ?? "Issuing organization not set"} · {certification.active ? "Active" : "Inactive"} · Assigned to {certification._count.assignments} member{certification._count.assignments === 1 ? "" : "s"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div>
          <h3 className="text-lg font-medium">Eligibility model</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Create simple eligibility definitions for teams, programs, equipment, activities, and responsibilities.
          </p>
        </div>
        <form action="/people/eligibility/create" method="post" className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="font-medium">Eligibility name</span>
            <input name="name" required className="w-full rounded-md border px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="font-medium">Description</span>
            <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Target type</span>
            <select name="targetType" defaultValue={EligibilityTargetType.TEAM} className="w-full rounded-md border px-3 py-2">
              {Object.values(EligibilityTargetType).map((targetType) => (
                <option key={targetType} value={targetType}>
                  {ELIGIBILITY_TARGET_TYPE_LABELS[targetType]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Target label</span>
            <input name="targetLabel" placeholder="Rifle Team, Event Safety Role, Rifle Bay…" className="w-full rounded-md border px-3 py-2" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Program</span>
            <select name="programId" defaultValue="" className="w-full rounded-md border px-3 py-2">
              <option value="">Not scoped to a specific program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Team</span>
            <select name="teamId" defaultValue="" className="w-full rounded-md border px-3 py-2">
              <option value="">Not scoped to a specific team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.program.name} · {team.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Required qualifications</legend>
            {qualificationDefinitions.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Create a qualification first.</p>
            ) : (
              qualificationDefinitions.map((qualification) => (
                <label key={qualification.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="qualificationIds" value={qualification.id} />
                  {qualification.name}
                </label>
              ))
            )}
          </fieldset>
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Required certifications</legend>
            {certificationDefinitions.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Create a certification first.</p>
            ) : (
              certificationDefinitions.map((certification) => (
                <label key={certification.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="certificationIds" value={certification.id} />
                  {certification.name}
                </label>
              ))
            )}
          </fieldset>
          <label className="flex items-center gap-2 text-sm lg:col-span-2">
            <input type="checkbox" name="active" defaultChecked />
            Active
          </label>
          <div className="lg:col-span-2">
            <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              Create eligibility rule
            </button>
          </div>
        </form>
        <div className="space-y-2">
          {eligibilityDefinitions.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No eligibility rules defined yet.</p>
          ) : (
            eligibilityDefinitions.map((eligibility) => (
              <div key={eligibility.id} className="rounded-md border p-3">
                <p className="font-medium">{eligibility.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {ELIGIBILITY_TARGET_TYPE_LABELS[eligibility.targetType]} ·{" "}
                  {eligibility.team?.name ?? eligibility.program?.name ?? eligibility.targetLabel ?? "General"} ·{" "}
                  {eligibility.active ? "Active" : "Inactive"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Requires: {[
                    ...eligibility.requiredQualifications.map((requirement) => requirement.qualification.name),
                    ...eligibility.requiredCertifications.map((requirement) => requirement.certification.name),
                  ].join(" · ") || "No requirements yet"}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Member assignment and eligibility summaries are available from each member detail page.
        {" "}
        <Link href="/people" className="underline">
          Return to Members
        </Link>
        .
      </p>
    </section>
  );
}
