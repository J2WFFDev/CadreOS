
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSchemaWarning } from "@/components/gear-ops/schema-warning";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { getGearOpsSchemaStatus } from "@/lib/gear-ops-schema-status";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function EventTemplateListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event templates</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load event templates right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event templates</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.event-templates.list.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Event templates" description="Reusable event requirement starters." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const schemaStatus = await getGearOpsSchemaStatus("event-templates");
  if (!schemaStatus.schemaReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Event templates" description="Reusable event requirement starters." />
        <GearOpsSubnav current="event-templates" />
        <GearOpsSchemaWarning
          actionMessage="Run database setup before loading event templates."
          status={schemaStatus}
          organizationId={scope.organizationId}
          actorPersonId={scope.auth.personId}
        />
      </section>
    );
  }

  let templates:
    | Array<{
        id: string;
        name: string;
        label: string;
        requirementType: string;
        quantityNeeded: number;
        isActive: boolean;
        gearCategory: { id: string; name: string } | null;
      }>
    | null = null;
  let queryErrorMessage = "Unable to load event templates right now. Please try again later.";

  try {
    templates = await db.eventGearRequirementTemplate.findMany({
      where: { organizationId: scope.organizationId },
      select: {
        id: true,
        name: true,
        label: true,
        requirementType: true,
        quantityNeeded: true,
        isActive: true,
        gearCategory: { select: { id: true, name: true } },
      },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading event templates.";
    }
  }

  if (!templates) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event templates</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader title="Event templates" description="Reusable organization-level event gear requirement templates." />
      <GearOpsSubnav current="event-templates" />

      {readSearchParam(resolvedSearchParams, "error") ? <ErrorMessage message={readSearchParam(resolvedSearchParams, "error")} /> : null}
      {readSearchParam(resolvedSearchParams, "saved") ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Event template saved.
        </div>
      ) : null}

      <div className="flex justify-end">
        <Link href="/gear-ops/event-templates/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
          New template
        </Link>
      </div>

      {templates.length === 0 ? (
        <EmptyState message="No event requirement templates have been created yet." actionHref="/gear-ops/event-templates/new" actionLabel="Create a template" />
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <article key={template.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">
                    <Link href={`/gear-ops/event-templates/${template.id}`} className="underline">
                      {template.name}
                    </Link>
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{template.label}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${template.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"}`}>
                  {template.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-50">Requirement type</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400">{formatGearOpsEnum(template.requirementType)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-50">Quantity</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400">{template.quantityNeeded}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-900 dark:text-zinc-50">Category</dt>
                  <dd className="text-zinc-600 dark:text-zinc-400">{template.gearCategory?.name ?? "Unscoped template"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
