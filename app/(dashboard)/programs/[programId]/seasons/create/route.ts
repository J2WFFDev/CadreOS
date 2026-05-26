import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
  seasonWorkflowSchema,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, programId: string, input: {
  values: { name: string; startDate: string; endDate: string };
  fieldErrors?: Partial<Record<"name" | "startDate" | "endDate", string>>;
  error?: string;
}) {
  const url = new URL(`/programs/${programId}/seasons/new`, requestUrl);

  url.searchParams.set("name", input.values.name);
  url.searchParams.set("startDate", input.values.startDate);
  url.searchParams.set("endDate", input.values.endDate);

  if (input.fieldErrors?.name) {
    url.searchParams.set("nameError", input.fieldErrors.name);
  }

  if (input.fieldErrors?.startDate) {
    url.searchParams.set("startDateError", input.fieldErrors.startDate);
  }

  if (input.fieldErrors?.endDate) {
    url.searchParams.set("endDateError", input.fieldErrors.endDate);
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
    startDate: getStringField(formData, "startDate"),
    endDate: getStringField(formData, "endDate"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, {
        values,
        error: scope.errorMessage ?? "Unable to create season right now.",
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

  const parsed = seasonWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, programId, {
        values,
        fieldErrors: {
          name: fieldErrors.name?.[0],
          startDate: fieldErrors.startDate?.[0],
          endDate: fieldErrors.endDate?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "season.create",
      programId,
    });

    const program = await db.program.findFirst({
      where: {
        id: programId,
        organizationId: organizationId,
      },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, {
          values,
          error: "Program not found in the selected organization.",
        }),
        303,
      );
    }

    const existingSeason = await db.season.findFirst({
      where: {
        organizationId: organizationId,
        programId,
        name: parsed.data.name,
      },
      select: {
        id: true,
      },
    });

    if (existingSeason) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, {
          values,
          fieldErrors: {
            name: "A season with this name already exists for the selected program.",
          },
          error: "Season already exists for this program.",
        }),
        303,
      );
    }

    await db.season.create({
      data: {
        organizationId: organizationId,
        programId,
        name: parsed.data.name,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      },
    });

    return NextResponse.redirect(new URL(`/programs/${programId}`, request.url), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, programId, {
          values,
          fieldErrors: {
            name: "A season with this name already exists for the selected program.",
          },
          error: "Season already exists for this program.",
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
            ? "Database schema is not available yet. Run database setup before creating seasons."
            : "Unable to create season right now. Please try again.",
      }),
      303,
    );
  }
}
