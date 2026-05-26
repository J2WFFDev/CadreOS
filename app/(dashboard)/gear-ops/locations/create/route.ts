import { redirect } from "next/navigation";

import { createInventoryLocation, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.locations.create",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const locationCode = (formData.get("locationCode") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const parentLocationId = (formData.get("parentLocationId") as string | null)?.trim() || null;

  if (!name) {
    redirect("/gear-ops/locations/new");
  }

  const location = await createInventoryLocation({
    organizationId: scope.organizationId,
    name,
    locationCode,
    description,
    parentLocationId,
  });

  redirect(`/gear-ops/locations/${location.id}`);
}
