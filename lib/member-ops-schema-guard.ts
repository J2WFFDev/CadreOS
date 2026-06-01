import { Prisma } from "@prisma/client";

export const MEMBEROPS_LIFECYCLE_HOUSEHOLD_MIGRATION_NAME =
  "20260601040500_arc26b_member_lifecycle_household_foundation";
export const MEMBEROPS_QUALIFICATIONS_MIGRATION_NAME =
  "20260601130000_arc26c_member_qualification_eligibility_foundation";

export type MemberOpsPeopleSchemaRequirement =
  | "Person.lifecycleStatusChangedAt"
  | "Person.lifecycleStatusReason"
  | "AthleteGuardianRelationship"
  | "AthleteGuardianRelationship.guardianRole"
  | "GuardianRelationshipRole"
  | "QualificationDefinition"
  | "PersonQualification"
  | "CertificationDefinition"
  | "PersonCertification"
  | "EligibilityDefinition"
  | "EligibilityRequiredQualification"
  | "EligibilityRequiredCertification";

export type MemberOpsPeopleSchemaIssue = {
  missing: MemberOpsPeopleSchemaRequirement[];
  detail: string;
  migrations: string[];
};

function includesValue(source: string | null | undefined, value: string) {
  return source?.toLowerCase().includes(value.toLowerCase()) ?? false;
}

function stringifyErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function appendRequirement(
  missing: Set<MemberOpsPeopleSchemaRequirement>,
  details: string[],
  requirement: MemberOpsPeopleSchemaRequirement,
  detail: string,
) {
  missing.add(requirement);
  details.push(detail);
}

export function getMemberOpsPeopleSchemaIssue(error: unknown): MemberOpsPeopleSchemaIssue | null {
  const missing = new Set<MemberOpsPeopleSchemaRequirement>();
  const details: string[] = [];

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = (error.meta ?? {}) as Record<string, unknown>;
    const table = typeof meta.table === "string" ? meta.table : null;
    const column = typeof meta.column === "string" ? meta.column : null;

    if (error.code === "P2021") {
      if (includesValue(table, "AthleteGuardianRelationship")) {
        appendRequirement(missing, details, "AthleteGuardianRelationship", `Missing database table: ${table}`);
      }
      if (includesValue(table, "QualificationDefinition")) {
        appendRequirement(missing, details, "QualificationDefinition", `Missing database table: ${table}`);
      }
      if (includesValue(table, "PersonQualification")) {
        appendRequirement(missing, details, "PersonQualification", `Missing database table: ${table}`);
      }
      if (includesValue(table, "CertificationDefinition")) {
        appendRequirement(missing, details, "CertificationDefinition", `Missing database table: ${table}`);
      }
      if (includesValue(table, "PersonCertification")) {
        appendRequirement(missing, details, "PersonCertification", `Missing database table: ${table}`);
      }
      if (includesValue(table, "EligibilityDefinition")) {
        appendRequirement(missing, details, "EligibilityDefinition", `Missing database table: ${table}`);
      }
      if (includesValue(table, "EligibilityRequiredQualification")) {
        appendRequirement(missing, details, "EligibilityRequiredQualification", `Missing database table: ${table}`);
      }
      if (includesValue(table, "EligibilityRequiredCertification")) {
        appendRequirement(missing, details, "EligibilityRequiredCertification", `Missing database table: ${table}`);
      }
    }

    if (error.code === "P2022") {
      if (includesValue(column, "Person.lifecycleStatusChangedAt") || includesValue(column, "lifecycleStatusChangedAt")) {
        appendRequirement(
          missing,
          details,
          "Person.lifecycleStatusChangedAt",
          `Missing database column: ${column ?? "Person.lifecycleStatusChangedAt"}`,
        );
      }
      if (includesValue(column, "Person.lifecycleStatusReason") || includesValue(column, "lifecycleStatusReason")) {
        appendRequirement(
          missing,
          details,
          "Person.lifecycleStatusReason",
          `Missing database column: ${column ?? "Person.lifecycleStatusReason"}`,
        );
      }
      if (
        includesValue(column, "AthleteGuardianRelationship.guardianRole")
        || includesValue(column, "guardianRole")
      ) {
        appendRequirement(
          missing,
          details,
          "AthleteGuardianRelationship.guardianRole",
          `Missing database column: ${column ?? "AthleteGuardianRelationship.guardianRole"}`,
        );
      }
    }
  }

  const message = stringifyErrorMessage(error);
  const missingTableNames: Array<[MemberOpsPeopleSchemaRequirement, string]> = [
    ["AthleteGuardianRelationship", "AthleteGuardianRelationship"],
    ["QualificationDefinition", "QualificationDefinition"],
    ["PersonQualification", "PersonQualification"],
    ["CertificationDefinition", "CertificationDefinition"],
    ["PersonCertification", "PersonCertification"],
    ["EligibilityDefinition", "EligibilityDefinition"],
    ["EligibilityRequiredQualification", "EligibilityRequiredQualification"],
    ["EligibilityRequiredCertification", "EligibilityRequiredCertification"],
  ];

  for (const [requirement, tableName] of missingTableNames) {
    if (
      includesValue(message, tableName)
      && (includesValue(message, "does not exist") || includesValue(message, "relation"))
    ) {
      appendRequirement(missing, details, requirement, `Missing database table: ${tableName}`);
    }
  }

  if (
    includesValue(message, "GuardianRelationshipRole")
    && (includesValue(message, "does not exist") || includesValue(message, "invalid input value") || includesValue(message, "enum"))
  ) {
    appendRequirement(missing, details, "GuardianRelationshipRole", "Missing database enum: GuardianRelationshipRole");
  }

  if (missing.size === 0) {
    return null;
  }

  const migrations = new Set<string>();
  if (
    missing.has("Person.lifecycleStatusChangedAt")
    || missing.has("Person.lifecycleStatusReason")
    || missing.has("AthleteGuardianRelationship")
    || missing.has("AthleteGuardianRelationship.guardianRole")
    || missing.has("GuardianRelationshipRole")
  ) {
    migrations.add(MEMBEROPS_LIFECYCLE_HOUSEHOLD_MIGRATION_NAME);
  }
  if (
    missing.has("QualificationDefinition")
    || missing.has("PersonQualification")
    || missing.has("CertificationDefinition")
    || missing.has("PersonCertification")
    || missing.has("EligibilityDefinition")
    || missing.has("EligibilityRequiredQualification")
    || missing.has("EligibilityRequiredCertification")
  ) {
    migrations.add(MEMBEROPS_QUALIFICATIONS_MIGRATION_NAME);
  }

  return {
    missing: Array.from(missing),
    detail: details.join("; "),
    migrations: Array.from(migrations),
  };
}

export function formatMemberOpsPeopleSetupIncompleteMessage(issue: MemberOpsPeopleSchemaIssue) {
  const migrationsText =
    issue.migrations.length > 0
      ? ` Run Manual DB Setup to apply ${issue.migrations.join(", ")}.`
      : " Run Manual DB Setup to apply pending MemberOps schema changes.";

  return `MemberOps People setup is incomplete in this environment.${issue.detail ? ` ${issue.detail}.` : ""}${migrationsText}`;
}

export function formatMemberOpsOptionalFeatureUnavailableMessage(
  featureLabel: string,
  issue: MemberOpsPeopleSchemaIssue,
) {
  const detail = issue.detail ? ` ${issue.detail}.` : "";
  const migrationsText =
    issue.migrations.length > 0
      ? ` Run Manual DB Setup to apply ${issue.migrations.join(", ")}.`
      : " Run Manual DB Setup to apply pending MemberOps schema changes.";

  return `${featureLabel} are temporarily unavailable because setup is incomplete.${detail}${migrationsText}`;
}

export function logMemberOpsPeopleSchemaIssue(query: string, error: unknown, extra?: Record<string, unknown>) {
  const issue = getMemberOpsPeopleSchemaIssue(error);

  if (!issue) {
    return null;
  }

  console.warn("[member-ops.people.schema]", {
    query,
    detail: issue.detail,
    missing: issue.missing,
    migrations: issue.migrations,
    ...extra,
    error,
  });

  return issue;
}
