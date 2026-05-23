import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const scope = await getOrganizationScope();

  let emailAddress: string | null = null;
  try {
    const clerkUser = await currentUser();
    emailAddress =
      clerkUser?.primaryEmailAddress?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    emailAddress = null;
  }

  let linkedPerson:
    | {
        id: string;
        firstName: string;
        lastName: string;
        email: string | null;
      }
    | null = null;

  if (scope.databaseReady && scope.organizationId && scope.auth.personId) {
    linkedPerson = await db.person.findFirst({
      where: {
        id: scope.auth.personId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Account</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Clerk identity and CadreOS person-linking status for this session.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-base font-medium">Signed-in identity</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-zinc-600 dark:text-zinc-400">Clerk user id</dt>
            <dd className="font-medium">{scope.auth.clerkUserId ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt className="text-zinc-600 dark:text-zinc-400">Email</dt>
            <dd className="font-medium">{emailAddress ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt className="text-zinc-600 dark:text-zinc-400">UserAccount id</dt>
            <dd className="font-medium">{scope.auth.userAccountId ?? "Not created yet"}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-base font-medium">CadreOS link status</h3>
        {!scope.databaseReady ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            {scope.errorMessage ?? "Database is unavailable, so linking status cannot be resolved right now."}
          </p>
        ) : !scope.organizationId ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No active organization is available yet.
          </p>
        ) : linkedPerson ? (
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-zinc-600 dark:text-zinc-400">Linked person</dt>
              <dd className="font-medium">
                {linkedPerson.firstName} {linkedPerson.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600 dark:text-zinc-400">Linked person id</dt>
              <dd className="font-medium">{linkedPerson.id}</dd>
            </div>
            <div>
              <dt className="text-zinc-600 dark:text-zinc-400">Person email</dt>
              <dd className="font-medium">{linkedPerson.email ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              This signed-in user has not been linked to a CadreOS person yet.
            </p>
            <Link href="/account/link-person" className="text-sm underline">
              Link to a person
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-base font-medium">Active organization</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-zinc-600 dark:text-zinc-400">Organization name</dt>
            <dd className="font-medium">{scope.organizationName ?? scope.organizationId ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt className="text-zinc-600 dark:text-zinc-400">Organization id</dt>
            <dd className="font-medium">{scope.organizationId ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt className="text-zinc-600 dark:text-zinc-400">Organization resolution</dt>
            <dd className="font-medium">
              {scope.auth.usesFallbackOrganization ? "Fallback to first organization" : "Explicit organization context"}
            </dd>
          </div>
        </dl>
        {scope.auth.organizationWarning ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
            <p className="text-sm text-amber-900 dark:text-amber-200">{scope.auth.organizationWarning}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
