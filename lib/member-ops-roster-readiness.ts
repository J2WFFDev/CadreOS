import { MemberLifecycleStatus } from "@prisma/client";

import { isDefaultVisibleMemberLifecycleStatus } from "@/lib/member-ops";

type MemberRosterReadinessInput = {
  lifecycleStatus: MemberLifecycleStatus;
  roleTypes: string[];
  rosterRoles: string[];
  membershipCount: number;
  athleteGuardianLinkCount: number;
  hasProgramAssignment: boolean;
  hasSeasonAssignment: boolean;
  hasProfileEmail: boolean;
};

export type MemberRosterReadinessState = {
  isAthlete: boolean;
  onboardingIncomplete: boolean;
  offboardingActionRecommended: boolean;
  rolloverReady: boolean;
  rolloverNeedsReview: boolean;
  missingGuardian: boolean;
  missingTeamAssignment: boolean;
  missingProgramAssignment: boolean;
  missingSeasonAssignment: boolean;
  incompleteProfile: boolean;
  inactiveOrArchived: boolean;
  needsAttention: boolean;
  ready: boolean;
  labels: string[];
};

export function deriveMemberRosterReadiness(
  input: MemberRosterReadinessInput,
): MemberRosterReadinessState {
  const isAthlete = input.roleTypes.includes("ATHLETE") || input.rosterRoles.includes("ATHLETE");
  const missingGuardian = isAthlete && input.athleteGuardianLinkCount === 0;
  const missingTeamAssignment = input.membershipCount === 0;
  const missingProgramAssignment = !input.hasProgramAssignment;
  const missingSeasonAssignment = !input.hasSeasonAssignment;
  const incompleteProfile = !input.hasProfileEmail || input.roleTypes.length === 0;
  const inactiveOrArchived = !isDefaultVisibleMemberLifecycleStatus(input.lifecycleStatus);
  const shouldEvaluateOperationalGaps = isDefaultVisibleMemberLifecycleStatus(input.lifecycleStatus);
  const onboardingIncomplete =
    shouldEvaluateOperationalGaps &&
    (missingGuardian ||
      missingTeamAssignment ||
      missingProgramAssignment ||
      missingSeasonAssignment ||
      incompleteProfile);
  const offboardingActionRecommended = !shouldEvaluateOperationalGaps && input.membershipCount > 0;
  const rolloverReady = shouldEvaluateOperationalGaps && input.hasSeasonAssignment && !onboardingIncomplete;
  const rolloverNeedsReview = shouldEvaluateOperationalGaps && !rolloverReady;

  const needsAttention =
    onboardingIncomplete ||
    offboardingActionRecommended ||
    inactiveOrArchived;
  const labels: string[] = [];

  if (onboardingIncomplete) {
    labels.push("Onboarding incomplete");
  }
  if (offboardingActionRecommended) {
    labels.push("Offboarding review needed");
  }
  if (rolloverNeedsReview) {
    labels.push("Rollover readiness review");
  }
  if (missingGuardian) {
    labels.push("Missing guardian");
  }
  if (missingTeamAssignment) {
    labels.push("Missing team assignment");
  }
  if (missingProgramAssignment) {
    labels.push("Missing program assignment");
  }
  if (missingSeasonAssignment) {
    labels.push("Missing season assignment");
  }
  if (incompleteProfile) {
    labels.push("Incomplete profile");
  }
  if (inactiveOrArchived) {
    labels.push("Inactive/archived lifecycle");
  }

  return {
    isAthlete,
    onboardingIncomplete,
    offboardingActionRecommended,
    rolloverReady,
    rolloverNeedsReview,
    missingGuardian,
    missingTeamAssignment,
    missingProgramAssignment,
    missingSeasonAssignment,
    incompleteProfile,
    inactiveOrArchived,
    needsAttention,
    ready: !needsAttention,
    labels,
  };
}
