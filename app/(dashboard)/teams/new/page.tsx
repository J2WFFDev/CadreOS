import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { PageHeader } from "@/components/dashboard/page-header";
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

export default async function NewTeamPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New team</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load team creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New team</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let programs: Array<{ id: string; name: string }> | null = null;

  try {
    programs = await db.program.findMany({
      where: {
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  } catch {
    programs = null;
  }

  if (!programs) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New team</h2>
        <ErrorMessage message="Unable to load programs right now. Please try again later." />
      </section>
    );
  }

  const name = readSearchParam(resolvedSearchParams, "name");
  const selectedProgramId = readSearchParam(resolvedSearchParams, "programId");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <PageHeader title="New team" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />

      {generalError ? <ErrorMessage message={generalError} /> : null}

      {programs.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Add at least one program before creating teams.{" "}
          <Link href="/programs/new" className="underline">
            Create a program
          </Link>
          .
        </div>
      ) : (
        <form action="/teams/create" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium">
              Team name
            </label>
            <input id="name" name="name" defaultValue={name} className="w-full rounded-md border px-3 py-2 text-sm" />
            {readSearchParam(resolvedSearchParams, "nameError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "nameError")}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="programId" className="text-sm font-medium">
              Program
            </label>
            <select
              id="programId"
              name="programId"
              defaultValue={selectedProgramId || programs[0]?.id || ""}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "programIdError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "programIdError")}</p>
            ) : null}
          </div>

          <FormActions submitLabel="Create team" cancelHref="/teams" />
        </form>
      )}
    </section>
  );
}
