import { strict as assert } from "node:assert";
import test from "node:test";
import {
  CertificationVerificationStatus,
  MemberLifecycleStatus,
  QualificationAssignmentStatus,
  RoleType,
} from "@prisma/client";

import {
  buildMemberOpsLifecycleReportRows,
  buildMemberOpsProgramCoverageRows,
  buildMemberOpsRoleReportRows,
  buildMemberOpsTeamCoverageRows,
  countExpiringSoonMemberOpsRecords,
  summarizeMemberOpsCertificationRecords,
  summarizeMemberOpsQualificationRecords,
  type MemberOpsReportPerson,
} from "../../lib/member-ops-reports";

function reportPerson(overrides: Partial<MemberOpsReportPerson> = {}): MemberOpsReportPerson {
  return {
    id: overrides.id ?? "person-1",
    lifecycleStatus: overrides.lifecycleStatus ?? MemberLifecycleStatus.ACTIVE,
    roles: overrides.roles ?? [],
    roster: overrides.roster ?? [],
  };
}

test("ARC-MEMBER-05: report lifecycle rows use existing lifecycle labels", () => {
  const rows = buildMemberOpsLifecycleReportRows([
    reportPerson({ lifecycleStatus: MemberLifecycleStatus.ACTIVE }),
    reportPerson({ id: "person-2", lifecycleStatus: MemberLifecycleStatus.PROSPECT }),
  ]);

  assert.equal(rows.find((row) => row.key === MemberLifecycleStatus.ACTIVE)?.label, "Active Member");
  assert.equal(rows.find((row) => row.key === MemberLifecycleStatus.ACTIVE)?.count, 1);
  assert.equal(rows.find((row) => row.key === MemberLifecycleStatus.PROSPECT)?.count, 1);
  assert.equal(rows.find((row) => row.key === MemberLifecycleStatus.ARCHIVED)?.count, 0);
});

test("ARC-MEMBER-05: role report counts each person once per role type", () => {
  const rows = buildMemberOpsRoleReportRows([
    reportPerson({
      roles: [{ roleType: RoleType.COACH, program: null, team: null }],
      roster: [
        {
          rosterRole: RoleType.COACH,
          team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
        },
      ],
    }),
    reportPerson({
      id: "person-2",
      roster: [
        {
          rosterRole: RoleType.ATHLETE,
          team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
        },
      ],
    }),
  ]);

  assert.equal(rows.find((row) => row.key === RoleType.COACH)?.count, 1);
  assert.equal(rows.find((row) => row.key === RoleType.ATHLETE)?.count, 1);
});

test("ARC-MEMBER-05: program and team coverage count distinct visible people", () => {
  const people = [
    reportPerson({
      id: "person-1",
      roster: [
        {
          rosterRole: RoleType.ATHLETE,
          team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
        },
      ],
    }),
    reportPerson({
      id: "person-2",
      roles: [
        {
          roleType: RoleType.COACH,
          program: null,
          team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
        },
      ],
    }),
  ];

  assert.deepEqual(buildMemberOpsProgramCoverageRows(people), [
    { key: "program-1", label: "SASP", count: 2 },
  ]);
  assert.deepEqual(buildMemberOpsTeamCoverageRows(people), [
    { key: "team-1", label: "SASP · Precision", count: 2 },
  ]);
});

test("ARC-MEMBER-05: qualification and certification report summaries resolve expiration state", () => {
  const now = new Date("2026-06-16T12:00:00Z");
  const qualificationRows = summarizeMemberOpsQualificationRecords(
    [
      { status: QualificationAssignmentStatus.ACTIVE, expirationDate: new Date("2026-06-15T12:00:00Z") },
      { status: QualificationAssignmentStatus.PENDING, expirationDate: null },
    ],
    now,
  );
  const certificationRows = summarizeMemberOpsCertificationRecords(
    [
      { verificationStatus: CertificationVerificationStatus.VERIFIED, expirationDate: new Date("2026-06-20T12:00:00Z") },
      { verificationStatus: CertificationVerificationStatus.REJECTED, expirationDate: null },
    ],
    now,
  );

  assert.equal(qualificationRows.find((row) => row.key === QualificationAssignmentStatus.EXPIRED)?.count, 1);
  assert.equal(qualificationRows.find((row) => row.key === QualificationAssignmentStatus.PENDING)?.count, 1);
  assert.equal(certificationRows.find((row) => row.key === CertificationVerificationStatus.VERIFIED)?.count, 1);
  assert.equal(certificationRows.find((row) => row.key === CertificationVerificationStatus.REJECTED)?.count, 1);
  assert.equal(
    countExpiringSoonMemberOpsRecords([{ expirationDate: new Date("2026-06-20T12:00:00Z") }], now),
    1,
  );
});
