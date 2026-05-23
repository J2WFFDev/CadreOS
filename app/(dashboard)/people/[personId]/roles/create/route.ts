import { Prisma, ScopeType } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
  roleAssignmentWorkflowSchema,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, personId: string, input: {
  values: { roleType: string; scopeType: string; programId: string; teamId: string };
  fieldErrors?: Partial<Record<"roleType" | "scopeType" | "programId" | "teamId", string>>;
  error?: string;
}) {
  const url = new URL(`/people/${personId}`, requestUrl);

  url.searchParams.set("roleType", input.values.roleType);
  url.searchParams.set("scopeType", input.values.scopeType);
  url.searchParams.set("programId", input.values.programId);
  url.searchParams.set("teamId", input.values.teamId);

  if (input.fieldErrors?.roleType) {
    url.searchParams.set("roleTypeError", input.fieldErrors.roleType);
  }

  if (input.fieldErrors?.scopeType) {
    url.searchParams.set("scopeTypeError", input.fieldErrors.scopeType);
  }

  if (input.fieldErrors?.programId) {
    url.searchParams.set("programIdError", input.fieldErrors.programId);
  }

  if (input.fieldErrors?.teamId) {
    url.searchParams.set("teamIdError", input.fieldErrors.teamId);
  }

  if (input.error) {
    url.searchParams.set("roleError", input.error);
  }

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
    roleType: getStringField(formData, "roleType"),
    scopeType: getStringField(formData, "scopeType"),
    programId: getStringField(formData, "programId"),
    teamId: getStringField(formData, "teamId"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        error: scope.errorMessage ?? "Unable to assign role right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const parsed = roleAssignmentWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        fieldErrors: {
          roleType: fieldErrors.roleType?.[0],
          scopeType: fieldErrors.scopeType?.[0],
          programId: fieldErrors.programId?.[0],
          teamId: fieldErrors.teamId?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "roleAssignment.create",
    });

    const person = await db.person.findFirst({
      where: {
        id: personId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!person) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          error: "Person not found in the selected organization.",
        }),
        303,
      );
    }

    let normalizedProgramId: string | null = null;
    let normalizedTeamId: string | null = null;

    if (parsed.data.scopeType === ScopeType.PROGRAM) {
      const program = await db.program.findFirst({
        where: {
          id: parsed.data.programId ?? "",
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!program) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, personId, {
            values,
            fieldErrors: {
              programId: "Select a valid program in the active organization.",
            },
            error: "Program selection is invalid.",
          }),
          303,
        );
      }

      normalizedProgramId = program.id;
    }

    if (parsed.data.scopeType === ScopeType.TEAM) {
      const team = await db.team.findFirst({
        where: {
          id: parsed.data.teamId ?? "",
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          programId: true,
        },
      });

      if (!team) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, personId, {
            values,
            fieldErrors: {
              teamId: "Select a valid team in the active organization.",
            },
            error: "Team selection is invalid.",
          }),
          303,
        );
      }

      if (parsed.data.programId && parsed.data.programId !== team.programId) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, personId, {
            values,
            fieldErrors: {
              programId: "When provided, program must match the selected team's program.",
            },
            error: "Program and team selection do not match.",
          }),
          303,
        );
      }

      normalizedTeamId = team.id;
      normalizedProgramId = team.programId;
    }

    const existing = await db.roleAssignment.findFirst({
      where: {
        organizationId: scope.organizationId,
        personId: person.id,
        roleType: parsed.data.roleType,
        scopeType: parsed.data.scopeType,
        programId: normalizedProgramId,
        teamId: normalizedTeamId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          error: "That role assignment already exists for this person.",
        }),
        303,
      );
    }

    await db.roleAssignment.create({
      data: {
        organizationId: scope.organizationId,
        personId: person.id,
        roleType: parsed.data.roleType,
        scopeType: parsed.data.scopeType,
        programId: normalizedProgramId,
        teamId: normalizedTeamId,
      },
    });

    return NextResponse.redirect(new URL(`/people/${personId}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          error: "That role assignment already exists.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        error: isSchemaUnavailableError(error)
          ? "Database schema is not available yet. Run database setup before assigning roles."
          : "Unable to assign role right now. Please try again.",
      }),
      303,
    );
  }
}
