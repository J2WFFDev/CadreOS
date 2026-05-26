import { redirect } from "next/navigation";

import { createInventoryKit, resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
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
    workflow: "inventory-ops.kits.create",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const ownerPersonId = (formData.get("ownerPersonId") as string | null)?.trim() || null;

  if (!name) {
    redirect("/gear-ops/kits/new");
  }

  const kit = await createInventoryKit({
    organizationId: scope.organizationId,
    name,
    description,
    ownerPersonId,
  });

  redirect(`/gear-ops/kits/${kit.id}`);
}
