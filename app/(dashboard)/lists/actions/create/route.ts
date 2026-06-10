import { EntryListScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveEntryListVisibility } from "@/lib/entries/lists";
import { formatEntryListSetupIncompleteMessage, getEntryListSchemaIssue, logEntryListSchemaIssue } from "@/lib/entries/schema-guard";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return NextResponse.redirect(new URL("/lists?error=Service+unavailable", request.url), 303);
  }

  const { organizationId } = scope;

  const listVisibility = await resolveEntryListVisibility({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!listVisibility.canCreatePersonalList) {
    return NextResponse.redirect(new URL("/lists?error=Permission+denied", request.url), 303);
  }

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const scopeValue = String(formData.get("scope") ?? "").trim().toUpperCase();
  const programId = String(formData.get("programId") ?? "").trim() || null;
  const teamId = String(formData.get("teamId") ?? "").trim() || null;

  if (!name) {
    return NextResponse.redirect(new URL("/lists/create?error=Name+is+required", request.url), 303);
  }

  const listScope = Object.values(EntryListScope).includes(scopeValue as EntryListScope)
    ? (scopeValue as EntryListScope)
    : EntryListScope.PERSONAL;

  if (listScope !== EntryListScope.PERSONAL && !listVisibility.canManageSharedLists) {
    return NextResponse.redirect(new URL("/lists/create?error=Only+personal+lists+are+available", request.url), 303);
  }

  // Validate scope-required fields
  if (listScope === EntryListScope.PERSONAL && !scope.auth.personId) {
    return NextResponse.redirect(new URL("/lists/create?error=A+linked+person+is+required+for+Personal+lists", request.url), 303);
  }
  if (listScope === EntryListScope.PROGRAM && !programId) {
    return NextResponse.redirect(new URL("/lists/create?error=Program+ID+required+for+Program+context", request.url), 303);
  }
  if (listScope === EntryListScope.TEAM && !teamId) {
    return NextResponse.redirect(new URL("/lists/create?error=Team+ID+required+for+Team+context", request.url), 303);
  }

  const ownerPersonId = listScope === EntryListScope.PERSONAL ? scope.auth.personId! : null;

  try {
    const created = await db.entryList.create({
      data: {
        organizationId,
        name,
        scope: listScope,
        ownerPersonId,
        programId: listScope === EntryListScope.PROGRAM ? programId : null,
        teamId: listScope === EntryListScope.TEAM ? teamId : null,
        isInbox: false,
        isArchived: false,
      },
      select: { id: true },
    });

    console.log("[lists.create] created EntryList", { id: created.id, name, scope: listScope });
    return NextResponse.redirect(new URL(`/lists/${created.id}`, request.url), 303);
  } catch (err) {
    if (getEntryListSchemaIssue(err)) {
      logEntryListSchemaIssue("lists.create.action.create-list", err, {
        organizationId,
        scope: listScope,
        ownerPersonId,
        programId,
        teamId,
      });

      return NextResponse.redirect(
        new URL(`/lists/create?error=${encodeURIComponent(formatEntryListSetupIncompleteMessage())}`, request.url),
        303,
      );
    }

    console.error("[lists.create] failed", err);
    return NextResponse.redirect(new URL("/lists/create?error=Failed+to+create+list", request.url), 303);
  }
}
