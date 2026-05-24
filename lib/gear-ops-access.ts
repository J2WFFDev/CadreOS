import type { Prisma } from "@prisma/client";

import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
} from "@/lib/authorization";

type GearOpsReadAccess = {
  allowed: boolean;
  denialMessage?: string;
  categoryWhere: Prisma.GearCategoryWhereInput;
  visibilityWhere: Prisma.GearItemWhereInput;
  where: Prisma.GearItemWhereInput;
};

export async function resolveGearOpsReadAccess(input: {
  organizationId: string;
  actorPersonId: string | null;
  workflow: string;
}): Promise<GearOpsReadAccess> {
  const actorRoleContext = await resolveActorRoleContext({
    organizationId: input.organizationId,
    actorPersonId: input.actorPersonId,
  });

  const staffAccessDecision = evaluateStaffOnlyContentAccess(actorRoleContext);
  logAuthorizationDecision(staffAccessDecision, {
    workflow: input.workflow,
    entityType: "gearItem",
  });

  if (!staffAccessDecision.allowed) {
    return {
      allowed: false,
      denialMessage: "You do not have staff access to view GearOps catalog data.",
      categoryWhere: { id: "__denied__" },
      visibilityWhere: { id: "__denied__" },
      where: { id: "__denied__" },
    };
  }

  const staffScopeResolution = resolveStaffScopeResolution(actorRoleContext);
  if (
    !staffScopeResolution.allowAllStaffScope &&
    (staffScopeResolution.hasAmbiguousScopeAssignments || !staffScopeResolution.hasExplicitScopedAccess)
  ) {
    return {
      allowed: false,
      denialMessage: "Your role scope is incomplete for safe GearOps visibility evaluation. Contact an organization admin.",
      categoryWhere: { id: "__denied__" },
      visibilityWhere: { id: "__denied__" },
      where: { id: "__denied__" },
    };
  }

  if (staffScopeResolution.allowAllStaffScope) {
    return {
      allowed: true,
      categoryWhere: { organizationId: input.organizationId },
      visibilityWhere: {},
      where: { organizationId: input.organizationId },
    };
  }

  const visibilityRules: Prisma.GearItemWhereInput[] = [];

  if (staffScopeResolution.allowedProgramIds.length > 0) {
    visibilityRules.push({ programId: { in: staffScopeResolution.allowedProgramIds } });
    visibilityRules.push({
      assignments: {
        some: {
          assignedEvent: {
            is: {
              programId: { in: staffScopeResolution.allowedProgramIds },
            },
          },
        },
      },
    });
    visibilityRules.push({
      assignments: {
        some: {
          assignedTeam: {
            is: {
              programId: { in: staffScopeResolution.allowedProgramIds },
            },
          },
        },
      },
    });
    visibilityRules.push({
      checkouts: {
        some: {
          event: {
            is: {
              programId: { in: staffScopeResolution.allowedProgramIds },
            },
          },
        },
      },
    });
  }

  if (staffScopeResolution.allowedTeamIds.length > 0) {
    visibilityRules.push({
      assignments: {
        some: {
          assignedToTeamId: { in: staffScopeResolution.allowedTeamIds },
        },
      },
    });
    visibilityRules.push({
      assignments: {
        some: {
          assignedEvent: {
            is: {
              teamId: { in: staffScopeResolution.allowedTeamIds },
            },
          },
        },
      },
    });
    visibilityRules.push({
      checkouts: {
        some: {
          event: {
            is: {
              teamId: { in: staffScopeResolution.allowedTeamIds },
            },
          },
        },
      },
    });
  }

  if (visibilityRules.length === 0) {
    return {
      allowed: true,
      categoryWhere: {
        organizationId: input.organizationId,
        id: "__no_scope__",
      },
      visibilityWhere: { id: "__no_scope__" },
      where: {
        organizationId: input.organizationId,
        id: "__no_scope__",
      },
    };
  }

  return {
    allowed: true,
    categoryWhere: {
      organizationId: input.organizationId,
      gearItems: {
        some: {
          OR: visibilityRules,
        },
      },
    },
    visibilityWhere: { OR: visibilityRules },
    where: {
      organizationId: input.organizationId,
      OR: visibilityRules,
    },
  };
}
