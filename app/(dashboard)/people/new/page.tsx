import { MemberLifecycleStatus } from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { PageHeader } from "@/components/dashboard/page-header";
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

const LIFECYCLE_STATUS_LABELS: Record<MemberLifecycleStatus, string> = {
  [MemberLifecycleStatus.PROSPECT]: "Prospect (pending activation)",
  [MemberLifecycleStatus.ACTIVE]: "Active",
  [MemberLifecycleStatus.INACTIVE]: "Inactive",
  [MemberLifecycleStatus.ARCHIVED]: "Archived",
  [MemberLifecycleStatus.ALUMNI]: "Alumni",
};

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New person</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load person creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const firstName = readSearchParam(resolvedSearchParams, "firstName");
  const lastName = readSearchParam(resolvedSearchParams, "lastName");
  const email = readSearchParam(resolvedSearchParams, "email");
  const phone = readSearchParam(resolvedSearchParams, "phone");
  const lifecycleStatus = (readSearchParam(resolvedSearchParams, "lifecycleStatus") || MemberLifecycleStatus.ACTIVE) as MemberLifecycleStatus;
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <PageHeader title="New person" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form action="/people/create" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="firstName" className="text-sm font-medium">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            defaultValue={firstName}
            className="w-full rounded-md border px-3 py-2 text-sm"
            autoComplete="given-name"
          />
          {readSearchParam(resolvedSearchParams, "firstNameError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "firstNameError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="lastName" className="text-sm font-medium">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            defaultValue={lastName}
            className="w-full rounded-md border px-3 py-2 text-sm"
            autoComplete="family-name"
          />
          {readSearchParam(resolvedSearchParams, "lastNameError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "lastNameError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            defaultValue={email}
            className="w-full rounded-md border px-3 py-2 text-sm"
            autoComplete="email"
          />
          {readSearchParam(resolvedSearchParams, "emailError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "emailError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={phone}
            className="w-full rounded-md border px-3 py-2 text-sm"
            autoComplete="tel"
          />
          {readSearchParam(resolvedSearchParams, "phoneError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "phoneError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="lifecycleStatus" className="text-sm font-medium">
            Member status
          </label>
          <select
            id="lifecycleStatus"
            name="lifecycleStatus"
            defaultValue={lifecycleStatus}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(MemberLifecycleStatus).map((status) => (
              <option key={status} value={status}>
                {LIFECYCLE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "lifecycleStatusError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "lifecycleStatusError")}</p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Use &ldquo;Prospect&rdquo; to add a person who has not yet been fully activated. Use &ldquo;Active&rdquo; to join them directly.
          </p>
        </div>

        <FormActions submitLabel="Create person" cancelHref="/people" />
      </form>
    </section>
  );
}
