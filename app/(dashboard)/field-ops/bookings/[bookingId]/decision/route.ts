import { ApprovalStatus, BookingStatus, ConflictSeverity, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import {
  getStringField,
  isPermissionDeniedError,
  isSchemaUnavailableError,
  requirePhase1CMutationPermission,
} from "@/lib/workflows";
import { resolveActorPersonId } from "@/lib/user-account";

type DecisionValue = "approve" | "deny";

function buildErrorRedirectUrl(requestUrl: string, bookingId: string, input: { decision: string; error: string }) {
  const url = new URL(`/field-ops/bookings/${bookingId}`, requestUrl);
  url.searchParams.set("decision", input.decision);
  url.searchParams.set("decisionError", input.error);
  return url;
}

function buildSuccessRedirectUrl(requestUrl: string, bookingId: string, outcome: "approved" | "denied") {
  const url = new URL(`/field-ops/bookings/${bookingId}`, requestUrl);
  url.searchParams.set("decisionOutcome", outcome);
  return url;
}

function parseDecisionValue(value: string): DecisionValue | null {
  return value === "approve" || value === "deny" ? value : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const scope = await getOrganizationScope();
  const formData = await request.formData();
  const rawDecision = getStringField(formData, "decision");
  const decision = parseDecisionValue(rawDecision);

  if (!scope.databaseReady) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, bookingId, {
        decision: rawDecision,
        error: scope.errorMessage ?? "Unable to update booking approval right now.",
      }),
      303,
    );
  }

  if (!scope.organizationId) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, bookingId, {
        decision: rawDecision,
        error: "No organization context is available yet.",
      }),
      303,
    );
  }

  if (!decision) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, bookingId, {
        decision: rawDecision,
        error: "Decision action is invalid.",
      }),
      303,
    );
  }

  try {
    const booking = await db.resourceBooking.findFirst({
      where: {
        id: bookingId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        programId: true,
        teamId: true,
        eventId: true,
        approvalStatus: true,
      },
    });

    if (!booking) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, bookingId, {
          decision,
          error: "Booking not found in the selected organization.",
        }),
        303,
      );
    }

    await requirePhase1CMutationPermission({
      organizationId: scope.organizationId,
      action: decision === "approve" ? "booking.approve" : "booking.deny",
      programId: booking.programId,
      teamId: booking.teamId,
      eventId: booking.eventId,
    });

    if (booking.approvalStatus !== ApprovalStatus.PENDING) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, bookingId, {
          decision,
          error: "Only pending booking requests can be approved or denied.",
        }),
        303,
      );
    }

    if (decision === "approve") {
      const blockingConflictCount = await db.bookingConflict.count({
        where: {
          organizationId: scope.organizationId,
          bookingId: booking.id,
          severity: ConflictSeverity.BLOCKING,
          resolvedAt: null,
        },
      });

      if (blockingConflictCount > 0) {
        return NextResponse.redirect(
          buildErrorRedirectUrl(request.url, bookingId, {
            decision,
            error:
              "This booking has blocking conflicts and cannot be approved under current policy. Resolve conflicts before approving.",
          }),
          303,
        );
      }
    }

    const actorPersonId = await resolveActorPersonId({
      organizationId: scope.organizationId,
      clerkUserId: scope.auth.clerkUserId,
      preferredPersonId: scope.auth.personId,
    });

    if (!actorPersonId) {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, bookingId, {
          decision,
          error: "No organization person is available for booking decision attribution yet.",
        }),
        303,
      );
    }

    await db.resourceBooking.update({
      where: { id: booking.id },
      data:
        decision === "approve"
          ? {
              approvalStatus: ApprovalStatus.APPROVED,
              status: BookingStatus.APPROVED,
              approvedByPersonId: actorPersonId,
            }
          : {
              approvalStatus: ApprovalStatus.DENIED,
              status: BookingStatus.DENIED,
            },
    });

    return NextResponse.redirect(buildSuccessRedirectUrl(request.url, booking.id, decision === "approve" ? "approved" : "denied"), 303);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.redirect(
        buildErrorRedirectUrl(request.url, bookingId, {
          decision,
          error: "Booking decision references are invalid for the selected organization.",
        }),
        303,
      );
    }

    return NextResponse.redirect(
      buildErrorRedirectUrl(request.url, bookingId, {
        decision,
        error: isPermissionDeniedError(error)
          ? error.message
          : isSchemaUnavailableError(error)
            ? "Database schema is not available yet. Run database setup before updating bookings."
            : "Unable to update booking approval right now. Please try again.",
      }),
      303,
    );
  }
}
