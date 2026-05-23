import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

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

export default async function LinkPersonPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;
  const errorMessage = readSearchParam(resolvedSearchParams, "error");
  const selectedPersonId = readSearchParam(resolvedSearchParams, "personId");

  let emailAddress: string | null = null;
  try {
    const clerkUser = await currentUser();
    emailAddress =
      clerkUser?.primaryEmailAddress?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    emailAddress = null;
  }

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Link person</h2>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {scope.errorMessage ?? "Database is unavailable, so person linking cannot be completed right now."}
        </p>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Link person</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No active organization is available yet, so no person list can be shown.
        </p>
      </section>
    );
  }

  if (!scope.auth.userAccountId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Link person</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No UserAccount is available for this session yet.
        </p>
      </section>
    );
  }

  const [people, linkedPerson] = await Promise.all([
    db.person.findMany({
      where: { organizationId: scope.organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    scope.auth.personId
      ? db.person.findFirst({
          where: {
            id: scope.auth.personId,
            organizationId: scope.organizationId,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const initialPersonId = selectedPersonId || scope.auth.personId || "";

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Link person</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect your signed-in Clerk user to a CadreOS person record for attribution and role context.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-base font-medium">Signed-in identity</h3>
        <p className="mt-3 text-sm">
          Clerk user id: <span className="font-medium">{scope.auth.clerkUserId ?? "Unavailable"}</span>
        </p>
        <p className="mt-1 text-sm">
          Email: <span className="font-medium">{emailAddress ?? "Unavailable"}</span>
        </p>
        <p className="mt-1 text-sm">
          Current linked person:{" "}
          <span className="font-medium">
            {linkedPerson ? `${linkedPerson.firstName} ${linkedPerson.lastName}` : "Not linked"}
          </span>
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40">
          <p className="text-sm text-rose-700 dark:text-rose-300">{errorMessage}</p>
        </div>
      ) : null}

      <form action="/account/link-person" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-2">
          <label htmlFor="personId" className="text-sm font-medium">
            Person in {scope.organizationName ?? "active organization"}
          </label>
          <select
            id="personId"
            name="personId"
            required
            defaultValue={initialPersonId}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-900"
          >
            <option value="" disabled>
              Select a person
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.lastName}, {person.firstName}
                {person.email ? ` (${person.email})` : ""}
              </option>
            ))}
          </select>
        </div>

        {people.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No people exist in the active organization yet. Create a person first from the{" "}
            <Link href="/people/new" className="underline">
              People
            </Link>{" "}
            workflow.
          </p>
        ) : (
          <button
            type="submit"
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Save person link
          </button>
        )}
      </form>
    </section>
  );
}
