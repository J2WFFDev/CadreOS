import { MemberLifecycleStatus } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { db } from "@/lib/db";
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

export default async function SeasonRolloverPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string; seasonId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { programId, seasonId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Season rollover</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load season rollover workflow right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Season rollover</h2>
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
    workflow: "season.rollover.access",
    entityType: "season",
    entityId: seasonId,
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Season rollover</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to perform season rollovers.
          </p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let sourceSeason: { id: string; name: string; program: { id: string; name: string } } | null = null;
  let availableTargetSeasons: Array<{ id: string; name: string }> = [];

  try {
    sourceSeason = await db.season.findFirst({
      where: {
        id: seasonId,
        organizationId: scope.organizationId,
        programId,
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
    });

    if (sourceSeason) {
      availableTargetSeasons = await db.season.findMany({
        where: {
          organizationId: scope.organizationId,
          programId,
          id: { not: seasonId },
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      });
    }
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Season rollover</h2>
        <ErrorMessage message="Unable to load season rollover workflow right now. Please try again later." />
      </section>
    );
  }

  if (!sourceSeason) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Season rollover</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Season not found in the selected organization and program.
          </p>
        </div>
        <Link href={`/programs/${programId}`} className="text-sm underline">
          Back to program
        </Link>
      </section>
    );
  }

  const selectedTargetSeasonId = readSearchParam(resolvedSearchParams, "targetSeasonId") || availableTargetSeasons[0]?.id || "";
  const includeInactive = readSearchParam(resolvedSearchParams, "includeInactive") === "1";
  const generalError = readSearchParam(resolvedSearchParams, "error");

  let eligibleMemberships: Array<{
    id: string;
    rosterRole: string;
    person: { id: string; firstName: string; lastName: string; lifecycleStatus: string };
    team: { id: string; name: string };
  }> = [];

  let eligibleQueryFailed = false;

  try {
    const lifecycleFilter = includeInactive
      ? { lifecycleStatus: { not: MemberLifecycleStatus.ARCHIVED } }
      : { lifecycleStatus: { notIn: [MemberLifecycleStatus.ARCHIVED, MemberLifecycleStatus.INACTIVE] } };

    eligibleMemberships = await db.rosterMembership.findMany({
      where: {
        organizationId: scope.organizationId,
        seasonId,
        person: lifecycleFilter,
      },
      select: {
        id: true,
        rosterRole: true,
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            lifecycleStatus: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ team: { name: "asc" } }, { person: { lastName: "asc" } }, { person: { firstName: "asc" } }],
    });
  } catch {
    eligibleQueryFailed = true;
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href={`/programs/${programId}`} label="Program" />
        <h2 className="text-2xl font-semibold tracking-tight">Season rollover</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {sourceSeason.program.name} · Source season: {sourceSeason.name}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900 space-y-2">
        <h3 className="text-base font-medium">What this does</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Season rollover creates new roster membership records in the target season for all eligible members from the source season. Source season membership records are preserved without modification. Person lifecycle status, role assignments, guardian relationships, notes, tasks, attendance, FieldOps, and GearOps records are unchanged.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Members with status <span className="font-medium">Archived</span> are always excluded. Members with status <span className="font-medium">Inactive</span> are excluded by default unless you choose to include them. Members who already have a roster membership in the target season for the same team are skipped.
        </p>
      </div>

      <form
        action={`/programs/${programId}/seasons/${seasonId}/rollover`}
        method="get"
        className="rounded-lg border bg-white p-4 dark:bg-zinc-900 space-y-4"
      >
        <h3 className="text-base font-medium">Preview eligible members</h3>
        <div className="space-y-1">
          <label htmlFor="targetSeasonId" className="text-sm font-medium">
            Target season
          </label>
          {availableTargetSeasons.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No other seasons exist in this program. Create a target season before rolling over.
            </p>
          ) : (
            <select
              id="targetSeasonId"
              name="targetSeasonId"
              defaultValue={selectedTargetSeasonId}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select a target season</option>
              {availableTargetSeasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="includeInactive"
            name="includeInactive"
            type="checkbox"
            value="1"
            defaultChecked={includeInactive}
            className="rounded"
          />
          <label htmlFor="includeInactive" className="text-sm">
            Include members with Inactive status
          </label>
        </div>

        <button
          type="submit"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Refresh preview
        </button>
      </form>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900 space-y-3">
        <h3 className="text-base font-medium">
          Eligible members
          {!eligibleQueryFailed ? (
            <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
              ({eligibleMemberships.length} {eligibleMemberships.length === 1 ? "member" : "members"})
            </span>
          ) : null}
        </h3>

        {eligibleQueryFailed ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Unable to load eligible member preview right now.
          </p>
        ) : eligibleMemberships.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No eligible members found in the source season with the current filter settings.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {eligibleMemberships.map((membership) => (
              <li key={membership.id} className="flex flex-wrap items-center gap-1 text-zinc-700 dark:text-zinc-300">
                <span>
                  {membership.person.firstName} {membership.person.lastName}
                </span>
                <span className="text-zinc-400">·</span>
                <span>{membership.team.name}</span>
                <span className="text-zinc-400">·</span>
                <span>{formatEnumLabel(membership.rosterRole)}</span>
                <span className="text-zinc-400">·</span>
                <span className="text-zinc-500">{formatEnumLabel(membership.person.lifecycleStatus)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {availableTargetSeasons.length > 0 && selectedTargetSeasonId ? (
        <form
          action={`/programs/${programId}/seasons/${seasonId}/rollover/execute`}
          method="post"
          className="rounded-lg border bg-white p-4 dark:bg-zinc-900 space-y-4"
        >
          <h3 className="text-base font-medium">Confirm and execute rollover</h3>

          <input type="hidden" name="targetSeasonId" value={selectedTargetSeasonId} />
          <input type="hidden" name="includeInactive" value={includeInactive ? "1" : ""} />
          <input type="hidden" name="confirm" value="1" />

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Rolling over <span className="font-medium">{eligibleQueryFailed ? "eligible" : eligibleMemberships.length.toString()}</span>{" "}
            {!eligibleQueryFailed && eligibleMemberships.length === 1 ? "member" : "members"} from{" "}
            <span className="font-medium">{sourceSeason.name}</span> to{" "}
            <span className="font-medium">
              {availableTargetSeasons.find((s) => s.id === selectedTargetSeasonId)?.name ?? selectedTargetSeasonId}
            </span>
            . This will create new target-season membership records and preserve all source-season records.
          </p>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              Execute rollover
            </button>
            <Link
              href={`/programs/${programId}`}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </Link>
          </div>
        </form>
      ) : (
        <div className="flex gap-3">
          <Link
            href={`/programs/${programId}`}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Back to program
          </Link>
        </div>
      )}
    </section>
  );
}
