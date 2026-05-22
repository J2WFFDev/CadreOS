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
    return existing;
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

  const coach = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Casey",
    lastName: "Coach",
    email: "coach.demo@cadreos.local",
  });

  const athlete = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Avery",
    lastName: "Athlete",
    email: "athlete.demo@cadreos.local",
  });

  const guardian = await findOrCreatePerson({
    organizationId: organization.id,
    firstName: "Pat",
    lastName: "Guardian",
    email: "guardian.demo@cadreos.local",
  });

  await db.roleAssignment.upsert({
    where: {
      personId_roleType_scopeType_programId_teamId: {
        personId: coach.id,
        roleType: RoleType.COACH,
        scopeType: ScopeType.TEAM,
        programId: null,
        teamId: team.id,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      personId: coach.id,
      roleType: RoleType.COACH,
      scopeType: ScopeType.TEAM,
      teamId: team.id,
    },
  });

  await db.roleAssignment.upsert({
    where: {
      personId_roleType_scopeType_programId_teamId: {
        personId: athlete.id,
        roleType: RoleType.ATHLETE,
        scopeType: ScopeType.TEAM,
        programId: null,
        teamId: team.id,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      personId: athlete.id,
      roleType: RoleType.ATHLETE,
      scopeType: ScopeType.TEAM,
      teamId: team.id,
    },
  });

  await db.roleAssignment.upsert({
    where: {
      personId_roleType_scopeType_programId_teamId: {
        personId: guardian.id,
        roleType: RoleType.PARENT_GUARDIAN,
        scopeType: ScopeType.ORGANIZATION,
        programId: null,
        teamId: null,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      personId: guardian.id,
      roleType: RoleType.PARENT_GUARDIAN,
      scopeType: ScopeType.ORGANIZATION,
    },
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
