import {
  CertificationVerificationStatus,
  Prisma,
  QualificationAssignmentStatus,
  StaffingAssignmentStatus,
  StaffingCoverageType,
  StaffingRoleCategory,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  resolveCertificationVerificationStatus,
  resolveQualificationAssignmentStatus,
} from "@/lib/member-ops-qualifications";

export const STAFFING_ASSIGNMENT_STATUS_LABELS: Record<StaffingAssignmentStatus, string> = {
  [StaffingAssignmentStatus.ACTIVE]: "Active",
  [StaffingAssignmentStatus.INACTIVE]: "Inactive",
  [StaffingAssignmentStatus.PENDING]: "Pending",
  [StaffingAssignmentStatus.SUSPENDED]: "Suspended",
};

export const STAFFING_ROLE_CATEGORY_LABELS: Record<StaffingRoleCategory, string> = {
  [StaffingRoleCategory.COACHING]: "Coaching",
  [StaffingRoleCategory.VOLUNTEER]: "Volunteer",
  [StaffingRoleCategory.STAFF]: "Staff",
  [StaffingRoleCategory.ADMIN]: "Admin",
};

export const STAFFING_COVERAGE_TYPE_LABELS: Record<StaffingCoverageType, string> = {
  [StaffingCoverageType.PRACTICE]: "Practices",
  [StaffingCoverageType.MATCH]: "Matches",
  [StaffingCoverageType.CLINIC]: "Clinics",
  [StaffingCoverageType.MEETING]: "Meetings",
};

type StaffingRoleSeedDefinition = {
  key: string;
  name: string;
  category: StaffingRoleCategory;
  description: string;
  requiredQualificationType: "CERTIFICATION" | "QUALIFICATION" | null;
  requiredQualificationName: string | null;
};

export const DEFAULT_STAFFING_ROLE_DEFINITIONS: StaffingRoleSeedDefinition[] = [
  {
    key: "COACH",
    name: "Coach",
    category: StaffingRoleCategory.COACHING,
    description: "General coach staffing assignment.",
    requiredQualificationType: "CERTIFICATION",
    requiredQualificationName: "SASP Coach Certification",
  },
  {
    key: "ASSISTANT_COACH",
    name: "Assistant Coach",
    category: StaffingRoleCategory.COACHING,
    description: "Assistant coaching staffing assignment.",
    requiredQualificationType: "CERTIFICATION",
    requiredQualificationName: "SASP Coach Certification",
  },
  {
    key: "HEAD_COACH",
    name: "Head Coach",
    category: StaffingRoleCategory.COACHING,
    description: "Head coaching staffing assignment.",
    requiredQualificationType: "CERTIFICATION",
    requiredQualificationName: "SASP Coach Certification",
  },
  {
    key: "VOLUNTEER",
    name: "Volunteer",
    category: StaffingRoleCategory.VOLUNTEER,
    description: "Volunteer coverage assignment.",
    requiredQualificationType: "QUALIFICATION",
    requiredQualificationName: "Background Check",
  },
  {
    key: "BOARD_MEMBER",
    name: "Board Member",
    category: StaffingRoleCategory.ADMIN,
    description: "Board governance assignment.",
    requiredQualificationType: null,
    requiredQualificationName: null,
  },
  {
    key: "RANGE_OFFICER",
    name: "Range Officer",
    category: StaffingRoleCategory.STAFF,
    description: "Range safety staffing assignment.",
    requiredQualificationType: "CERTIFICATION",
    requiredQualificationName: "Range Officer Certification",
  },
  {
    key: "MATCH_STAFF",
    name: "Match Staff",
    category: StaffingRoleCategory.STAFF,
    description: "Match operations staffing assignment.",
    requiredQualificationType: null,
    requiredQualificationName: null,
  },
  {
    key: "GEAROPS_STAFF",
    name: "GearOps Staff",
    category: StaffingRoleCategory.STAFF,
    description: "Equipment and inventory staffing assignment.",
    requiredQualificationType: null,
    requiredQualificationName: null,
  },
  {
    key: "PROGRAM_ADMIN",
    name: "Program Admin",
    category: StaffingRoleCategory.ADMIN,
    description: "Program administration assignment.",
    requiredQualificationType: null,
    requiredQualificationName: null,
  },
  {
    key: "ORGANIZATION_ADMIN",
    name: "Organization Admin",
    category: StaffingRoleCategory.ADMIN,
    description: "Organization-wide administration assignment.",
    requiredQualificationType: null,
    requiredQualificationName: null,
  },
];

export type StaffingQualificationCompatibility = {
  requirementLabel: string;
  statusLabel: "Compatible" | "Pending" | "Missing" | "Needs review" | "Not required";
  tone: "green" | "amber" | "red" | "zinc";
};

export async function ensureStaffingRoleFoundation(organizationId: string): Promise<void> {
  await db.$transaction(
    DEFAULT_STAFFING_ROLE_DEFINITIONS.map((role) =>
      db.staffingRole.upsert({
        where: {
          organizationId_key: {
            organizationId,
            key: role.key,
          },
        },
        create: {
          organizationId,
          key: role.key,
          name: role.name,
          category: role.category,
          description: role.description,
          requiredQualificationType: role.requiredQualificationType,
          requiredQualificationName: role.requiredQualificationName,
          isSystemDefined: true,
        },
        update: {
          name: role.name,
          category: role.category,
          description: role.description,
          requiredQualificationType: role.requiredQualificationType,
          requiredQualificationName: role.requiredQualificationName,
          active: true,
          isSystemDefined: true,
        },
      }),
    ),
  );
}

export function resolveStaffingQualificationCompatibility(input: {
  requiredQualificationType: string | null;
  requiredQualificationName: string | null;
  personQualifications: Array<{
    qualification: { name: string };
    status: QualificationAssignmentStatus;
    expirationDate: Date | null;
  }>;
  personCertifications: Array<{
    certification: { name: string };
    verificationStatus: CertificationVerificationStatus;
    expirationDate: Date | null;
  }>;
  now?: Date;
}): StaffingQualificationCompatibility {
  const requirementName = input.requiredQualificationName?.trim();
  const requirementType = input.requiredQualificationType?.trim().toUpperCase() ?? null;

  if (!requirementName || !requirementType) {
    return {
      requirementLabel: "No staffing qualification requirement",
      statusLabel: "Not required",
      tone: "zinc",
    };
  }

  if (requirementType === "CERTIFICATION") {
    const certification = input.personCertifications.find(
      (assignment) => assignment.certification.name.toLowerCase() === requirementName.toLowerCase(),
    );

    if (!certification) {
      return { requirementLabel: requirementName, statusLabel: "Missing", tone: "red" };
    }

    const resolvedStatus = resolveCertificationVerificationStatus(
      certification.verificationStatus,
      certification.expirationDate,
      input.now,
    );

    if (resolvedStatus === CertificationVerificationStatus.VERIFIED) {
      return { requirementLabel: requirementName, statusLabel: "Compatible", tone: "green" };
    }

    if (resolvedStatus === CertificationVerificationStatus.PENDING) {
      return { requirementLabel: requirementName, statusLabel: "Pending", tone: "amber" };
    }

    return { requirementLabel: requirementName, statusLabel: "Needs review", tone: "red" };
  }

  if (requirementType === "QUALIFICATION") {
    const qualification = input.personQualifications.find(
      (assignment) => assignment.qualification.name.toLowerCase() === requirementName.toLowerCase(),
    );

    if (!qualification) {
      return { requirementLabel: requirementName, statusLabel: "Missing", tone: "red" };
    }

    const resolvedStatus = resolveQualificationAssignmentStatus(
      qualification.status,
      qualification.expirationDate,
      input.now,
    );

    if (resolvedStatus === QualificationAssignmentStatus.ACTIVE) {
      return { requirementLabel: requirementName, statusLabel: "Compatible", tone: "green" };
    }

    if (resolvedStatus === QualificationAssignmentStatus.PENDING) {
      return { requirementLabel: requirementName, statusLabel: "Pending", tone: "amber" };
    }

    return { requirementLabel: requirementName, statusLabel: "Needs review", tone: "red" };
  }

  return {
    requirementLabel: requirementName,
    statusLabel: "Not required",
    tone: "zinc",
  };
}

export function isCoachingStaffingCategory(category: StaffingRoleCategory | string): boolean {
  return category === StaffingRoleCategory.COACHING;
}

export function isVolunteerStaffingCategory(category: StaffingRoleCategory | string): boolean {
  return category === StaffingRoleCategory.VOLUNTEER;
}

export function dateInputToNullableDate(value: string): Date | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const [year, month, day] = normalized.split("-").map((segment) => Number(segment));

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function buildStaffingAssignmentAuditPayload(input: {
  assignmentId: string;
  personId: string;
  staffingRoleId: string;
  staffingRoleName: string;
  status: StaffingAssignmentStatus;
  programId: string | null;
  teamId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  coverage: StaffingCoverageType[];
}): Prisma.JsonObject {
  return {
    assignmentId: input.assignmentId,
    personId: input.personId,
    staffingRoleId: input.staffingRoleId,
    staffingRoleName: input.staffingRoleName,
    status: input.status,
    programId: input.programId,
    teamId: input.teamId,
    startDate: input.startDate?.toISOString() ?? null,
    endDate: input.endDate?.toISOString() ?? null,
    coverage: input.coverage,
  };
}
