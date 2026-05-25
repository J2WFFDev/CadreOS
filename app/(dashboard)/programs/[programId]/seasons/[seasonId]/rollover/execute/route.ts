import { MemberLifecycleStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
  seasonRolloverWorkflowSchema,
} from "@/lib/workflows";

function buildErrorRedirectUrl(
  requestUrl: string,
  programId: string,
  seasonId: string,
  input: {
    values: {
      targetSeasonId: string;
      includeInactive: string;
    };
    error: string;
  },
) {
  const url = new URL(`/programs/${programId}/seasons/${seasonId}/rollover`, requestUrl);

  if (input.values.targetSeasonId) {
    url.searchParams.set("targetSeasonId", input.values.targetSeasonId);
  }

  if (input.values.includeInactive) {
    url.searchParams.set("includeInactive", input.values.includeInactive);
  }

  url.searchParams.set("error", input.error);

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ programId: string; seasonId: string }> },
) {
  const { programId, seasonId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    targetSeasonId: getStringField(formData, "targetSeasonId"),
    includeInactive: getStringField(formData, "includeInactive"),
    confirm: getStringField(formData, "confirm"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, seasonId, {
        values,
        error: scope.errorMessage ?? "Unable to execute season rollover right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, seasonId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const parsed = seasonRolloverWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError =
      fieldErrors.targetSeasonId?.[0] ??
      fieldErrors.confirm?.[0] ??
      "Please correct the highlighted fields.";

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, seasonId, {
        values,
        error: firstError,
      }),
      303,
    );
  }

  const { targetSeasonId, includeInactive } = parsed.data;
  const organizationId = scope.organizationId;

  try {
    await requirePhase1CMutationPermission({
      organizationId,
      action: "season.rollover",
      programId,
    });

    const sourceSeason = await db.season.findFirst({
      where: {
        id: seasonId,
        organizationId,
        programId,
      },
      select: {
        id: true,
        name: true,
        programId: true,
      },
    });

    if (!sourceSeason) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, seasonId, {
          values,
          error: "Source season not found in the selected organization and program.",
        }),
        303,
      );
    }

    if (targetSeasonId === seasonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, seasonId, {
          values,
          error: "Source and target season must be different.",
        }),
        303,
      );
    }

    const targetSeason = await db.season.findFirst({
      where: {
        id: targetSeasonId,
        organizationId,
        programId,
      },
      select: {
        id: true,
        name: true,
        programId: true,
      },
    });

    if (!targetSeason) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, seasonId, {
          values,
          error: "Target season not found in the selected organization and program.",
        }),
        303,
      );
    }

    const lifecycleFilter =
      includeInactive === "1"
        ? { lifecycleStatus: { not: MemberLifecycleStatus.ARCHIVED } }
        : { lifecycleStatus: { notIn: [MemberLifecycleStatus.ARCHIVED, MemberLifecycleStatus.INACTIVE] } };

    const eligibleMemberships = await db.rosterMembership.findMany({
      where: {
        organizationId,
        seasonId,
        team: {
          programId,
        },
        person: lifecycleFilter,
      },
      select: {
        teamId: true,
        personId: true,
        rosterRole: true,
      },
    });

    if (eligibleMemberships.length > 0) {
      await db.rosterMembership.createMany({
        data: eligibleMemberships.map((m) => ({
          organizationId,
          teamId: m.teamId,
          seasonId: targetSeasonId,
          personId: m.personId,
          rosterRole: m.rosterRole,
        })),
        skipDuplicates: true,
      });
    }

    const successUrl = new URL(`/programs/${programId}`, request.url);
    successUrl.searchParams.set(
      "rolloverSuccess",
      `Rolled over ${eligibleMemberships.length} ${eligibleMemberships.length === 1 ? "member" : "members"} from ${sourceSeason.name} to ${targetSeason.name}.`,
    );

    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, seasonId, {
          values,
          error: "One or more roster memberships already exist in the target season.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, seasonId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before rolling over seasons."
            : "Unable to execute season rollover right now. Please try again.",
      }),
      303,
    );
  }
}
