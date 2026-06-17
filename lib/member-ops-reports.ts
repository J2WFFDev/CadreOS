import {
  CertificationVerificationStatus,
  MemberLifecycleStatus,
  type Prisma,
  ProgramParticipationStatus,
  QualificationAssignmentStatus,
} from "@prisma/client";

import { MEMBER_LIFECYCLE_STATUS_LABELS } from "@/lib/member-ops";
import { mergeExplicitAndDerivedProgramParticipation } from "@/lib/member-ops-program-participation";
import {
  CERTIFICATION_VERIFICATION_STATUS_LABELS,
  getExpirationState,
  QUALIFICATION_ASSIGNMENT_STATUS_LABELS,
  resolveCertificationVerificationStatus,
  resolveQualificationAssignmentStatus,
} from "@/lib/member-ops-qualifications";

export type CountRow = {
  key: string;
  label: string;
  count: number;
};

export type MemberOpsReportPerson = {
  id: string;
  lifecycleStatus: MemberLifecycleStatus;
  roles: Array<{
    roleType: string;
    program: { id: string; name: string } | null;
    team: { id: string; name: string; program: { id: string; name: string } | null } | null;
  }>;
  roster: Array<{
    rosterRole: string;
    team: { id: string; name: string; program: { id: string; name: string } };
  }>;
  programParticipations: Array<{
    id: string;
    status: ProgramParticipationStatus;
    program: { id: string; name: string };
    season: { id: string; name: string } | null;
  }>;
};

export type QualificationReportRecord = {
  status: QualificationAssignmentStatus;
  expirationDate: Date | null;
};

export type CertificationReportRecord = {
  verificationStatus: CertificationVerificationStatus;
  expirationDate: Date | null;
};

export type MemberOpsReportStaffScope = {
  allowAllStaffScope: boolean;
  allowedTeamIds: readonly string[];
  allowedProgramIds: readonly string[];
};

export function buildMemberOpsReportRelationFilters(input: {
  organizationId: string;
  staffScopeResolution: MemberOpsReportStaffScope;
}): {
  rolesWhere: Prisma.RoleAssignmentWhereInput;
  rosterWhere: Prisma.RosterMembershipWhereInput;
} {
  const { organizationId, staffScopeResolution } = input;

  if (staffScopeResolution.allowAllStaffScope) {
    return {
      rolesWhere: { organizationId },
      rosterWhere: { organizationId },
    };
  }

  const roleScopeFilters: Prisma.RoleAssignmentWhereInput[] = [
    ...(staffScopeResolution.allowedTeamIds.length > 0
      ? [{ teamId: { in: [...staffScopeResolution.allowedTeamIds] } }]
      : []),
    ...(staffScopeResolution.allowedProgramIds.length > 0
      ? [{ programId: { in: [...staffScopeResolution.allowedProgramIds] } }]
      : []),
    ...(staffScopeResolution.allowedProgramIds.length > 0
      ? [{ team: { is: { programId: { in: [...staffScopeResolution.allowedProgramIds] } } } }]
      : []),
  ];
  const rosterScopeFilters: Prisma.RosterMembershipWhereInput[] = [
    ...(staffScopeResolution.allowedTeamIds.length > 0
      ? [{ teamId: { in: [...staffScopeResolution.allowedTeamIds] } }]
      : []),
    ...(staffScopeResolution.allowedProgramIds.length > 0
      ? [{ team: { is: { programId: { in: [...staffScopeResolution.allowedProgramIds] } } } }]
      : []),
  ];

  return {
    rolesWhere: {
      organizationId,
      OR: roleScopeFilters,
    },
    rosterWhere: {
      organizationId,
      OR: rosterScopeFilters,
    },
  };
}

export function formatMemberOpsReportRoleLabel(roleType: string): string {
  return roleType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildMemberOpsLifecycleReportRows(people: readonly MemberOpsReportPerson[]): CountRow[] {
  return Object.values(MemberLifecycleStatus).map((status) => ({
    key: status,
    label: MEMBER_LIFECYCLE_STATUS_LABELS[status],
    count: people.filter((person) => person.lifecycleStatus === status).length,
  }));
}

export function buildMemberOpsRoleReportRows(people: readonly MemberOpsReportPerson[]): CountRow[] {
  const counts = new Map<string, number>();

  for (const person of people) {
    const personRoleTypes = new Set([
      ...person.roles.map((role) => role.roleType),
      ...person.roster.map((membership) => membership.rosterRole),
    ]);

    for (const roleType of personRoleTypes) {
      counts.set(roleType, (counts.get(roleType) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([roleType, count]) => ({
      key: roleType,
      label: formatMemberOpsReportRoleLabel(roleType),
      count,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildMemberOpsProgramCoverageRows(people: readonly MemberOpsReportPerson[]): CountRow[] {
  const programPeople = new Map<string, { label: string; personIds: Set<string> }>();

  for (const person of people) {
    const contexts = mergeExplicitAndDerivedProgramParticipation({
      personId: person.id,
      participations: person.programParticipations,
      roles: person.roles,
      roster: person.roster,
    });

    for (const context of contexts) {
      const row = programPeople.get(context.programId) ?? { label: context.programName, personIds: new Set<string>() };
      row.personIds.add(person.id);
      programPeople.set(context.programId, row);
    }
  }

  return [...programPeople.entries()]
    .map(([programId, row]) => ({
      key: programId,
      label: row.label,
      count: row.personIds.size,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildMemberOpsTeamCoverageRows(people: readonly MemberOpsReportPerson[]): CountRow[] {
  const teamPeople = new Map<string, { label: string; personIds: Set<string> }>();

  for (const person of people) {
    for (const membership of person.roster) {
      const team = membership.team;
      const row = teamPeople.get(team.id) ?? {
        label: `${team.program.name} · ${team.name}`,
        personIds: new Set<string>(),
      };
      row.personIds.add(person.id);
      teamPeople.set(team.id, row);
    }

    for (const role of person.roles) {
      if (!role.team) {
        continue;
      }
      const label = role.team.program?.name ? `${role.team.program.name} · ${role.team.name}` : role.team.name;
      const row = teamPeople.get(role.team.id) ?? { label, personIds: new Set<string>() };
      row.personIds.add(person.id);
      teamPeople.set(role.team.id, row);
    }
  }

  return [...teamPeople.entries()]
    .map(([teamId, row]) => ({
      key: teamId,
      label: row.label,
      count: row.personIds.size,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function summarizeMemberOpsQualificationRecords(
  records: readonly QualificationReportRecord[],
  now: Date = new Date(),
): CountRow[] {
  const statuses = Object.values(QualificationAssignmentStatus);

  return statuses.map((status) => ({
    key: status,
    label: QUALIFICATION_ASSIGNMENT_STATUS_LABELS[status],
    count: records.filter(
      (record) => resolveQualificationAssignmentStatus(record.status, record.expirationDate, now) === status,
    ).length,
  }));
}

export function summarizeMemberOpsCertificationRecords(
  records: readonly CertificationReportRecord[],
  now: Date = new Date(),
): CountRow[] {
  const statuses = Object.values(CertificationVerificationStatus);

  return statuses.map((status) => ({
    key: status,
    label: CERTIFICATION_VERIFICATION_STATUS_LABELS[status],
    count: records.filter(
      (record) =>
        resolveCertificationVerificationStatus(record.verificationStatus, record.expirationDate, now) === status,
    ).length,
  }));
}

export function countExpiringSoonMemberOpsRecords(
  records: readonly { expirationDate: Date | null }[],
  now: Date = new Date(),
): number {
  return records.filter((record) => getExpirationState(record.expirationDate, now) === "expiringSoon").length;
}

export function formatMemberOpsExpiringSoonSummary(input: {
  unavailable: boolean;
  windowDays: number;
  count: number;
}): string {
  if (input.unavailable) {
    return "Expiration counts are unavailable.";
  }

  return `Expiring in the next ${input.windowDays} days: ${input.count}.`;
}
