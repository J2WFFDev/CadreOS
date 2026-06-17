import { MemberLifecycleStatus, ProgramParticipationStatus } from "@prisma/client";

import { MEMBER_LIFECYCLE_STATUS_LABELS } from "@/lib/member-ops";

export const MEMBER_LIFECYCLE_STATUS_ORDER = [
  MemberLifecycleStatus.PROSPECT,
  MemberLifecycleStatus.APPLICANT,
  MemberLifecycleStatus.ACTIVE,
  MemberLifecycleStatus.INACTIVE,
  MemberLifecycleStatus.FORMER,
  MemberLifecycleStatus.ARCHIVED,
  MemberLifecycleStatus.ALUMNI,
] as const;

export type MemberLifecycleFilter = MemberLifecycleStatus | "all";

export function resolveMemberLifecycleFilter(filter: string | undefined): MemberLifecycleFilter {
  if (!filter || filter === "all") {
    return "all";
  }

  return Object.values(MemberLifecycleStatus).includes(filter as MemberLifecycleStatus)
    ? (filter as MemberLifecycleStatus)
    : "all";
}

export function buildMemberLifecycleStatusCounts(
  statuses: readonly MemberLifecycleStatus[],
): Record<MemberLifecycleStatus, number> {
  return MEMBER_LIFECYCLE_STATUS_ORDER.reduce(
    (counts, status) => {
      counts[status] = statuses.filter((candidate) => candidate === status).length;
      return counts;
    },
    {} as Record<MemberLifecycleStatus, number>,
  );
}

export function formatLifecycleStatusSummary(counts: Record<MemberLifecycleStatus, number>): string {
  return MEMBER_LIFECYCLE_STATUS_ORDER.map(
    (status) => `${MEMBER_LIFECYCLE_STATUS_LABELS[status]} ${counts[status] ?? 0}`,
  ).join(" · ");
}

export function formatMemberOpsProgramTeamSummary(
  memberships: Array<{
    team: { name: string; program: { name: string } };
  }>,
  roles: Array<{
    program: { name: string } | null;
    team: { name: string; program: { name: string } | null } | null;
  }>,
  participations: Array<{
    status: ProgramParticipationStatus;
    program: { name: string };
    season: { name: string } | null;
  }> = [],
) {
  const participationSummaries = participations
    .filter((participation) => participation.status === ProgramParticipationStatus.ACTIVE)
    .map((participation) =>
      participation.season?.name ? `${participation.program.name} (${participation.season.name})` : participation.program.name,
    );
  const rosterSummaries = memberships.map((membership) => `${membership.team.program.name} · ${membership.team.name}`);
  const roleSummaries = roles.map((role) => {
    if (role.team?.program?.name) {
      return `${role.team.program.name} · ${role.team.name}`;
    }
    if (role.program?.name) {
      return role.program.name;
    }
    return null;
  });
  const summaries = [...participationSummaries, ...rosterSummaries, ...roleSummaries].filter(
    (value): value is string => Boolean(value),
  );

  return summaries.length > 0 ? [...new Set(summaries)].join(", ") : "No program/team context";
}
