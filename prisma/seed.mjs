import { PrismaClient, RelationshipType, RoleType, ScopeType } from "@prisma/client";

const db = new PrismaClient();

async function findOrCreatePerson({ organizationId, firstName, lastName, email }) {
  const existing = await db.person.findFirst({
    where: {
      organizationId,
      email,
    },
  });

  if (existing) {
    return db.person.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        email,
      },
    });
  }

  return db.person.create({
    data: {
      organizationId,
      firstName,
      lastName,
      email,
    },
  });
}

async function findOrCreateRoleAssignment({
  organizationId,
  personId,
  roleType,
  scopeType,
  programId = null,
  teamId = null,
}) {
  const existing = await db.roleAssignment.findFirst({
    where: {
      organizationId,
      personId,
      roleType,
      scopeType,
      programId,
      teamId,
    },
  });

  if (existing) {
    return existing;
  }

  return db.roleAssignment.create({
    data: {
      organizationId,
      personId,
      roleType,
      scopeType,
      programId,
      teamId,
    },
  });
}

async function main() {
  const organization = await db.organization.upsert({
    where: {
      id: "cadreos-demo-organization",
    },
    update: {
      name: "CadreOS Demo Organization",
    },
    create: {
      id: "cadreos-demo-organization",
      name: "CadreOS Demo Organization",
    },
  });

  const program = await db.program.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Demo Sports Program",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: "Demo Sports Program",
    },
  });

  const season = await db.season.upsert({
    where: {
      programId_name: {
        programId: program.id,
        name: "2026 Season",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      programId: program.id,
      name: "2026 Season",
    },
  });

  const team = await db.team.upsert({
    where: {
      programId_name: {
        programId: program.id,
        name: "Demo Team",
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      programId: program.id,
      name: "Demo Team",
    },
  });

  const generalManager = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Sonny",
    lastName: "Weaver",
    email: "sonny.weaver.demo@cadreos.local",
  });

  const programManager = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Richard",
    lastName: "East",
    email: "richard.east.demo@cadreos.local",
  });

  const headCoach = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Ed",
    lastName: "Davis",
    email: "ed.davis.demo@cadreos.local",
  });

  const teamCoach = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Casey",
    lastName: "Coach",
    email: "casey.coach.demo@cadreos.local",
  });

  const athlete = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Avery",
    lastName: "Athlete",
    email: "athlete.demo@cadreos.local",
  });

  const guardian = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Morgan",
    lastName: "Guardian",
    email: "morgan.guardian.demo@cadreos.local",
  });

  const volunteer = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Vicky",
    lastName: "Vol",
    email: "vicky.vol.demo@cadreos.local",
  });

  await findOrCreateRoleAssignment({
    organizationId: organization.id,
    personId: generalManager.id,
    roleType: RoleType.ORGANIZATION_ADMIN,
    scopeType: ScopeType.ORGANIZATION,
  });

  await findOrCreateRoleAssignment({
    organizationId: organization.id,
    personId: programManager.id,
    roleType: RoleType.PROGRAM_DIRECTOR,
    scopeType: ScopeType.PROGRAM,
    programId: program.id,
  });

  await findOrCreateRoleAssignment({
    organizationId: organization.id,
    personId: headCoach.id,
    roleType: RoleType.COACH,
    scopeType: ScopeType.PROGRAM,
    programId: program.id,
  });

  await findOrCreateRoleAssignment({
    organizationId: organization.id,
    personId: teamCoach.id,
    roleType: RoleType.COACH,
    scopeType: ScopeType.TEAM,
    teamId: team.id,
  });

  await findOrCreateRoleAssignment({
    organizationId: organization.id,
    personId: athlete.id,
    roleType: RoleType.ATHLETE,
    scopeType: ScopeType.TEAM,
    teamId: team.id,
  });

  await findOrCreateRoleAssignment({
    organizationId: organization.id,
    personId: volunteer.id,
    roleType: RoleType.ASSISTANT_COACH,
    scopeType: ScopeType.TEAM,
    teamId: team.id,
  });

  await findOrCreateRoleAssignment({
    organizationId: organization.id,
    personId: guardian.id,
    roleType: RoleType.PARENT_GUARDIAN,
    scopeType: ScopeType.ORGANIZATION,
  });

  await db.athleteGuardianRelationship.upsert({
    where: {
      organizationId_athletePersonId_guardianPersonId_relationshipType: {
        organizationId: organization.id,
        athletePersonId: athlete.id,
        guardianPersonId: guardian.id,
        relationshipType: RelationshipType.GUARDIAN,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      athletePersonId: athlete.id,
      guardianPersonId: guardian.id,
      relationshipType: RelationshipType.GUARDIAN,
    },
  });

  await db.rosterMembership.upsert({
    where: {
      teamId_seasonId_personId: {
        teamId: team.id,
        seasonId: season.id,
        personId: athlete.id,
      },
    },
    update: {
      rosterRole: RoleType.ATHLETE,
    },
    create: {
      organizationId: organization.id,
      teamId: team.id,
      seasonId: season.id,
      personId: athlete.id,
      rosterRole: RoleType.ATHLETE,
    },
  });
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
