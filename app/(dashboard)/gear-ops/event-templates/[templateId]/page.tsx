
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum } from "@/lib/gear-ops";
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

export default async function EventTemplateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { templateId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event template</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load event template details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event template</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.event-templates.detail.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event template</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let template:
    | {
        id: string;
        name: string;
        label: string;
        description: string | null;
        notes: string | null;
        quantityNeeded: number;
        requirementType: string;
        isActive: boolean;
        gearCategory: { id: string; name: string } | null;
      }
    | null = null;
  let queryErrorMessage = "Unable to load event template details right now. Please try again later.";

  try {
    template = await db.eventGearRequirementTemplate.findFirst({
      where: { id: templateId, organizationId: scope.organizationId },
      select: {
        id: true,
        name: true,
        label: true,
        description: true,
        notes: true,
        quantityNeeded: true,
        requirementType: true,
        isActive: true,
        gearCategory: { select: { id: true, name: true } },
      },
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading event templates.";
    }
  }

  if (!template) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Event template</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href="/gear-ops/event-templates" label="Event templates" />
        <GearOpsSubnav current="event-templates" />
      </div>
      {readSearchParam(resolvedSearchParams, "saved") ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Event template saved.
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{template.name}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{template.label}</p>
        </div>
        <Link href={`/gear-ops/event-templates/${template.id}/edit`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Edit
        </Link>
      </div>
      <dl className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Requirement type</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatGearOpsEnum(template.requirementType)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Quantity needed</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{template.quantityNeeded}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Category</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{template.gearCategory?.name ?? "Unscoped template"}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Status</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{template.isActive ? "Active" : "Inactive"}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Description</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{template.description ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Notes</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{template.notes ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
