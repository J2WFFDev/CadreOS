import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { getStringField } from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, input: { personId: string; error: string }) {
  const url = new URL("/account/link-person", requestUrl);
  url.searchParams.set("personId", input.personId);
  url.searchParams.set("error", input.error);
  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const personId = getStringField(formData, "personId");

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        personId,
        error: scope.errorMessage ?? "Database is unavailable, so person linking cannot be saved right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        personId,
        error: "No active organization is available for linking yet.",
      }),
      303,
    );
  }

  if (!scope.auth.userAccountId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        personId,
        error: "No UserAccount row is available for this signed-in session yet.",
      }),
      303,
    );
  }

  if (!personId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        personId,
        error: "Select a person before saving.",
      }),
      303,
    );
  }

  const person = await db.person.findFirst({
    where: {
      id: personId,
      organizationId: scope.organizationId,
    },
    select: { id: true },
  });

  if (!person) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        personId,
        error: "Select a valid person in the active organization.",
      }),
      303,
    );
  }

  await db.userAccount.update({
    where: { id: scope.auth.userAccountId },
    data: { personId: person.id },
  });

  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
