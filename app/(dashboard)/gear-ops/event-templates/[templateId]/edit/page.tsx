
import { EventGearRequirementType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
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

export default async function EditEventTemplatePage({
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
        <h2 className="text-2xl font-semibold tracking-tight">Edit event template</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load event template edit right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit event template</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.event-templates.edit.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit event template</h2>
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
        gearCategoryId: string | null;
        requirementType: string;
        quantityNeeded: number;
        isActive: boolean;
      }
    | null = null;
  let categories: Array<{ id: string; name: string }> | null = null;
  let queryErrorMessage = "Unable to load event template edit right now. Please try again later.";

  try {
    [template, categories] = await Promise.all([
      db.eventGearRequirementTemplate.findFirst({
        where: { id: templateId, organizationId: scope.organizationId },
        select: {
          id: true,
          name: true,
          label: true,
          description: true,
          notes: true,
          gearCategoryId: true,
          requirementType: true,
          quantityNeeded: true,
          isActive: true,
        },
      }),
      db.gearCategory.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
    ]);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before editing event templates.";
    }
  }

  if (!template || !categories) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit event template</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const isActiveDefault =
    (readSearchParam(resolvedSearchParams, "isActive") || (template.isActive ? "true" : "false")) === "true";

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/event-templates/${template.id}`} label={template.name} />
        <GearOpsSubnav current="event-templates" />
      </div>
      {readSearchParam(resolvedSearchParams, "error") ? <ErrorMessage message={readSearchParam(resolvedSearchParams, "error")} /> : null}
      <form action={`/gear-ops/event-templates/${template.id}/edit/update`} method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">Template name</label>
          <input id="name" name="name" defaultValue={readSearchParam(resolvedSearchParams, "name") || template.name} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "nameError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "nameError")}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="label" className="text-sm font-medium">Requirement label</label>
          <input id="label" name="label" defaultValue={readSearchParam(resolvedSearchParams, "label") || template.label} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "labelError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "labelError")}</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="gearCategoryId" className="text-sm font-medium">Category (optional)</label>
            <select id="gearCategoryId" name="gearCategoryId" defaultValue={readSearchParam(resolvedSearchParams, "gearCategoryId") || template.gearCategoryId || ""} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Unscoped template</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="requirementType" className="text-sm font-medium">Requirement type</label>
            <select id="requirementType" name="requirementType" defaultValue={readSearchParam(resolvedSearchParams, "requirementType") || template.requirementType || EventGearRequirementType.REQUIRED} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(EventGearRequirementType).map((requirementType) => (
                <option key={requirementType} value={requirementType}>{formatGearOpsEnum(requirementType)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="quantityNeeded" className="text-sm font-medium">Quantity needed</label>
            <input id="quantityNeeded" name="quantityNeeded" type="number" min="1" max="999" defaultValue={readSearchParam(resolvedSearchParams, "quantityNeeded") || template.quantityNeeded.toString()} className="w-full rounded-md border px-3 py-2 text-sm" />
            {readSearchParam(resolvedSearchParams, "quantityNeededError") ? <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "quantityNeededError")}</p> : null}
          </div>
          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input type="hidden" name="isActive" value="false" />
            <input type="checkbox" name="isActive" value="true" defaultChecked={isActiveDefault} />
            Active template
          </label>
        </div>
        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">Description (optional)</label>
          <textarea id="description" name="description" defaultValue={readSearchParam(resolvedSearchParams, "description") || template.description || ""} rows={4} className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">Notes (optional)</label>
          <textarea id="notes" name="notes" defaultValue={readSearchParam(resolvedSearchParams, "notes") || template.notes || ""} rows={4} className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <FormActions submitLabel="Save template" cancelHref={`/gear-ops/event-templates/${template.id}`} />
      </form>
    </section>
  );
}
