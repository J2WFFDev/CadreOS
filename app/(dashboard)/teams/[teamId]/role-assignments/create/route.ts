import { Prisma, RoleType, ScopeType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

const teamRoleAssignmentSchema = z.object({
  personId: z.string().trim().min(1, "Person selection is required."),
  roleType: z.nativeEnum(RoleType, {
    message: "Role type must use an existing role value.",
  }),
});

function buildErrorRedirectUrl(
  requestUrl: string,
  teamId: string,
  input: {
    values: { personId: string; roleType: string };
    fieldErrors?: Partial<Record<"personId" | "roleType", string>>;
    error?: string;
  },
) {
  const url = new URL(`/teams/${teamId}`, requestUrl);

  url.searchParams.set("teamRolePersonId", input.values.personId);
  url.searchParams.set("teamRoleType", input.values.roleType);

  if (input.fieldErrors?.personId) {
    url.searchParams.set("teamRolePersonIdError", input.fieldErrors.personId);
  }

  if (input.fieldErrors?.roleType) {
    url.searchParams.set("teamRoleTypeError", input.fieldErrors.roleType);
  }

  if (input.error) {
    url.searchParams.set("teamRoleError", input.error);
  }

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    personId: getStringField(formData, "personId"),
    roleType: getStringField(formData, "roleType"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        error: scope.errorMessage ?? "Unable to assign role right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = teamRoleAssignmentSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        fieldErrors: {
          personId: fieldErrors.personId?.[0],
          roleType: fieldErrors.roleType?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "roleAssignment.create",
      teamId,
    });

    const team = await db.team.findFirst({
      where: {
        id: teamId,
        organizationId: organizationId,
      },
      select: {
        id: true,
        programId: true,
      },
    });

    if (!team) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          error: "Team not found in the selected organization.",
        }),
        303,
      );
    }

    const person = await db.person.findFirst({
      where: {
        id: parsed.data.personId,
        organizationId: organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!person) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          fieldErrors: {
            personId: "Select a valid person in the active organization.",
          },
          error: "Person selection is invalid.",
        }),
        303,
      );
    }

    const existing = await db.roleAssignment.findFirst({
      where: {
        organizationId: organizationId,
        personId: person.id,
        roleType: parsed.data.roleType,
        scopeType: ScopeType.TEAM,
        teamId: team.id,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          error: "That person already has this role assignment on this team.",
        }),
        303,
      );
    }

    await db.roleAssignment.create({
      data: {
        organizationId: organizationId,
        personId: person.id,
        roleType: parsed.data.roleType,
        scopeType: ScopeType.TEAM,
        programId: team.programId,
        teamId: team.id,
      },
    });

    const successUrl = new URL(`/teams/${teamId}`, request.url);
    successUrl.searchParams.set("roleSuccess", "Role assigned.");

    return NextResponse.redirect(successUrl, 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, teamId, {
          values,
          error: "That role assignment already exists.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, teamId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before assigning roles."
            : "Unable to assign role right now. Please try again.",
      }),
      303,
    );
  }
}
