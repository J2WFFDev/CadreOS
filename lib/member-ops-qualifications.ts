import {
  CertificationVerificationStatus,
  EligibilityTargetType,
  QualificationAssignmentStatus,
} from "@prisma/client";

export const EXPIRING_SOON_WINDOW_DAYS = 30;

export const QUALIFICATION_ASSIGNMENT_STATUS_LABELS: Record<QualificationAssignmentStatus, string> = {
  [QualificationAssignmentStatus.ACTIVE]: "Active",
  [QualificationAssignmentStatus.EXPIRED]: "Expired",
  [QualificationAssignmentStatus.PENDING]: "Pending",
  [QualificationAssignmentStatus.SUSPENDED]: "Suspended",
};

export const CERTIFICATION_VERIFICATION_STATUS_LABELS: Record<CertificationVerificationStatus, string> = {
  [CertificationVerificationStatus.VERIFIED]: "Verified",
  [CertificationVerificationStatus.PENDING]: "Pending",
  [CertificationVerificationStatus.REJECTED]: "Rejected",
  [CertificationVerificationStatus.EXPIRED]: "Expired",
};

export const ELIGIBILITY_TARGET_TYPE_LABELS: Record<EligibilityTargetType, string> = {
  [EligibilityTargetType.TEAM]: "Team",
  [EligibilityTargetType.PROGRAM]: "Program",
  [EligibilityTargetType.EQUIPMENT]: "Equipment",
  [EligibilityTargetType.ACTIVITY]: "Activity",
  [EligibilityTargetType.RESPONSIBILITY]: "Responsibility",
};

export type ExpirationState = "none" | "current" | "expiringSoon" | "expired";
export type EligibilityEvaluationStatus = "eligible" | "pending" | "expired" | "suspended" | "missing";

type QualificationLike = {
  qualification: { id: string; name: string };
  status: QualificationAssignmentStatus;
  expirationDate: Date | null;
};

type CertificationLike = {
  certification: { id: string; name: string };
  verificationStatus: CertificationVerificationStatus;
  expirationDate: Date | null;
};

type EligibilityLike = {
  id: string;
  name: string;
  targetType: EligibilityTargetType;
  targetLabel: string | null;
  team: { name: string } | null;
  program: { name: string } | null;
  requiredQualifications: Array<{ qualification: { id: string; name: string } }>;
  requiredCertifications: Array<{ certification: { id: string; name: string } }>;
};

export function getExpirationState(
  expirationDate: Date | null,
  now: Date = new Date(),
  windowDays = EXPIRING_SOON_WINDOW_DAYS,
): ExpirationState {
  if (!expirationDate) {
    return "none";
  }

  const normalizedNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const normalizedExpiration = Date.UTC(
    expirationDate.getUTCFullYear(),
    expirationDate.getUTCMonth(),
    expirationDate.getUTCDate(),
  );

  if (normalizedExpiration < normalizedNow) {
    return "expired";
  }

  const expiringSoonCutoff = normalizedNow + windowDays * 24 * 60 * 60 * 1000;
  if (normalizedExpiration <= expiringSoonCutoff) {
    return "expiringSoon";
  }

  return "current";
}

export function resolveQualificationAssignmentStatus(
  status: QualificationAssignmentStatus,
  expirationDate: Date | null,
  now: Date = new Date(),
): QualificationAssignmentStatus {
  if (status === QualificationAssignmentStatus.SUSPENDED || status === QualificationAssignmentStatus.EXPIRED) {
    return status;
  }

  return getExpirationState(expirationDate, now) === "expired"
    ? QualificationAssignmentStatus.EXPIRED
    : status;
}

export function resolveCertificationVerificationStatus(
  status: CertificationVerificationStatus,
  expirationDate: Date | null,
  now: Date = new Date(),
): CertificationVerificationStatus {
  if (status === CertificationVerificationStatus.REJECTED || status === CertificationVerificationStatus.EXPIRED) {
    return status;
  }

  return getExpirationState(expirationDate, now) === "expired"
    ? CertificationVerificationStatus.EXPIRED
    : status;
}

export function buildEligibilityTargetLabel(input: {
  targetType: EligibilityTargetType;
  targetLabel: string | null;
  team: { name: string } | null;
  program: { name: string } | null;
}): string {
  if (input.targetType === EligibilityTargetType.TEAM && input.team?.name) {
    return input.team.name;
  }

  if (input.targetType === EligibilityTargetType.PROGRAM && input.program?.name) {
    return input.program.name;
  }

  return input.targetLabel?.trim() || "General";
}

export function summarizeEligibility(
  definitions: EligibilityLike[],
  qualifications: QualificationLike[],
  certifications: CertificationLike[],
  now: Date = new Date(),
) {
  return definitions.map((definition) => {
    const qualificationChecks = definition.requiredQualifications.map((requirement) => {
      const assignment = qualifications.find(
        (qualification) => qualification.qualification.id === requirement.qualification.id,
      );
      const resolvedStatus = assignment
        ? resolveQualificationAssignmentStatus(assignment.status, assignment.expirationDate, now)
        : null;

      return {
        name: requirement.qualification.name,
        state:
          resolvedStatus === QualificationAssignmentStatus.ACTIVE
            ? "eligible"
            : resolvedStatus === QualificationAssignmentStatus.PENDING
              ? "pending"
              : resolvedStatus === QualificationAssignmentStatus.EXPIRED
                ? "expired"
                : resolvedStatus === QualificationAssignmentStatus.SUSPENDED
                  ? "suspended"
                  : "missing",
      } as const;
    });

    const certificationChecks = definition.requiredCertifications.map((requirement) => {
      const assignment = certifications.find(
        (certification) => certification.certification.id === requirement.certification.id,
      );
      const resolvedStatus = assignment
        ? resolveCertificationVerificationStatus(
            assignment.verificationStatus,
            assignment.expirationDate,
            now,
          )
        : null;

      return {
        name: requirement.certification.name,
        state:
          resolvedStatus === CertificationVerificationStatus.VERIFIED
            ? "eligible"
            : resolvedStatus === CertificationVerificationStatus.PENDING
              ? "pending"
              : resolvedStatus === CertificationVerificationStatus.EXPIRED
                ? "expired"
                : resolvedStatus === CertificationVerificationStatus.REJECTED
                  ? "suspended"
                  : "missing",
      } as const;
    });

    const allRequirementChecks = [...qualificationChecks, ...certificationChecks];
    const statePriority: EligibilityEvaluationStatus[] = ["suspended", "expired", "pending", "missing"];
    const status =
      statePriority.find((candidate) =>
        allRequirementChecks.some((requirement) => requirement.state === candidate),
      ) ?? "eligible";

    return {
      id: definition.id,
      name: definition.name,
      targetType: definition.targetType,
      targetLabel: buildEligibilityTargetLabel(definition),
      requiredCount: allRequirementChecks.length,
      status,
      missingRequirements: allRequirementChecks
        .filter((requirement) => requirement.state !== "eligible")
        .map((requirement) => requirement.name),
    };
  });
}
