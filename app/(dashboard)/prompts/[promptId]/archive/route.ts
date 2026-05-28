import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveJournalAccessContext } from "@/lib/journals/access";
import { canManagePromptLibrary } from "@/lib/journals/prompt-access";
import { getOrganizationScope } from "@/lib/organization-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ promptId: string }> },
) {
  const { promptId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/prompts", request.url), 303);
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canManagePromptLibrary(accessContext)) {
    return NextResponse.redirect(new URL(`/prompts/${promptId}`, request.url), 303);
  }

  const existing = await db.journalPrompt.findFirst({
    where: { id: promptId, organizationId: scope.organizationId },
    select: { id: true, active: true },
  });

  if (!existing || !existing.active) {
    return NextResponse.redirect(new URL(`/prompts/${promptId}`, request.url), 303);
  }

  await db.journalPrompt.update({
    where: { id: promptId },
    data: {
      active: false,
      archivedAt: new Date(),
    },
  });

  return NextResponse.redirect(new URL(`/prompts/${promptId}`, request.url), 303);
}
