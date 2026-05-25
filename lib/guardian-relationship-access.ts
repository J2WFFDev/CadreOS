import { RoleType } from "@prisma/client";

import { db } from "@/lib/db";

const STAFF_GUARDIAN_VISIBILITY_ROLE_TYPES = new Set<RoleType>([
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
  RoleType.COACH,
  RoleType.ASSISTANT_COACH,
]);

const STAFF_GUARDIAN_EDIT_ROLE_TYPES = new Set<RoleType>([
  RoleType.ORGANIZATION_ADMIN,
  RoleType.PROGRAM_DIRECTOR,
]);

export type GuardianRelationshipAccess = {
  canViewGuardianRelationshipDetails: boolean;
  canEditGuardianLinkageWhereSupported: boolean;
  staffRoleTypes: RoleType[];
};

export async function resolveGuardianRelationshipAccess(input: {
  organizationId: string;
  actorPersonId: string | null;
}): Promise<GuardianRelationshipAccess> {
  if (!input.actorPersonId) {
    return {
      canViewGuardianRelationshipDetails: false,
      canEditGuardianLinkageWhereSupported: false,
      staffRoleTypes: [],
    };
  }

  const assignments = await db.roleAssignment.findMany({
    where: {
      organizationId: input.organizationId,
      personId: input.actorPersonId,
      roleType: {
        in: [...STAFF_GUARDIAN_VISIBILITY_ROLE_TYPES],
      },
    },
    select: {
      roleType: true,
    },
  });

  const staffRoleTypes = [...new Set(assignments.map((assignment) => assignment.roleType))];
  const canViewGuardianRelationshipDetails = staffRoleTypes.length > 0;
  const canEditGuardianLinkageWhereSupported = staffRoleTypes.some((roleType) =>
    STAFF_GUARDIAN_EDIT_ROLE_TYPES.has(roleType),
  );

  return {
    canViewGuardianRelationshipDetails,
    canEditGuardianLinkageWhereSupported,
    staffRoleTypes,
  };
}
