import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { formatDateInputValue } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function EditSeasonPage({
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
        <h2 className="text-2xl font-semibold tracking-tight">Edit season</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load season edit right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit season</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let program: { id: string; name: string } | null = null;
  let season: { id: string; name: string; startDate: Date | null; endDate: Date | null } | null = null;

  try {
    [program, season] = await Promise.all([
      db.program.findFirst({
        where: {
          id: programId,
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          name: true,
        },
      }),
      db.season.findFirst({
        where: {
          id: seasonId,
          programId,
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      }),
    ]);
  } catch {
    program = null;
    season = null;
  }

  if (!program || !season) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit season</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load season right now. It may not exist in the selected program and organization.
          </p>
        </div>
      </section>
    );
  }

  const name = readSearchParam(resolvedSearchParams, "name") || season.name;
  const startDate = readSearchParam(resolvedSearchParams, "startDate") || formatDateInputValue(season.startDate);
  const endDate = readSearchParam(resolvedSearchParams, "endDate") || formatDateInputValue(season.endDate);
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit season</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Program: {program.name}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{generalError}</p>
        </div>
      ) : null}

      <form
        action={`/programs/${program.id}/seasons/${season.id}/edit/update`}
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Season name
          </label>
          <input id="name" name="name" defaultValue={name} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "nameError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "nameError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="startDate" className="text-sm font-medium">
            Start date (optional)
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={startDate}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "startDateError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "startDateError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="endDate" className="text-sm font-medium">
            End date (optional)
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={endDate}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "endDateError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "endDateError")}</p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Save season
          </button>
          <Link href={`/programs/${program.id}`} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
