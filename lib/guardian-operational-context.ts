type GuardianRelationshipLike = {
  guardian: {
    _count: { userAccounts: number };
    roles: Array<{ id: string }>;
  };
};

export type GuardianOperationalContext = {
  linkedGuardianCount: number;
  missingGuardianAccountLinkCount: number;
  inactiveGuardianAccountSignalCount: number;
  hasGuardianRelationship: boolean;
  hasNoGuardianOnFile: boolean;
  hasInactiveGuardianAccountSignal: boolean;
  hasIncompleteRelationshipSupport: boolean;
};

export function deriveGuardianOperationalContext(
  relationships: GuardianRelationshipLike[],
): GuardianOperationalContext {
  const linkedGuardianCount = relationships.length;
  const missingGuardianAccountLinkCount = relationships.filter(
    (relationship) => relationship.guardian._count.userAccounts === 0,
  ).length;
  const inactiveGuardianAccountSignalCount = relationships.filter(
    (relationship) =>
      relationship.guardian._count.userAccounts > 0 && relationship.guardian.roles.length === 0,
  ).length;

  return {
    linkedGuardianCount,
    missingGuardianAccountLinkCount,
    inactiveGuardianAccountSignalCount,
    hasGuardianRelationship: linkedGuardianCount > 0,
    hasNoGuardianOnFile: linkedGuardianCount === 0,
    hasInactiveGuardianAccountSignal: inactiveGuardianAccountSignalCount > 0,
    hasIncompleteRelationshipSupport:
      missingGuardianAccountLinkCount > 0 || inactiveGuardianAccountSignalCount > 0,
  };
}

export function formatGuardianOperationalIndicator(context: GuardianOperationalContext): string {
  if (context.hasNoGuardianOnFile) {
    return "No guardian on file";
  }

  if (context.hasInactiveGuardianAccountSignal) {
    return "Inactive guardian account signal";
  }

  if (context.hasIncompleteRelationshipSupport) {
    return "Guardian relationship incomplete";
  }

  return "Related athlete";
}

export function formatGuardianFollowUpDependency(context: GuardianOperationalContext): string {
  if (context.hasNoGuardianOnFile) {
    return "Guardian follow-up dependency blocked (no guardian on file)";
  }

  if (context.hasIncompleteRelationshipSupport) {
    return "Guardian follow-up may require account-linkage support";
  }

  return "Follow-up may require guardian involvement";
}
