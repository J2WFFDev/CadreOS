import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ poolId: string; membershipId: string }>;
};

export async function POST(_request: Request, { params }: Props) {
  const { poolId, membershipId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }
  const organizationId = scope.organizationId;

  const access = await resolveGearOpsReadAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.pools.remove-item",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const membership = await db.inventoryPoolMembership.findUnique({
    where: { id: membershipId },
    select: { organizationId: true, poolId: true },
  });

  if (!membership || membership.organizationId !== organizationId || membership.poolId !== poolId) {
    redirect(`/gear-ops/pools/${poolId}`);
  }

  await db.inventoryPoolMembership.delete({ where: { id: membershipId } });

  redirect(`/gear-ops/pools/${poolId}`);
}
