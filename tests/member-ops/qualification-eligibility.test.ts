import { strict as assert } from "node:assert";
import test from "node:test";

import {
  CertificationVerificationStatus,
  EligibilityTargetType,
  QualificationAssignmentStatus,
} from "@prisma/client";

import {
  buildEligibilityTargetLabel,
  getExpirationState,
  resolveCertificationVerificationStatus,
  resolveQualificationAssignmentStatus,
  summarizeEligibility,
} from "../../lib/member-ops-qualifications";

test("resolveQualificationAssignmentStatus derives expired from expiration date", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  assert.equal(
    resolveQualificationAssignmentStatus(
      QualificationAssignmentStatus.ACTIVE,
      new Date("2026-05-31T00:00:00.000Z"),
      now,
    ),
    QualificationAssignmentStatus.EXPIRED,
  );
});

test("resolveCertificationVerificationStatus preserves rejected and derives expired", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  assert.equal(
    resolveCertificationVerificationStatus(
      CertificationVerificationStatus.REJECTED,
      new Date("2026-07-01T00:00:00.000Z"),
      now,
    ),
    CertificationVerificationStatus.REJECTED,
  );
  assert.equal(
    resolveCertificationVerificationStatus(
      CertificationVerificationStatus.VERIFIED,
      new Date("2026-05-31T00:00:00.000Z"),
      now,
    ),
    CertificationVerificationStatus.EXPIRED,
  );
});

test("getExpirationState identifies expiring soon window", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  assert.equal(getExpirationState(new Date("2026-06-20T00:00:00.000Z"), now), "expiringSoon");
  assert.equal(getExpirationState(new Date("2026-08-01T00:00:00.000Z"), now), "current");
  assert.equal(getExpirationState(null, now), "none");
});

test("summarizeEligibility returns eligible and missing states", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");
  const definitions = [
    {
      id: "rule-1",
      name: "Rifle Team",
      targetType: EligibilityTargetType.TEAM,
      targetLabel: null,
      team: { name: "Rifle Team" },
      program: null,
      requiredQualifications: [{ qualification: { id: "qual-1", name: "Rifle Qualification" } }],
      requiredCertifications: [{ certification: { id: "cert-1", name: "Safety Orientation" } }],
    },
    {
      id: "rule-2",
      name: "Volunteer Event Role",
      targetType: EligibilityTargetType.RESPONSIBILITY,
      targetLabel: "Event Role",
      team: null,
      program: null,
      requiredQualifications: [{ qualification: { id: "qual-2", name: "Volunteer Training" } }],
      requiredCertifications: [],
    },
  ];

  const summary = summarizeEligibility(
    definitions,
    [
      {
        qualification: { id: "qual-1", name: "Rifle Qualification" },
        status: QualificationAssignmentStatus.ACTIVE,
        expirationDate: new Date("2026-07-01T00:00:00.000Z"),
      },
    ],
    [
      {
        certification: { id: "cert-1", name: "Safety Orientation" },
        verificationStatus: CertificationVerificationStatus.VERIFIED,
        expirationDate: new Date("2026-07-01T00:00:00.000Z"),
      },
    ],
    now,
  );

  assert.equal(summary[0]?.status, "eligible");
  assert.equal(summary[0]?.targetLabel, "Rifle Team");
  assert.equal(summary[1]?.status, "missing");
  assert.deepEqual(summary[1]?.missingRequirements, ["Volunteer Training"]);
});

test("buildEligibilityTargetLabel prefers scoped team/program names over generic labels", () => {
  assert.equal(
    buildEligibilityTargetLabel({
      targetType: EligibilityTargetType.TEAM,
      targetLabel: "Fallback",
      team: { name: "Precision Rifle" },
      program: null,
    }),
    "Precision Rifle",
  );
  assert.equal(
    buildEligibilityTargetLabel({
      targetType: EligibilityTargetType.EQUIPMENT,
      targetLabel: "Rifle Bay",
      team: null,
      program: null,
    }),
    "Rifle Bay",
  );
});
