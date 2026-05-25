import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { writeEntryActivity } from "@/lib/entries/service";
import { resolveSafeReturnPath } from "@/lib/navigation-context";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const fromEntryId = String(formData.get("fromEntryId") ?? "").trim();
  const toEntryId = String(formData.get("toEntryId") ?? "").trim();
  const returnTo = resolveSafeReturnPath(String(formData.get("returnTo") ?? ""), `/entries/${fromEntryId}`);

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId || !fromEntryId || !toEntryId || fromEntryId === toEntryId) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  const entries = await db.entry.findMany({
    where: {
      organizationId: scope.organizationId,
      id: { in: [fromEntryId, toEntryId] },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (entries.length !== 2) {
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  }

  await db.entryLink.upsert({
    where: {
      organizationId_fromEntryId_toEntryId: {
        organizationId: scope.organizationId,
        fromEntryId,
        toEntryId,
      },
    },
    create: {
      organizationId: scope.organizationId,
      fromEntryId,
      toEntryId,
      createdByPersonId: scope.auth.personId,
    },
    update: {},
  });

  await writeEntryActivity({
    organizationId: scope.organizationId,
    entryId: fromEntryId,
    actorPersonId: scope.auth.personId,
    action: "entry.linked",
    metadata: { linkedEntryId: toEntryId },
  });

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
