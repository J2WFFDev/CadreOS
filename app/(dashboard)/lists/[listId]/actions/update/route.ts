import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveEntryListVisibility } from "@/lib/entries/lists";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.redirect(new URL(`/lists/${listId}?error=Service+unavailable`, request.url), 303);
  }

  const { organizationId } = scope;

  const listVisibility = await resolveEntryListVisibility({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!listVisibility.canRead) {
    return NextResponse.redirect(new URL(`/lists/${listId}?error=Permission+denied`, request.url), 303);
  }

  // Verify list belongs to this org
  const list = await db.entryList.findFirst({
    where: { id: listId, organizationId, AND: [listVisibility.where] },
    select: { id: true, isInbox: true, ownerPersonId: true },
  });

  if (!list) {
    return NextResponse.redirect(new URL("/lists?error=List+not+found", request.url), 303);
  }

  const canEditList = listVisibility.canManageSharedLists || list.ownerPersonId === scope.auth.personId;
  if (!canEditList) {
    return NextResponse.redirect(new URL(`/lists/${listId}?error=Permission+denied`, request.url), 303);
  }

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const archiveValue = String(formData.get("isArchived") ?? "").trim();
  const isArchived = archiveValue === "true";

  if (!name) {
    return NextResponse.redirect(new URL(`/lists/${listId}/update?error=Name+is+required`, request.url), 303);
  }

  try {
    await db.entryList.update({
      where: { id: list.id },
      data: { name, isArchived },
      select: { id: true },
    });

    console.log("[lists.update] updated EntryList", { id: list.id, name, isArchived });
    return NextResponse.redirect(new URL(`/lists/${list.id}`, request.url), 303);
  } catch (err) {
    console.error("[lists.update] failed", err);
    return NextResponse.redirect(new URL(`/lists/${listId}/update?error=Failed+to+update+list`, request.url), 303);
  }
}
