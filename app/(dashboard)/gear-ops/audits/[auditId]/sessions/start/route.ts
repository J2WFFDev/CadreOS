import { redirect } from "next/navigation";

import { getOrganizationScope } from "@/lib/organization-context";
import {
  resolveInventoryAuditWriteAccess,
  startInventoryAuditSession,
} from "@/lib/inventory-audit";
import { resolveActorPersonId } from "@/lib/user-account";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const { auditId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return new Response("No organization context.", { status: 400 });
  }

  const access = await resolveInventoryAuditWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-audit.session.start",
  });

  if (!access.allowed) {
    return new Response(access.denialMessage ?? "Access denied.", { status: 403 });
  }

  const formData = await request.formData();
  const title = ((formData.get("title") as string | null) ?? "").trim();
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;

  const startedByPersonId = await resolveActorPersonId({
    organizationId: scope.organizationId,
    clerkUserId: scope.auth.clerkUserId,
    preferredPersonId: scope.auth.personId,
  });

  const session = await startInventoryAuditSession({
    organizationId: scope.organizationId,
    auditId,
    title: title || `Audit session ${new Date().toLocaleString()}`,
    notes,
    startedByPersonId: startedByPersonId ?? null,
  });

  redirect(`/gear-ops/audits/sessions/${session.id}`);
}
