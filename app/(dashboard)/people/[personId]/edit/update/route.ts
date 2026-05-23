import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isSchemaUnavailableError,
  personWorkflowSchema,
  requirePhase1CMutationPermission,
} from "@/lib/phase1c/workflows";

function buildErrorRedirectUrl(requestUrl: string, personId: string, input: {
  values: { firstName: string; lastName: string; email: string; phone: string };
  fieldErrors?: Partial<Record<"firstName" | "lastName" | "email" | "phone", string>>;
  error?: string;
}) {
  const url = new URL(`/people/${personId}/edit`, requestUrl);

  url.searchParams.set("firstName", input.values.firstName);
  url.searchParams.set("lastName", input.values.lastName);
  url.searchParams.set("email", input.values.email);
  url.searchParams.set("phone", input.values.phone);

  if (input.fieldErrors?.firstName) {
    url.searchParams.set("firstNameError", input.fieldErrors.firstName);
  }

  if (input.fieldErrors?.lastName) {
    url.searchParams.set("lastNameError", input.fieldErrors.lastName);
  }

  if (input.fieldErrors?.email) {
    url.searchParams.set("emailError", input.fieldErrors.email);
  }

  if (input.fieldErrors?.phone) {
    url.searchParams.set("phoneError", input.fieldErrors.phone);
  }

  if (input.error) {
    url.searchParams.set("error", input.error);
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
    firstName: getStringField(formData, "firstName"),
    lastName: getStringField(formData, "lastName"),
    email: getStringField(formData, "email"),
    phone: getStringField(formData, "phone"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        error: scope.errorMessage ?? "Unable to update person right now.",
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

  const parsed = personWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        fieldErrors: {
          firstName: fieldErrors.firstName?.[0],
          lastName: fieldErrors.lastName?.[0],
          email: fieldErrors.email?.[0],
          phone: fieldErrors.phone?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: "person.update",
    });

    const updated = await db.person.updateMany({
      where: {
        id: personId,
        organizationId: scope.organizationId,
      },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
    });

    if (updated.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, personId, {
          values,
          error: "Person not found in the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/people/${personId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, personId, {
        values,
        error: isSchemaUnavailableError(error)
          ? "Database schema is not available yet. Run database setup before editing people."
          : "Unable to update person right now. Please try again.",
      }),
      303,
    );
  }
}
