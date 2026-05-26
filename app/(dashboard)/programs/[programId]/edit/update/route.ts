import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  programWorkflowSchema,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, programId: string, input: {
  values: { name: string };
  fieldErrors?: Partial<Record<"name", string>>;
  error?: string;
}) {
  const url = new URL(`/programs/${programId}/edit`, requestUrl);

  url.searchParams.set("name", input.values.name);

  if (input.fieldErrors?.name) {
    url.searchParams.set("nameError", input.fieldErrors.name);
  }

  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ programId: string }> },
) {
  const { programId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values = {
    name: getStringField(formData, "name"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, {
        values,
        error: scope.errorMessage ?? "Unable to update program right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = programWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, {
        values,
        fieldErrors: {
          name: fieldErrors.name?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "program.update",
      programId,
    });

    const existingProgram = await db.program.findFirst({
      where: {
        organizationId: organizationId,
        name: parsed.data.name,
        NOT: {
          id: programId,
        },
      },
      select: { id: true },
    });

    if (existingProgram) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, {
          values,
          fieldErrors: {
            name: "A program with this name already exists in this organization.",
          },
          error: "Program already exists in this organization.",
        }),
        303,
      );
    }

    const updated = await db.program.updateMany({
      where: {
        id: programId,
        organizationId: organizationId,
      },
      data: {
        name: parsed.data.name,
      },
    });

    if (updated.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, {
          values,
          error: "Program not found in the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/programs/${programId}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, {
          values,
          fieldErrors: {
            name: "A program with this name already exists in this organization.",
          },
          error: "Program already exists in this organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before editing programs."
            : "Unable to update program right now. Please try again.",
      }),
      303,
    );
  }
}
