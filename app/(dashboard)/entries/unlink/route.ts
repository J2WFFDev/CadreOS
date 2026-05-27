import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";
import { requirePermission } from "@/lib/permissions";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const fromEntryId = String(formData.get("fromEntryId") ?? "").trim();
  const toEntryId = String(formData.get("toEntryId") ?? "").trim();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${fromEntryId}`);

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId || !fromEntryId || !toEntryId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }
  const organizationId = scope.organizationId;

  try {
    await requirePermission({
      actorUserId: scope.auth.clerkUserId,
      organizationId: organizationId,
      action: "entry.update",
    });
  } catch {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  await db.entryLink.deleteMany({
    where: {
      organizationId: organizationId,
      fromEntryId,
      toEntryId,
    },
  });

  await writeEntryActivity({
    organizationId: organizationId,
    entryId: fromEntryId,
    actorPersonId: scope.auth.personId,
    action: "entry.unlinked",
    metadata: { unlinkedEntryId: toEntryId },
  });

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
