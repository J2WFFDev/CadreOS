import { MemberLifecycleStatus } from "@prisma/client";

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
