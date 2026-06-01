import { strict as assert } from "node:assert";
import test from "node:test";

import {
  CertificationVerificationStatus,
  QualificationAssignmentStatus,
  StaffingRoleCategory,
} from "@prisma/client";

import {
  dateInputToNullableDate,
  DEFAULT_STAFFING_ROLE_DEFINITIONS,
  resolveStaffingQualificationCompatibility,
} from "../../lib/member-ops-staffing";

test("default staffing roles include required Arc 26D foundation roles", () => {
  const roleNames = new Set(DEFAULT_STAFFING_ROLE_DEFINITIONS.map((role) => role.name));

  [
    "Coach",
    "Assistant Coach",
    "Head Coach",
    "Volunteer",
    "Board Member",
    "Range Officer",
    "Match Staff",
    "GearOps Staff",
    "Program Admin",
    "Organization Admin",
  ].forEach((requiredRole) => {
    assert.equal(roleNames.has(requiredRole), true, `${requiredRole} should be seeded`);
  });
});

test("default staffing role categories include coaching and volunteer models", () => {
  const coachRole = DEFAULT_STAFFING_ROLE_DEFINITIONS.find((role) => role.name === "Coach");
  const volunteerRole = DEFAULT_STAFFING_ROLE_DEFINITIONS.find((role) => role.name === "Volunteer");

  assert.equal(coachRole?.category, StaffingRoleCategory.COACHING);
  assert.equal(volunteerRole?.category, StaffingRoleCategory.VOLUNTEER);
});

test("resolveStaffingQualificationCompatibility returns compatible for verified coaching certification", () => {
  const result = resolveStaffingQualificationCompatibility({
    requiredQualificationType: "CERTIFICATION",
    requiredQualificationName: "SASP Coach Certification",
    personQualifications: [],
    personCertifications: [
      {
        certification: { name: "SASP Coach Certification" },
        verificationStatus: CertificationVerificationStatus.VERIFIED,
        expirationDate: new Date("2026-09-01T00:00:00.000Z"),
      },
    ],
    now: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.equal(result.statusLabel, "Compatible");
});

test("resolveStaffingQualificationCompatibility returns missing for volunteer background check", () => {
  const result = resolveStaffingQualificationCompatibility({
    requiredQualificationType: "QUALIFICATION",
    requiredQualificationName: "Background Check",
    personQualifications: [],
    personCertifications: [],
    now: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.equal(result.statusLabel, "Missing");
});

test("resolveStaffingQualificationCompatibility resolves pending qualifications", () => {
  const result = resolveStaffingQualificationCompatibility({
    requiredQualificationType: "QUALIFICATION",
    requiredQualificationName: "Background Check",
    personQualifications: [
      {
        qualification: { name: "Background Check" },
        status: QualificationAssignmentStatus.PENDING,
        expirationDate: null,
      },
    ],
    personCertifications: [],
    now: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.equal(result.statusLabel, "Pending");
});

test("dateInputToNullableDate parses ISO date and ignores invalid", () => {
  assert.equal(dateInputToNullableDate("2026-06-01")?.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(dateInputToNullableDate("invalid"), null);
  assert.equal(dateInputToNullableDate(""), null);
});
