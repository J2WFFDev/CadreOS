import { auth } from "@clerk/nextjs/server";
import { RoleType } from "@prisma/client";
import { cookies } from "next/headers";

import { isClerkConfigured } from "@/lib/auth";
import { buildEffectiveAppRoles } from "@/lib/auth/app-context";
import { APP_ROLES, type AppRole, type CurrentUser } from "@/lib/auth/current-user-types";
import { DEV_PERSONA_COOKIE_NAME, getDevPersonaById, isDevPersonasEnabled } from "@/lib/auth/devPersonas";
import { db } from "@/lib/db";
import { resolveGuardianDerivedScope } from "@/lib/guardian-derived-scope";

const ROLE_TYPE_TO_APP_ROLE: Record<RoleType, AppRole> = {
  [RoleType.ORGANIZATION_ADMIN]: "ADMIN",
  [RoleType.PROGRAM_DIRECTOR]: "PROGRAM_MANAGER",
  [RoleType.COACH]: "COACH",
  [RoleType.ASSISTANT_COACH]: "ASSISTANT_COACH",
  [RoleType.PARENT_GUARDIAN]: "GUARDIAN",
  [RoleType.ATHLETE]: "ATHLETE",
};

function normalizeRoles(roles: AppRole[]): AppRole[] {
  const deduped = new Set<AppRole>();

  for (const role of roles) {
    if (APP_ROLES.includes(role)) {
      deduped.add(role);
    }
  }

  return Array.from(deduped);
}

export async function getSelectedDevPersona(): Promise<CurrentUser | null> {
  if (!isDevPersonasEnabled()) {
    return null;
  }

  const cookieStore = await cookies();
  const selectedPersonaId = cookieStore.get(DEV_PERSONA_COOKIE_NAME)?.value;
  return getDevPersonaById(selectedPersonaId);
}

async function getClerkCurrentUser(): Promise<CurrentUser | null> {
  if (!isClerkConfigured()) {
    return null;
  }

  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  let userAccount:
    | {
        id: string;
        organizationId: string;
        personId: string | null;
        person: { id: string; firstName: string; lastName: string; email: string | null } | null;
      }
    | null = null;

  try {
    userAccount = await db.userAccount.findFirst({
      where: { clerkUserId: userId },
      select: {
        id: true,
        organizationId: true,
        personId: true,
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  } catch {
    return null;
  }

  if (!userAccount) {
    return {
      id: userId,
      name: "Clerk User",
      roles: [],
    };
  }

  let roleAssignments: { roleType: RoleType; teamId: string | null }[] = [];

  if (userAccount.personId && userAccount.organizationId) {
    try {
      roleAssignments = await db.roleAssignment.findMany({
        where: {
          organizationId: userAccount.organizationId,
          personId: userAccount.personId,
        },
        select: {
          roleType: true,
          teamId: true,
        },
      });
    } catch {
      roleAssignments = [];
    }
  }

  const directRoles = normalizeRoles(roleAssignments.map((assignment) => ROLE_TYPE_TO_APP_ROLE[assignment.roleType]));
  let guardianScope = {
    dependentAthleteIds: [] as string[],
    derivedProgramIds: [] as string[],
    derivedTeamIds: [] as string[],
  };

  if (userAccount.personId && userAccount.organizationId) {
    try {
      guardianScope = await resolveGuardianDerivedScope({
        organizationId: userAccount.organizationId,
        guardianPersonId: userAccount.personId,
      });
    } catch {
      guardianScope = {
        dependentAthleteIds: [],
        derivedProgramIds: [],
        derivedTeamIds: [],
      };
    }
  }
  const effectiveRoles = buildEffectiveAppRoles({
    directRoles,
    hasGuardianDependentScope: guardianScope.dependentAthleteIds.length > 0,
  });

  const name = `${userAccount.person?.firstName ?? ""} ${userAccount.person?.lastName ?? ""}`.trim() || "Clerk User";

  return {
    id: userAccount.personId ?? userId,
    name,
    email: userAccount.person?.email ?? undefined,
    roles: effectiveRoles,
    activeRole: directRoles[0] ?? effectiveRoles[0],
    organizationId: userAccount.organizationId,
    teamIds: roleAssignments.flatMap((assignment) => (assignment.teamId ? [assignment.teamId] : [])),
    athleteIds: directRoles.includes("ATHLETE") && userAccount.personId ? [userAccount.personId] : [],
    guardianAthleteIds: guardianScope.dependentAthleteIds,
    dependentAthleteIds: guardianScope.dependentAthleteIds,
    derivedProgramIds: guardianScope.derivedProgramIds,
    derivedTeamIds: guardianScope.derivedTeamIds,
    isDevPersona: false,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const selectedDevPersona = await getSelectedDevPersona();

  if (selectedDevPersona) {
    return selectedDevPersona;
  }

  return getClerkCurrentUser();
}

export function getCurrentRole(user: CurrentUser | null): AppRole | undefined {
  return user?.activeRole ?? user?.roles[0];
}
