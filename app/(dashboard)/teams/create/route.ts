import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
  teamWorkflowSchema,
} from "@/lib/phase1c/workflows";

function buildErrorRedirectUrl(requestUrl: string, input: {
  values: { name: string; programId: string };
  fieldErrors?: Partial<Record<"name" | "programId", string>>;
  error?: string;
}) {
  const url = new URL("/teams/new", requestUrl);

  url.searchParams.set("name", input.values.name);
  url.searchParams.set("programId", input.values.programId);

  if (input.fieldErrors?.name) {
    url.searchParams.set("nameError", input.fieldErrors.name);
  }

  if (input.fieldErrors?.programId) {
    url.searchParams.set("programIdError", input.fieldErrors.programId);
  }

  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    name: getStringField(formData, "name"),
    programId: getStringField(formData, "programId"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: scope.errorMessage ?? "Unable to create team right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  const parsed = teamWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        fieldErrors: {
          name: fieldErrors.name?.[0],
          programId: fieldErrors.programId?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "team.create",
    });

    const program = await db.program.findFirst({
      where: {
        id: parsed.data.programId,
        organizationId: scope.organizationId,
      },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          fieldErrors: {
            programId: "Select a valid program in the active organization.",
          },
          error: "Program selection is invalid.",
        }),
        303,
      );
    }

    await db.team.create({
      data: {
        organizationId: scope.organizationId,
        programId: parsed.data.programId,
        name: parsed.data.name,
      },
    });

    return NextResponse.redirect(new URL("/teams", request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, {
          values,
          fieldErrors: {
            name: "A team with this name already exists for the selected program.",
          },
          error: "Team already exists for this program.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: isSchemaUnavailableError(error)
          ? "Database schema is not available yet. Run database setup before creating teams."
          : "Unable to create team right now. Please try again.",
      }),
      303,
    );
  }
}
