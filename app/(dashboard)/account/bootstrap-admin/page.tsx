import Link from "next/link";

import { getBootstrapOrganizationAdminEligibility } from "@/lib/bootstrap-admin";
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

export default async function BootstrapAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const eligibility = await getBootstrapOrganizationAdminEligibility(scope);
  const resolvedSearchParams = await searchParams;
  const status = readSearchParam(resolvedSearchParams, "status");
  const error = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Bootstrap Organization Admin</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Setup-only path for creating the first Organization Admin in the active organization.
        </p>
      </div>

      {status === "success" ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            Organization Admin access is now established for this organization.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40">
          <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        {eligibility.reason === "ACCOUNT_UNLINKED" ? (
          <div className="space-y-2">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Your signed-in account is not linked to a CadreOS person yet.
            </p>
            <Link href="/account/link-person" className="text-sm underline">
              Link your person first
            </Link>
          </div>
        ) : eligibility.reason === "ADMIN_EXISTS" ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            An Organization Admin already exists. Ask an existing Organization Admin to assign your roles.
          </p>
        ) : eligibility.isEligible ? (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                This action grants your linked person Organization Admin rights for the active organization. Continue
                only if you are the intended first administrator.
              </p>
            </div>
            <form action="/account/bootstrap-admin/create" method="post">
              <button
                type="submit"
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Make me Organization Admin
              </button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Bootstrap is not available right now because organization context, account linking, or database access is
            incomplete.
          </p>
        )}
      </div>
    </section>
  );
}
