import { NextResponse } from "next/server";

import {
  createBootstrapOrganizationAdmin,
  getBootstrapOrganizationAdminEligibility,
} from "@/lib/bootstrap-admin";
import { getOrganizationScope } from "@/lib/organization-context";

function buildBootstrapRedirectUrl(requestUrl: string, input: { status?: string; error?: string }) {
  const url = new URL("/account/bootstrap-admin", requestUrl);

  if (input.status) {
    url.searchParams.set("status", input.status);
  }

  if (input.error) {
    url.searchParams.set("error", input.error);
  }

  return url;
}

export async function POST(request: Request) {
  const scope = await getOrganizationScope();
  const eligibility = await getBootstrapOrganizationAdminEligibility(scope);

  if (eligibility.reason === "ACCOUNT_UNLINKED") {
    return NextResponse.redirect(new URL("/account/link-person", request.url), 303);
  }

  if (!eligibility.isEligible || !eligibility.organizationId || !eligibility.personId) {
    return NextResponse.redirect(
      buildBootstrapRedirectUrl(request.url, {
        error:
          eligibility.reason === "ADMIN_EXISTS"
            ? "An Organization Admin already exists. Ask an existing Organization Admin to assign your roles."
            : "Bootstrap eligibility checks did not pass for this session.",
      }),
      303,
    );
  }

  const result = await createBootstrapOrganizationAdmin({
    organizationId: eligibility.organizationId,
    personId: eligibility.personId,
  });

  if (result.status === "CREATED" || result.status === "ALREADY_ASSIGNED") {
    return NextResponse.redirect(
      buildBootstrapRedirectUrl(request.url, {
        status: "success",
      }),
      303,
    );
  }

  if (result.status === "ADMIN_EXISTS") {
    return NextResponse.redirect(
      buildBootstrapRedirectUrl(request.url, {
        error: "An Organization Admin already exists. Ask an existing Organization Admin to assign your roles.",
      }),
      303,
    );
  }

  if (result.status === "PERSON_NOT_IN_ORGANIZATION") {
    return NextResponse.redirect(
      buildBootstrapRedirectUrl(request.url, {
        error: "Your linked person is not in the active organization. Re-link your account and try again.",
      }),
      303,
    );
  }

  return NextResponse.redirect(
    buildBootstrapRedirectUrl(request.url, {
      error: "Bootstrap could not be completed due to a concurrent update. Please try again.",
    }),
    303,
  );
}
