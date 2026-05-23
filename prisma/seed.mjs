import {
  ApprovalStatus,
  BookingStatus,
  EventStatus,
  EventType,
  FacilityStatus,
  PrecheckStatus,
  PrismaClient,
  RelationshipType,
  ResourceStatus,
  ResourceType,
  RoleType,
  ScopeType,
} from "@prisma/client";

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

  // FieldOps demo data (Phase 6C)
  const demoFacility = await db.facility.upsert({
    where: { id: "cadreos-demo-facility" },
    update: { name: "Demo Range Complex" },
    create: {
      id: "cadreos-demo-facility",
      organizationId: organization.id,
      name: "Demo Range Complex",
      description: "Primary range facility for the demo organization",
      city: "Demo City",
      state: "TX",
      status: FacilityStatus.ACTIVE,
    },
  });

  await db.facilityResource.upsert({
    where: { id: "cadreos-demo-resource-bay-a" },
    update: { name: "Bay A" },
    create: {
      id: "cadreos-demo-resource-bay-a",
      organizationId: organization.id,
      facilityId: demoFacility.id,
      name: "Bay A",
      resourceType: ResourceType.BAY,
      description: "Standard range bay — 25 yards",
      capacity: 4,
      status: ResourceStatus.ACTIVE,
    },
  });

  await db.facilityResource.upsert({
    where: { id: "cadreos-demo-resource-bay-b" },
    update: { name: "Bay B" },
    create: {
      id: "cadreos-demo-resource-bay-b",
      organizationId: organization.id,
      facilityId: demoFacility.id,
      name: "Bay B",
      resourceType: ResourceType.BAY,
      description: "Standard range bay — 50 yards",
      capacity: 4,
      status: ResourceStatus.ACTIVE,
    },
  });

  const demoEvent = await db.event.upsert({
    where: { id: "cadreos-demo-event-range-block" },
    update: {
      title: "Demo Team Range Block",
      startsAt: new Date("2026-06-15T14:00:00.000Z"),
      endsAt: new Date("2026-06-15T16:00:00.000Z"),
      location: demoFacility.name,
    },
    create: {
      id: "cadreos-demo-event-range-block",
      organizationId: organization.id,
      programId: program.id,
      teamId: team.id,
      title: "Demo Team Range Block",
      eventType: EventType.PRACTICE,
      status: EventStatus.PUBLISHED,
      startsAt: new Date("2026-06-15T14:00:00.000Z"),
      endsAt: new Date("2026-06-15T16:00:00.000Z"),
      location: demoFacility.name,
      createdByPersonId: teamCoach.id,
    },
  });

  await db.resourceBooking.upsert({
    where: { id: "cadreos-demo-booking-bay-a-range-block" },
    update: {
      facilityId: demoFacility.id,
      resourceId: "cadreos-demo-resource-bay-a",
      programId: program.id,
      teamId: team.id,
      eventId: demoEvent.id,
      requestedByPersonId: programManager.id,
      approvedByPersonId: generalManager.id,
      title: "Demo Team Range Block",
      description: "Reserved Bay A for the seeded demo practice block.",
      startsAt: new Date("2026-06-15T14:00:00.000Z"),
      endsAt: new Date("2026-06-15T16:00:00.000Z"),
      status: BookingStatus.APPROVED,
      precheckStatus: PrecheckStatus.PASSED,
      approvalStatus: ApprovalStatus.APPROVED,
    },
    create: {
      id: "cadreos-demo-booking-bay-a-range-block",
      organizationId: organization.id,
      facilityId: demoFacility.id,
      resourceId: "cadreos-demo-resource-bay-a",
      programId: program.id,
      teamId: team.id,
      eventId: demoEvent.id,
      requestedByPersonId: programManager.id,
      approvedByPersonId: generalManager.id,
      title: "Demo Team Range Block",
      description: "Reserved Bay A for the seeded demo practice block.",
      startsAt: new Date("2026-06-15T14:00:00.000Z"),
      endsAt: new Date("2026-06-15T16:00:00.000Z"),
      status: BookingStatus.APPROVED,
      precheckStatus: PrecheckStatus.PASSED,
      approvalStatus: ApprovalStatus.APPROVED,
    },
  });

  await db.resourceBooking.upsert({
    where: { id: "cadreos-demo-booking-bay-b-open-session" },
    update: {
      facilityId: demoFacility.id,
      resourceId: "cadreos-demo-resource-bay-b",
      programId: program.id,
      teamId: team.id,
      requestedByPersonId: teamCoach.id,
      approvedByPersonId: null,
      title: "Open Skills Bay Session",
      description: "Read-only seeded booking without event linkage for FieldOps list validation.",
      startsAt: new Date("2026-06-17T18:00:00.000Z"),
      endsAt: new Date("2026-06-17T19:30:00.000Z"),
      status: BookingStatus.REQUESTED,
      precheckStatus: PrecheckStatus.WARNING,
      approvalStatus: ApprovalStatus.PENDING,
    },
    create: {
      id: "cadreos-demo-booking-bay-b-open-session",
      organizationId: organization.id,
      facilityId: demoFacility.id,
      resourceId: "cadreos-demo-resource-bay-b",
      programId: program.id,
      teamId: team.id,
      requestedByPersonId: teamCoach.id,
      approvedByPersonId: null,
      title: "Open Skills Bay Session",
      description: "Read-only seeded booking without event linkage for FieldOps list validation.",
      startsAt: new Date("2026-06-17T18:00:00.000Z"),
      endsAt: new Date("2026-06-17T19:30:00.000Z"),
      status: BookingStatus.REQUESTED,
      precheckStatus: PrecheckStatus.WARNING,
      approvalStatus: ApprovalStatus.PENDING,
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
