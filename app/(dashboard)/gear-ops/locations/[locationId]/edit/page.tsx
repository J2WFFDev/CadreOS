import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { resolveInventoryOpsReadAccess } from "@/lib/inventory-ops";
import { isSchemaUnavailableError } from "@/lib/workflows";
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
  return searchParams[key] !== undefined;
}

export default async function EditInventoryLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locationId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit location</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load location edit right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit location</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveInventoryOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.locations.edit.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <BackLink href={`/gear-ops/locations/${locationId}`} label="Back to location" />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let location:
    | {
        id: string;
        name: string;
        locationCode: string | null;
        description: string | null;
        isActive: boolean;
      }
    | null = null;
  let queryErrorMessage = "Unable to load location edit right now. Please try again later.";

  try {
    location = await db.inventoryLocation.findFirst({
      where: {
        id: locationId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        name: true,
        locationCode: true,
        description: true,
        isActive: true,
      },
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet.";
    }
  }

  if (!location) {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/locations" label="Back to locations" />
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const name = hasSearchParam(resolvedSearchParams, "name")
    ? readSearchParam(resolvedSearchParams, "name")
    : location.name;
  const locationCode = hasSearchParam(resolvedSearchParams, "locationCode")
    ? readSearchParam(resolvedSearchParams, "locationCode")
    : location.locationCode || "";
  const description = hasSearchParam(resolvedSearchParams, "description")
    ? readSearchParam(resolvedSearchParams, "description")
    : location.description || "";
  const isActive = hasSearchParam(resolvedSearchParams, "isActive")
    ? readSearchParam(resolvedSearchParams, "isActive")
    : location.isActive
      ? "true"
      : "false";
  const generalError = readSearchParam(resolvedSearchParams, "error");
  const nameError = readSearchParam(resolvedSearchParams, "nameError");
  const locationCodeError = readSearchParam(resolvedSearchParams, "locationCodeError");
  const descriptionError = readSearchParam(resolvedSearchParams, "descriptionError");

  return (
    <section className="space-y-4">
      <BackLink href={`/gear-ops/locations/${location.id}`} label={location.name} />
      <GearOpsSubnav current="locations" />

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit location</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Update location name, code, status, and description.
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form
        action={`/gear-ops/locations/${location.id}/edit/update`}
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Location name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name}
            required
            maxLength={120}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {nameError ? <p className="text-sm text-red-600">{nameError}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="locationCode" className="text-sm font-medium">
            Location code
          </label>
          <input
            id="locationCode"
            name="locationCode"
            defaultValue={locationCode}
            maxLength={20}
            className="w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
          {locationCodeError ? <p className="text-sm text-red-600">{locationCodeError}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="isActive" className="text-sm font-medium">
            Status
          </label>
          <select id="isActive" name="isActive" defaultValue={isActive} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={description}
            rows={3}
            maxLength={500}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {descriptionError ? <p className="text-sm text-red-600">{descriptionError}</p> : null}
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href={`/gear-ops/locations/${location.id}`}
            className="rounded-md border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            Save location
          </button>
        </div>
      </form>
    </section>
  );
}
