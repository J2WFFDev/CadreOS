/**
 * Arc 20M — GearOps Cross-Module Integration Readiness
 *
 * Guardian approval boundary helpers.
 *
 * GearOps applies guardian-approval rules when:
 *   1. The target GearCategory has guardianApprovalRequired = true, AND
 *   2. The assignment recipient is identified as an athlete (has guardian
 *      relationships in AthleteGuardianRelationship).
 *
 * Guardian management remains the responsibility of the shared guardian model.
 * GearOps only reads guardian relationships; it does not create or modify them.
 */

import { db } from "@/lib/db";
import type { GearGuardianApprovalBoundary } from "./types";
import { resolveGearGuardianReferences } from "./resolver";

// ── Category-level guardian approval check ───────────────────────────────────

/**
 * Returns whether the given GearCategory requires guardian approval for
 * assignments to athlete recipients.
 *
 * Returns false (never requires approval) if the category is not found or if
 * the organization ID does not match.
 */
export async function resolveCategoryGuardianApprovalRequired(input: {
  organizationId: string;
  gearCategoryId: string;
}): Promise<boolean> {
  const category = await db.gearCategory.findFirst({
    where: { id: input.gearCategoryId, organizationId: input.organizationId },
    select: { guardianApprovalRequired: true },
  });

  return category?.guardianApprovalRequired ?? false;
}

// ── Guardian approval boundary evaluation ────────────────────────────────────

/**
 * Evaluates the guardian approval boundary for a pending gear assignment.
 *
 * Logic:
 * 1. If the category does not require guardian approval → not_required.
 * 2. If it does require approval but the recipient has no guardian on file
 *    → category_requires_approval + no_guardian_on_file.
 *    GearOps blocks assignment and surfaces a warning.
 * 3. If it requires approval and guardians are present
 *    → category_requires_approval + guardian_available.
 *    GearOps surfaces the guardian information for the operator to confirm.
 *
 * The caller decides whether to enforce the block; this function only evaluates
 * the boundary and returns the decision context.
 */
export async function evaluateGearGuardianApprovalBoundary(input: {
  organizationId: string;
  gearCategoryId: string;
  recipientPersonId: string;
}): Promise<GearGuardianApprovalBoundary> {
  const approvalRequired = await resolveCategoryGuardianApprovalRequired({
    organizationId: input.organizationId,
    gearCategoryId: input.gearCategoryId,
  });

  if (!approvalRequired) {
    return {
      required: false,
      reason: "not_required",
      guardianReferences: [],
      canProceedWithoutApproval: true,
      blockerMessage: null,
    };
  }

  // Category requires approval — check whether guardians are on file.
  const guardianReferences = await resolveGearGuardianReferences({
    organizationId: input.organizationId,
    athletePersonId: input.recipientPersonId,
  });

  if (guardianReferences.length === 0) {
    return {
      required: true,
      reason: "no_guardian_on_file",
      guardianReferences: [],
      canProceedWithoutApproval: false,
      blockerMessage:
        "This gear category requires guardian approval for athlete recipients, " +
        "but no guardian is on file for this person. " +
        "Add a guardian relationship before assigning restricted gear.",
    };
  }

  return {
    required: true,
    reason: "guardian_available",
    guardianReferences,
    canProceedWithoutApproval: false,
    blockerMessage: null,
  };
}

// ── Guardian display helpers ─────────────────────────────────────────────────
// Pure display helpers are defined in types.ts (no DB dependency) so they can
// be tested and used independently.  Re-export them here for convenience.
export { formatGuardianApprovalSummary, formatGuardianApprovalBoundaryMessage } from "./types";

// ── Internal helpers ──────────────────────────────────────────────────────────
// (no additional internal helpers — formatRelationshipTypeLabel is in types.ts)
