import { MemberLifecycleStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  memberLifecycleInactiveSchema,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

const INACTIVATABLE_STATUSES = new Set<MemberLifecycleStatus>([
  MemberLifecycleStatus.ACTIVE,
  MemberLifecycleStatus.PROSPECT,
  MemberLifecycleStatus.ALUMNI,
]);

function buildErrorRedirectUrl(requestUrl: string, personId: string, error: string) {
  const url = new URL(`/people/${personId}`, requestUrl);

  url.searchParams.set("lifecycleError", error);

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    confirm: getStringField(formData, "confirm"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, scope.errorMessage ?? "Unable to deactivate member right now."),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, "No organization context is available yet."),
      303,
    );
  }

  const parsed = memberLifecycleInactiveSchema.safeParse(values);

  if (!parsed.success) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, "Deactivation confirmation is required."),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "person.deactivate",
    });

    const person = await db.person.findFirst({
      where: {
        id: personId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        lifecycleStatus: true,
      },
    });

    if (!person) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, "Person not found in the selected organization."),
        303,
      );
    }

    if (!INACTIVATABLE_STATUSES.has(person.lifecycleStatus)) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(
          request.url,
          personId,
          `This person cannot be marked inactive from their current status (${person.lifecycleStatus}). Only Active, Prospect, or Alumni members can be marked inactive.`,
        ),
        303,
      );
    }

    await db.person.update({
      where: {
        id: personId,
        organizationId: scope.organizationId,
      },
      data: {
        lifecycleStatus: MemberLifecycleStatus.INACTIVE,
      },
    });

    return NextResponse.redirect(new URL(`/people/${personId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(
        request.url,
        personId,
        isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before deactivating members."
            : "Unable to deactivate member right now. Please try again.",
      ),
      303,
    );
  }
}
