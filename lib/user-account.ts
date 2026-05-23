import { RoleType, ScopeType } from "@prisma/client";

import { db } from "@/lib/db";

export async function upsertUserAccountForOrganization(input: {
  organizationId: string;
  clerkUserId: string;
}) {
  return db.userAccount.upsert({
    where: { clerkUserId: input.clerkUserId },
    update: {
      organizationId: input.organizationId,
    },
    create: {
      organizationId: input.organizationId,
      clerkUserId: input.clerkUserId,
    },
    select: {
      id: true,
      organizationId: true,
      personId: true,
    },
  });
}

export async function resolveActorPersonId(input: {
  organizationId: string;
  clerkUserId: string | null;
  preferredPersonId?: string | null;
}): Promise<string | null> {
  if (input.preferredPersonId) {
    return input.preferredPersonId;
  }

  if (input.clerkUserId) {
    const linkedUserAccount = await db.userAccount.findFirst({
      where: {
        organizationId: input.organizationId,
        clerkUserId: input.clerkUserId,
        personId: { not: null },
      },
      select: { personId: true },
    });

    if (linkedUserAccount?.personId) {
      return linkedUserAccount.personId;
    }
  }

  const organizationAdminAssignment = await db.roleAssignment.findFirst({
    where: {
      organizationId: input.organizationId,
      roleType: RoleType.ORGANIZATION_ADMIN,
      scopeType: ScopeType.ORGANIZATION,
    },
    select: { personId: true },
    orderBy: [{ createdAt: "asc" }],
  });

  if (organizationAdminAssignment?.personId) {
    return organizationAdminAssignment.personId;
  }

  const firstPerson = await db.person.findFirst({
    where: { organizationId: input.organizationId },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
  });

  return firstPerson?.id ?? null;
}
