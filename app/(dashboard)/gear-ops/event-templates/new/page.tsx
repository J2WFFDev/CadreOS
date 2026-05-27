
import { EventGearRequirementType } from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSchemaWarning } from "@/components/gear-ops/schema-warning";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getGearOpsSchemaStatus } from "@/lib/gear-ops-schema-status";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function NewEventTemplatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New event template</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load event template creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New event template</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.event-templates.new.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New event template</h2>
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
        <PageHeader title="New event template" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />
        <GearOpsSubnav current="event-templates" />
        <GearOpsSchemaWarning
          actionMessage="Run database setup before creating event templates."
          status={schemaStatus}
          organizationId={scope.organizationId}
          actorPersonId={scope.auth.personId}
        />
      </section>
    );
  }

  let categories: Array<{ id: string; name: string }> | null = null;
  let queryErrorMessage = "Unable to load event template options right now. Please try again later.";

  try {
    categories = await db.gearCategory.findMany({
      where: { organizationId: scope.organizationId },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before creating event templates.";
    }
  }

  if (!categories) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New event template</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader title="New event template" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />
      <GearOpsSubnav current="event-templates" />
      {readSearchParam(resolvedSearchParams, "error") ? <ErrorMessage message={readSearchParam(resolvedSearchParams, "error")} /> : null}
      <form action="/gear-ops/event-templates/create" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">Template name</label>
          <input id="name" name="name" defaultValue={readSearchParam(resolvedSearchParams, "name")} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "nameError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "nameError")}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="label" className="text-sm font-medium">Requirement label</label>
          <input id="label" name="label" defaultValue={readSearchParam(resolvedSearchParams, "label")} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "labelError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "labelError")}</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="gearCategoryId" className="text-sm font-medium">Category (optional)</label>
            <select id="gearCategoryId" name="gearCategoryId" defaultValue={readSearchParam(resolvedSearchParams, "gearCategoryId")} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Unscoped template</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {readSearchParam(resolvedSearchParams, "gearCategoryIdError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "gearCategoryIdError")}</p> : null}
          </div>
          <div className="space-y-1">
            <label htmlFor="requirementType" className="text-sm font-medium">Requirement type</label>
            <select id="requirementType" name="requirementType" defaultValue={readSearchParam(resolvedSearchParams, "requirementType") || EventGearRequirementType.REQUIRED} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(EventGearRequirementType).map((requirementType) => (
                <option key={requirementType} value={requirementType}>{formatGearOpsEnum(requirementType)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="quantityNeeded" className="text-sm font-medium">Quantity needed</label>
            <input id="quantityNeeded" name="quantityNeeded" type="number" min="1" max="999" defaultValue={readSearchParam(resolvedSearchParams, "quantityNeeded") || "1"} className="w-full rounded-md border px-3 py-2 text-sm" />
            {readSearchParam(resolvedSearchParams, "quantityNeededError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "quantityNeededError")}</p> : null}
          </div>
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input type="hidden" name="isActive" value="false" />
            <input type="checkbox" name="isActive" value="true" defaultChecked={readSearchParam(resolvedSearchParams, "isActive") !== "false"} />
            Active template
          </label>
        </div>
        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">Description (optional)</label>
          <textarea id="description" name="description" defaultValue={readSearchParam(resolvedSearchParams, "description")} rows={4} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "descriptionError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "descriptionError")}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">Notes (optional)</label>
          <textarea id="notes" name="notes" defaultValue={readSearchParam(resolvedSearchParams, "notes")} rows={4} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "notesError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "notesError")}</p> : null}
        </div>
        <FormActions submitLabel="Create template" cancelHref="/gear-ops/event-templates" />
      </form>
    </section>
  );
}
