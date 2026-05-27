import { MemberLifecycleStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  memberLifecycleArchiveSchema,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

const ARCHIVABLE_STATUSES = new Set<MemberLifecycleStatus>([
  MemberLifecycleStatus.ACTIVE,
  MemberLifecycleStatus.PROSPECT,
  MemberLifecycleStatus.INACTIVE,
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
      buildErrorRedirectUrl(request.url, personId, scope.errorMessage ?? "Unable to archive member right now."),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, "No organization context is available yet."),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = memberLifecycleArchiveSchema.safeParse(values);

  if (!parsed.success) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, "Archive confirmation is required."),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "person.archive",
    });

    const person = await db.person.findFirst({
      where: {
        id: personId,
        organizationId: organizationId,
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

    if (!ARCHIVABLE_STATUSES.has(person.lifecycleStatus)) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(
          request.url,
          personId,
          `This person cannot be archived from their current status (${person.lifecycleStatus}). Only Active, Pending, Inactive, or Graduated members can be archived.`,
        ),
        303,
      );
    }

    await db.person.update({
      where: {
        id: personId,
        organizationId: organizationId,
      },
      data: {
        lifecycleStatus: MemberLifecycleStatus.ARCHIVED,
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
            ? "Database schema is not available yet. Run database setup before archiving members."
            : "Unable to archive member right now. Please try again.",
      ),
      303,
    );
  }
}
