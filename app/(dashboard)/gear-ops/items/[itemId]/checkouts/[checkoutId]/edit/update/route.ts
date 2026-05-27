import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildGearCheckoutReturnNotes } from "@/lib/gear-checkout-usage";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  gearCheckoutWorkflowSchema,
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";

type GearCheckoutFormValues = {
  status: string;
  checkedOutById: string;
  issuedById: string;
  eventId: string;
  checkedOutAt: string;
  expectedReturnAt: string;
  returnedAt: string;
  returnedById: string;
  receivedById: string;
  conditionOnReturn: string;
  usageLog: string;
  purposeNotes: string;
  returnNotes: string;
};

function buildErrorRedirectUrl(
  requestUrl: string,
  itemId: string,
  checkoutId: string,
  input: {
    values: GearCheckoutFormValues;
    fieldErrors?: Partial<Record<keyof GearCheckoutFormValues, string>>;
    error?: string;
  },
) {
  const url = new URL(`/gear-ops/items/${itemId}/checkouts/${checkoutId}/edit`, requestUrl);

  Object.entries(input.values).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  if (input.fieldErrors) {
    Object.entries(input.fieldErrors).forEach(([key, message]) => {
      if (message) {
        url.searchParams.set(`${key}Error`, message);
      }
    });
  }

  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

async function ensurePersonInOrganization(personId: string, organizationId: string) {
  const person = await db.person.findFirst({
    where: { id: personId, organizationId },
    select: { id: true },
  });

  return Boolean(person);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string; checkoutId: string }> },
) {
  const { itemId, checkoutId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();

  const values: GearCheckoutFormValues = {
    status: getStringField(formData, "status"),
    checkedOutById: getStringField(formData, "checkedOutById"),
    issuedById: getStringField(formData, "issuedById"),
    eventId: getStringField(formData, "eventId"),
    checkedOutAt: getStringField(formData, "checkedOutAt"),
    expectedReturnAt: getStringField(formData, "expectedReturnAt"),
    returnedAt: getStringField(formData, "returnedAt"),
    returnedById: getStringField(formData, "returnedById"),
    receivedById: getStringField(formData, "receivedById"),
    conditionOnReturn: getStringField(formData, "conditionOnReturn"),
    usageLog: getStringField(formData, "usageLog"),
    purposeNotes: getStringField(formData, "purposeNotes"),
    returnNotes: getStringField(formData, "returnNotes"),
  };

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, checkoutId, {
        values,
        error: scope.errorMessage ?? "Unable to update checkout right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, checkoutId, {
        values,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }
  const organizationId = scope.organizationId;

  const parsed = gearCheckoutWorkflowSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, checkoutId, {
        values,
        fieldErrors: {
          status: fieldErrors.status?.[0],
          checkedOutById: fieldErrors.checkedOutById?.[0],
          issuedById: fieldErrors.issuedById?.[0],
          eventId: fieldErrors.eventId?.[0],
          checkedOutAt: fieldErrors.checkedOutAt?.[0],
          expectedReturnAt: fieldErrors.expectedReturnAt?.[0],
          returnedAt: fieldErrors.returnedAt?.[0],
            returnedById: fieldErrors.returnedById?.[0],
            receivedById: fieldErrors.receivedById?.[0],
            conditionOnReturn: fieldErrors.conditionOnReturn?.[0],
            usageLog: fieldErrors.usageLog?.[0],
            purposeNotes: fieldErrors.purposeNotes?.[0],
            returnNotes: fieldErrors.returnNotes?.[0],
          },
        error: "Please correct the highlighted fields.",
      }),
      303,
    );
  }

  try {
    await requirePhase1CMutationPermission({
      organizationId: organizationId,
      action: "gearCheckout.update",
    });

    if (!(await ensurePersonInOrganization(parsed.data.checkedOutById, organizationId))) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, checkoutId, {
          values,
          fieldErrors: {
            checkedOutById: "The selected checked-out person does not exist in this organization.",
          },
          error: "Checked-out person not found in this organization.",
        }),
        303,
      );
    }

    if (!(await ensurePersonInOrganization(parsed.data.issuedById, organizationId))) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, checkoutId, {
          values,
          fieldErrors: {
            issuedById: "The selected issuing person does not exist in this organization.",
          },
          error: "Issuing person not found in this organization.",
        }),
        303,
      );
    }

    if (parsed.data.returnedById && !(await ensurePersonInOrganization(parsed.data.returnedById, organizationId))) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, checkoutId, {
          values,
          fieldErrors: {
            returnedById: "The selected returned-by person does not exist in this organization.",
          },
          error: "Returned-by person not found in this organization.",
        }),
        303,
      );
    }

    if (parsed.data.receivedById && !(await ensurePersonInOrganization(parsed.data.receivedById, organizationId))) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, checkoutId, {
          values,
          fieldErrors: {
            receivedById: "The selected received-by person does not exist in this organization.",
          },
          error: "Received-by person not found in this organization.",
        }),
        303,
      );
    }

    if (parsed.data.eventId) {
      const event = await db.event.findFirst({
        where: { id: parsed.data.eventId, organizationId: organizationId },
        select: { id: true },
      });

      if (!event) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, itemId, checkoutId, {
            values,
            fieldErrors: {
              eventId: "The selected event does not exist in this organization.",
            },
            error: "Event not found in this organization.",
          }),
          303,
        );
      }
    }

    const updated = await db.gearCheckout.updateMany({
      where: {
        id: checkoutId,
        gearItemId: itemId,
        organizationId: organizationId,
      },
      data: {
        status: parsed.data.status,
        checkedOutById: parsed.data.checkedOutById,
        issuedById: parsed.data.issuedById,
        eventId: parsed.data.eventId,
        checkedOutAt: parsed.data.checkedOutAt,
        expectedReturnAt: parsed.data.expectedReturnAt,
        returnedAt: parsed.data.returnedAt,
        returnedById: parsed.data.returnedById,
        receivedById: parsed.data.receivedById,
        conditionOnReturn: parsed.data.conditionOnReturn,
        purposeNotes: parsed.data.purposeNotes,
        returnNotes: buildGearCheckoutReturnNotes({
          usageLog: parsed.data.usageLog,
          returnNotes: parsed.data.returnNotes,
        }),
      },
    });

    if (updated.count === 0) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, itemId, checkoutId, {
          values,
          error: "Checkout not found for this gear item in the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(new URL(`/gear-ops/items/${itemId}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, itemId, checkoutId, {
        values,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before editing checkouts."
            : "Unable to update checkout right now. Please try again.",
      }),
      303,
    );
  }
}
