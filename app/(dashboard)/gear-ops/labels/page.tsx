import Image from "next/image";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { LabelPrintActions } from "@/components/gear-ops/label-print-actions";
import { formatGearOpsDateTime } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import {
  getInventoryLabelPreview,
  labelForInventoryLabelFormat,
  labelForInventoryLabelTemplate,
  renderInventoryLabelAssets,
  resolveLabelFormatClasses,
  type InventoryLabelTemplateKey,
} from "@/lib/inventory-labels";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isTemplateKey(value: string): value is InventoryLabelTemplateKey {
  return [
    "INVENTORY_ITEM",
    "INVENTORY_LOCATION",
    "KIT_LOADOUT",
    "CONSUMABLE",
    "CUSTODY_ASSIGNMENT",
    "TEMPORARY_OPERATIONAL",
  ].includes(value);
}

function toneClasses(tone: "ready" | "attention" | "neutral" | "inactive") {
  if (tone === "ready") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (tone === "attention") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }

  if (tone === "inactive") {
    return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }

  return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
}

export default async function GearOpsLabelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps labels</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load GearOps labels right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps labels</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.labels.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps labels" description="Operational label preview and print support." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const subjectTypeRaw = readSearchParam(resolvedSearchParams, "subjectType");
  const subjectId = readSearchParam(resolvedSearchParams, "subjectId");
  const templateRaw = readSearchParam(resolvedSearchParams, "template");
  const format = readSearchParam(resolvedSearchParams, "format");

  const subjectType = ["GEAR_ITEM", "INVENTORY_LOCATION", "INVENTORY_KIT"].includes(subjectTypeRaw)
    ? (subjectTypeRaw as "GEAR_ITEM" | "INVENTORY_LOCATION" | "INVENTORY_KIT")
    : null;
  const templateKey = isTemplateKey(templateRaw) ? templateRaw : null;

  const preview = subjectType && subjectId && templateKey
    ? await getInventoryLabelPreview({
        organizationId: scope.organizationId,
        subjectType,
        subjectId,
        templateKey,
        format: format || undefined,
      })
    : null;
  const renderedAssets = preview ? await renderInventoryLabelAssets(preview.renderContext) : null;
  const formatClasses = preview ? resolveLabelFormatClasses(preview.renderContext.format) : null;

  return (
    <section className="space-y-4">
      <div className="print:hidden">
        <PageHeader
          title="GearOps labels"
          description="Printer-agnostic operational labels for inventory, custody workflows, audits, and equipment identification."
        />
        <GearOpsSubnav current="labels" />
      </div>

      {preview && renderedAssets && formatClasses ? (
        <>
          <div className="print:hidden flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {labelForInventoryLabelTemplate(preview.template.key)} · {labelForInventoryLabelFormat(preview.renderContext.format)}
              </p>
              <h2 className="text-xl font-semibold tracking-tight">{preview.renderContext.subjectName}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{preview.template.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LabelPrintActions />
              <Link href="/gear-ops/labels" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Clear preview
              </Link>
            </div>
          </div>

          <div className="print:hidden flex flex-wrap gap-2">
            {preview.availableTemplates.map((template) => (
              <Link
                key={template.key}
                href={`/gear-ops/labels?subjectType=${preview.subjectType}&subjectId=${preview.subjectId}&template=${template.key}`}
                className={`rounded-md border px-3 py-1.5 text-sm ${template.key === preview.template.key ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
              >
                {template.label}
              </Link>
            ))}
          </div>

          <div className={`${formatClasses.wrapper} mx-auto rounded-xl border bg-white p-5 shadow-sm dark:bg-zinc-950 print:max-w-none print:border-0 print:p-0 print:shadow-none`}>
            <div className={`grid ${formatClasses.grid} items-start`}>
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                      {preview.renderContext.organizationName}
                    </p>
                    <h3 className="text-2xl font-semibold tracking-tight">{preview.renderContext.title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{preview.renderContext.subtitle}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${toneClasses(preview.renderContext.statusTone)}`}>
                    {preview.renderContext.statusLabel}
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-3xl font-semibold tracking-tight">{preview.renderContext.subjectName}</p>
                  <div className="rounded-lg border border-dashed p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {preview.renderContext.printableIdentifier.label}
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold">{preview.renderContext.printableIdentifier.displayValue}</p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{preview.renderContext.printableIdentifier.description}</p>
                    {preview.renderContext.printableIdentifier.scanValue ? (
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Encoded value: {preview.renderContext.printableIdentifier.scanValue}</p>
                    ) : preview.renderContext.printableIdentifier.futureWorkflowValue ? (
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Future workflow value: {preview.renderContext.printableIdentifier.futureWorkflowValue}
                      </p>
                    ) : null}
                  </div>
                </div>

                <dl className="grid gap-2 sm:grid-cols-2">
                  {preview.renderContext.hints.map((hint) => (
                    <div key={hint} className="rounded-lg border bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                      {hint}
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{preview.renderContext.footer}</span>
                  <span>Rendered {formatGearOpsDateTime(new Date())}</span>
                </div>
              </div>

              <div className="space-y-3">
                {renderedAssets.symbols.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-zinc-500 dark:text-zinc-400">
                    This label stays printable without a current scan payload.
                  </div>
                ) : (
                  renderedAssets.symbols.map((symbol) => (
                    <figure key={`${symbol.kind}-${symbol.value}`} className="rounded-lg border p-3">
                      <div className={`flex items-center justify-center ${formatClasses.symbol}`}>
                        <Image
                          src={symbol.dataUri}
                          alt={symbol.label}
                          width={symbol.kind === "QR" ? 256 : 512}
                          height={symbol.kind === "QR" ? 256 : 160}
                          unoptimized
                          className="max-h-full w-full object-contain"
                        />
                      </div>
                      <figcaption className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">{symbol.label}</figcaption>
                    </figure>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 print:hidden">
          <article className="rounded-lg border bg-white p-5 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold tracking-tight">Scan-ready now</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Inventory-item and location labels use existing ITEM / BC / LOC-compatible identifiers for current GearOps scan workflows.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/gear-ops/items" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Choose item
              </Link>
              <Link href="/gear-ops/locations" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Choose location
              </Link>
            </div>
          </article>

          <article className="rounded-lg border bg-white p-5 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold tracking-tight">Future-compatible foundations</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Kit/loadout and temporary labels already emit stable prefixed identifiers so future mobile workflows can resolve them without redesigning the label format.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/gear-ops/kits" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Choose kit
              </Link>
              <Link href="/gear-ops/items" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Temporary item label
              </Link>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
