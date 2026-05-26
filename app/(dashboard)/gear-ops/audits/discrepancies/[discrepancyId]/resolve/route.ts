import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  resolveInventoryAuditWriteAccess,
  resolveInventoryAuditDiscrepancy,
} from "@/lib/inventory-audit";
import { resolveActorPersonId } from "@/lib/user-account";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ discrepancyId: string }> },
) {
  const { discrepancyId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }

  const access = await resolveInventoryAuditWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-audit.discrepancy.resolve",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const resolutionAction = ((formData.get("resolutionAction") as string | null) ?? "RESOLVE").trim();
  const resolutionNotes = ((formData.get("resolutionNotes") as string | null) ?? "").trim() || null;
  const resolvedByPersonId = await resolveActorPersonId({
    organizationId: scope.organizationId,
    clerkUserId: scope.auth.clerkUserId,
    preferredPersonId: scope.auth.personId,
  });

  await resolveInventoryAuditDiscrepancy({
    organizationId: scope.organizationId,
    discrepancyId,
    resolvedByPersonId: resolvedByPersonId ?? null,
    resolutionNotes,
    dismissed: resolutionAction === "DISMISS",
  });

  const discrepancy = await db.inventoryAuditDiscrepancy.findFirst({
    where: { id: discrepancyId, organizationId: scope.organizationId },
    select: { auditSessionId: true },
  });

  if (!discrepancy?.auditSessionId) {
    redirect("/gear-ops/audits");
  }

  redirect(`/gear-ops/audits/sessions/${discrepancy.auditSessionId}`);
}
