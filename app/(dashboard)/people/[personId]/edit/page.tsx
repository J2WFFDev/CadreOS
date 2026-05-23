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

function hasSearchParam(searchParams: SearchParams, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(searchParams, key);
}

export default async function EditPersonPage({
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
        <h2 className="text-2xl font-semibold tracking-tight">Edit person</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load person editing right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let person:
    | {
        id: string;
        firstName: string;
        lastName: string;
        email: string | null;
        phone: string | null;
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
        email: true,
        phone: true,
      },
    });
  } catch {
    person = null;
  }

  if (!person) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Person not found in the selected organization.
          </p>
        </div>
      </section>
    );
  }

  const firstName = hasSearchParam(resolvedSearchParams, "firstName")
    ? readSearchParam(resolvedSearchParams, "firstName")
    : person.firstName;
  const lastName = hasSearchParam(resolvedSearchParams, "lastName")
    ? readSearchParam(resolvedSearchParams, "lastName")
    : person.lastName;
  const email = hasSearchParam(resolvedSearchParams, "email")
    ? readSearchParam(resolvedSearchParams, "email")
    : person.email || "";
  const phone = hasSearchParam(resolvedSearchParams, "phone")
    ? readSearchParam(resolvedSearchParams, "phone")
    : person.phone || "";
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit person</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Editing {person.firstName} {person.lastName}
        </p>
      </div>

      {generalError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{generalError}</p>
        </div>
      ) : null}

      <form
        action={`/people/${person.id}/edit/update`}
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="space-y-1">
          <label htmlFor="firstName" className="text-sm font-medium">
            First name
          </label>
          <input id="firstName" name="firstName" defaultValue={firstName} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "firstNameError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "firstNameError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="lastName" className="text-sm font-medium">
            Last name
          </label>
          <input id="lastName" name="lastName" defaultValue={lastName} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "lastNameError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "lastNameError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input id="email" name="email" defaultValue={email} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "emailError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "emailError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium">
            Phone
          </label>
          <input id="phone" name="phone" defaultValue={phone} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "phoneError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "phoneError")}</p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Save changes
          </button>
          <Link href={`/people/${person.id}`} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
