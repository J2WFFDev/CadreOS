import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  joinPersonWorkflowSchema,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

function buildErrorRedirectUrl(requestUrl: string, input: {
  values: { firstName: string; lastName: string; email: string; phone: string; lifecycleStatus: string };
  fieldErrors?: Partial<Record<"firstName" | "lastName" | "email" | "phone" | "lifecycleStatus", string>>;
  error?: string;
}) {
  const url = new URL("/people/new", requestUrl);

  url.searchParams.set("firstName", input.values.firstName);
  url.searchParams.set("lastName", input.values.lastName);
  url.searchParams.set("email", input.values.email);
  url.searchParams.set("phone", input.values.phone);
  url.searchParams.set("lifecycleStatus", input.values.lifecycleStatus);

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

  if (input.fieldErrors?.lifecycleStatus) {
    url.searchParams.set("lifecycleStatusError", input.fieldErrors.lifecycleStatus);
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
    firstName: getStringField(formData, "firstName"),
    lastName: getStringField(formData, "lastName"),
    email: getStringField(formData, "email"),
    phone: getStringField(formData, "phone"),
    lifecycleStatus: getStringField(formData, "lifecycleStatus") || "ACTIVE",
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: scope.errorMessage ?? "Unable to create person right now.",
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
  const organizationId = scope.organizationId;

  const parsed = joinPersonWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        fieldErrors: {
          firstName: fieldErrors.firstName?.[0],
          lastName: fieldErrors.lastName?.[0],
          email: fieldErrors.email?.[0],
          phone: fieldErrors.phone?.[0],
          lifecycleStatus: fieldErrors.lifecycleStatus?.[0],
        },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "person.create",
    });

    const person = await db.person.create({
      data: {
        organizationId: organizationId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        lifecycleStatus: parsed.data.lifecycleStatus,
      },
    });

    return NextResponse.redirect(new URL(`/people/${person.id}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before creating people."
            : "Unable to create person right now. Please try again.",
      }),
      303,
    );
  }
}
