import { redirect } from "next/navigation";

import { deactivateGearAssemblyRelation } from "@/lib/gear-assembly";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ itemId: string; assemblyId: string }> },
) {
  const { itemId, assemblyId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.assemblies.write",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  await deactivateGearAssemblyRelation({
    organizationId: scope.organizationId,
    assemblyId,
  });

  redirect(`/gear-ops/items/${itemId}/assemblies`);
}
