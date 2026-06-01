import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ kitDefId: string; reqId: string }>;
};

export async function POST(_request: Request, { params }: Props) {
  const { kitDefId, reqId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }
  const organizationId = scope.organizationId;

  const access = await resolveGearOpsReadAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.dynamic-kits.requirements.delete",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const req = await db.dynamicKitRequirement.findUnique({
    where: { id: reqId },
    select: { organizationId: true, kitDefinitionId: true },
  });

  if (!req || req.organizationId !== organizationId || req.kitDefinitionId !== kitDefId) {
    redirect(`/gear-ops/dynamic-kits/${kitDefId}`);
  }

  await db.dynamicKitRequirement.delete({ where: { id: reqId } });

  redirect(`/gear-ops/dynamic-kits/${kitDefId}`);
}
