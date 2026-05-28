import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { resolveJournalAccessContext } from "@/lib/journals/access";
import { canManagePromptLibrary } from "@/lib/journals/prompt-access";
import { getOrganizationScope } from "@/lib/organization-context";

function normalizeTags(rawTags: string): string[] {
  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId || !scope.auth.personId) {
    return NextResponse.redirect(new URL("/prompts", request.url), 303);
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canManagePromptLibrary(accessContext)) {
    return NextResponse.redirect(new URL("/prompts", request.url), 303);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const promptText = String(formData.get("promptText") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const tags = normalizeTags(String(formData.get("tags") ?? ""));

  if (!title || !promptText) {
    return NextResponse.redirect(new URL("/prompts/create", request.url), 303);
  }

  const prompt = await db.journalPrompt.create({
    data: {
      organizationId: scope.organizationId,
      title,
      promptText,
      category,
      tags,
      active: true,
      createdByPersonId: scope.auth.personId,
    },
    select: { id: true },
  });

  return NextResponse.redirect(new URL(`/prompts/${prompt.id}`, request.url), 303);
}
