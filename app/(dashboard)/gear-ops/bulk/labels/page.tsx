import Image from "next/image";
import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { LabelPrintActions } from "@/components/gear-ops/label-print-actions";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { listLabelBatchItems } from "@/lib/gear-label-batch";
import { getOrganizationScope } from "@/lib/organization-context";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export const dynamic = "force-dynamic";

export default async function GearBulkLabelSheetPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps label sheets</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load GearOps label sheets right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps label sheets</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.bulk.labels",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps label sheets" description="Batch QR label sheet generation." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const categoryId = readSearchParam(resolvedSearchParams, "categoryId");
  const locationId = readSearchParam(resolvedSearchParams, "locationId");
  const eventId = readSearchParam(resolvedSearchParams, "eventId");
  const itemIds = readSearchParam(resolvedSearchParams, "itemIds");

  const [categories, locations, events, rows] = await Promise.all([
    db.gearCategory.findMany({ where: { organizationId: scope.organizationId }, select: { id: true, name: true }, orderBy: [{ name: "asc" }] }),
    db.inventoryLocation.findMany({ where: { organizationId: scope.organizationId }, select: { id: true, name: true }, orderBy: [{ name: "asc" }] }),
    db.event.findMany({ where: { organizationId: scope.organizationId }, select: { id: true, title: true }, orderBy: [{ startsAt: "desc" }], take: 200 }),
    categoryId || locationId || eventId || itemIds
      ? listLabelBatchItems({
          organizationId: scope.organizationId,
          categoryId: categoryId || undefined,
          locationId: locationId || undefined,
          eventId: eventId || undefined,
          itemIds: itemIds
            ? itemIds
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            : [],
        })
      : Promise.resolve([]),
  ]);

  return (
    <section className="space-y-4">
      <div className="print:hidden">
        <PageHeader title="GearOps label sheets" description="Generate printable QR label sheets by category, location, event, or explicit item IDs." />
        <GearOpsSubnav current="bulk" />
      </div>

      <form className="print:hidden grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 dark:bg-zinc-900" method="get" action="/gear-ops/bulk/labels">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="categoryId">Category</label>
          <select id="categoryId" name="categoryId" defaultValue={categoryId} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="locationId">Location</label>
          <select id="locationId" name="locationId" defaultValue={locationId} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="eventId">Event</label>
          <select id="eventId" name="eventId" defaultValue={eventId} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">All events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="itemIds">Specific item IDs (comma-separated)</label>
          <input id="itemIds" name="itemIds" defaultValue={itemIds} className="w-full rounded-md border px-3 py-2 text-sm font-mono" />
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-2">
          <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">Generate sheet</button>
          <Link href="/gear-ops/bulk/labels" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Clear</Link>
          {rows.length > 0 ? <LabelPrintActions /> : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Pick at least one filter to generate printable labels.
        </div>
      ) : (
        <>
          <div className="print:hidden rounded-lg border bg-white p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            Generated {rows.length} labels. Missing-label warnings are shown for items without asset tag, serial, or SKU.
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {rows.map((row) => (
              <article key={row.id} className="break-inside-avoid rounded-lg border bg-white p-3 dark:bg-zinc-950">
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{scope.organizationName ?? "Organization"}</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">{row.name}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.categoryName} · {row.locationName}</p>
                <p className="mt-2 rounded-md border border-dashed px-2 py-1 text-xs font-mono">{row.printableValue}</p>
                {row.qrDataUri ? (
                  <Image src={row.qrDataUri} alt={`${row.name} QR`} width={180} height={180} unoptimized className="mx-auto mt-3 h-40 w-40 object-contain" />
                ) : null}
                <p className="mt-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{row.qrValue}</p>
                {row.hasMissingIdentifier ? (
                  <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    Missing permanent identifier — reprint after asset tag/serial is assigned.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
