import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatRoleSummary(roleTypes: string[]) {
  if (roleTypes.length === 0) {
    return "No roles assigned";
  }

  return roleTypes
    .map((roleType) => roleType.replaceAll("_", " ").toLowerCase())
    .map((roleType) => roleType.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(", ");
}

export default async function PeoplePage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query people right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet.
          </p>
        </div>
      </section>
    );
  }

  let people:
    | Array<{
        id: string;
        firstName: string;
        lastName: string;
        email: string | null;
        roles: Array<{ roleType: string }>;
      }>
    | null = null;

  try {
    people = await db.person.findMany({
      where: { organizationId: scope.organizationId },
      include: {
        roles: {
          select: { roleType: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  } catch {
    people = null;
  }

  if (!people) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load people right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Organization: {scope.organizationName ?? scope.organizationId}
          </p>
          <Link href="/people/new" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            New person
          </Link>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No people found for this organization.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">First name</th>
                <th className="px-4 py-3 font-medium">Last name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Roles</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const uniqueRoleTypes = [...new Set(person.roles.map((role) => role.roleType))];

                return (
                  <tr key={person.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/people/${person.id}`} className="underline">
                        {person.firstName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{person.lastName}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{person.email ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatRoleSummary(uniqueRoleTypes)}
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
