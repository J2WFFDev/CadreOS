import {
  ApprovalStatus,
  BookingStatus,
  EntryPriority,
  EntryStatus,
  EntryType,
  EntryVisibility,
  EventStatus,
  EventType,
  FacilityStatus,
  InboxItemStatus,
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

  // ── Arc 22G — Entry seed data ─────────────────────────────────────────────
  //
  // These records cover the operational Entry scenarios required for manual QA
  // and automated regression tests.  All IDs are stable so upsert is safe to
  // run multiple times.

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const inSevenDays = new Date(today);
  inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 7);

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  // Minimal inbox capture — NOTE with no due date and no context target.
  // shouldRouteEntryToInbox() returns true for this shape.
  const inboxEntry = await db.entry.upsert({
    where: { id: "cadreos-entry-inbox-note" },
    update: {
      title: "Quick note from practice",
      content: "Follow up on athlete conditioning status.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.MEDIUM,
      visibility: EntryVisibility.STAFF_ONLY,
      dueDate: null,
    },
    create: {
      id: "cadreos-entry-inbox-note",
      organizationId: organization.id,
      title: "Quick note from practice",
      content: "Follow up on athlete conditioning status.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.MEDIUM,
      visibility: EntryVisibility.STAFF_ONLY,
      createdByPersonId: teamCoach.id,
    },
  });

  // InboxRoutingItem for the inbox entry.
  await db.inboxRoutingItem.upsert({
    where: { id: "cadreos-inbox-item-note" },
    update: {
      status: InboxItemStatus.OPEN,
      priority: 20,
    },
    create: {
      id: "cadreos-inbox-item-note",
      organizationId: organization.id,
      category: "entry",
      subjectRefType: "ENTRY",
      subjectRefId: inboxEntry.id,
      status: InboxItemStatus.OPEN,
      priority: 20,
      createdByPersonId: teamCoach.id,
    },
  });

  // Staff observation note.
  await db.entry.upsert({
    where: { id: "cadreos-entry-note-observation" },
    update: {
      title: "Athlete attendance concern — recurring absences",
      content: "Three absences in the past two weeks. Spoke briefly with guardian at pickup.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.HIGH,
      visibility: EntryVisibility.STAFF_ONLY,
    },
    create: {
      id: "cadreos-entry-note-observation",
      organizationId: organization.id,
      title: "Athlete attendance concern — recurring absences",
      content: "Three absences in the past two weeks. Spoke briefly with guardian at pickup.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.HIGH,
      visibility: EntryVisibility.STAFF_ONLY,
      createdByPersonId: teamCoach.id,
    },
  });

  // Open task with no due date.
  await db.entry.upsert({
    where: { id: "cadreos-entry-task-open" },
    update: {
      title: "Review training plan for upcoming tournament",
      type: EntryType.TASK,
      status: EntryStatus.OPEN,
      priority: EntryPriority.MEDIUM,
      dueDate: null,
    },
    create: {
      id: "cadreos-entry-task-open",
      organizationId: organization.id,
      title: "Review training plan for upcoming tournament",
      type: EntryType.TASK,
      status: EntryStatus.OPEN,
      priority: EntryPriority.MEDIUM,
      visibility: EntryVisibility.STAFF_ONLY,
      createdByPersonId: teamCoach.id,
      assignedToPersonId: teamCoach.id,
    },
  });

  // Task due today — appears in Today view.
  await db.entry.upsert({
    where: { id: "cadreos-entry-task-today" },
    update: {
      title: "Submit end-of-week attendance report",
      type: EntryType.TASK,
      status: EntryStatus.OPEN,
      priority: EntryPriority.HIGH,
      dueDate: today,
    },
    create: {
      id: "cadreos-entry-task-today",
      organizationId: organization.id,
      title: "Submit end-of-week attendance report",
      type: EntryType.TASK,
      status: EntryStatus.OPEN,
      priority: EntryPriority.HIGH,
      visibility: EntryVisibility.STAFF_ONLY,
      dueDate: today,
      createdByPersonId: teamCoach.id,
      assignedToPersonId: teamCoach.id,
    },
  });

  // Task due in 7 days — appears in Upcoming view.
  await db.entry.upsert({
    where: { id: "cadreos-entry-task-upcoming" },
    update: {
      title: "Prepare pre-season athlete readiness review",
      type: EntryType.TASK,
      status: EntryStatus.OPEN,
      priority: EntryPriority.MEDIUM,
      dueDate: inSevenDays,
    },
    create: {
      id: "cadreos-entry-task-upcoming",
      organizationId: organization.id,
      title: "Prepare pre-season athlete readiness review",
      type: EntryType.TASK,
      status: EntryStatus.OPEN,
      priority: EntryPriority.MEDIUM,
      visibility: EntryVisibility.STAFF_ONLY,
      dueDate: inSevenDays,
      createdByPersonId: teamCoach.id,
      assignedToPersonId: teamCoach.id,
    },
  });

  // Overdue task — past due date, appears in Today view as overdue.
  await db.entry.upsert({
    where: { id: "cadreos-entry-task-overdue" },
    update: {
      title: "Update roster for season rollover",
      type: EntryType.TASK,
      status: EntryStatus.OPEN,
      priority: EntryPriority.URGENT,
      dueDate: yesterday,
    },
    create: {
      id: "cadreos-entry-task-overdue",
      organizationId: organization.id,
      title: "Update roster for season rollover",
      type: EntryType.TASK,
      status: EntryStatus.OPEN,
      priority: EntryPriority.URGENT,
      visibility: EntryVisibility.STAFF_ONLY,
      dueDate: yesterday,
      createdByPersonId: teamCoach.id,
      assignedToPersonId: teamCoach.id,
    },
  });

  // Follow-up assigned to teamCoach — appears in Assigned to Me view.
  await db.entry.upsert({
    where: { id: "cadreos-entry-followup-assigned" },
    update: {
      title: "Follow up: Attendance concern — recurring absences",
      content: "Confirm parent contact and document outcome.",
      type: EntryType.FOLLOW_UP,
      status: EntryStatus.OPEN,
      priority: EntryPriority.HIGH,
      dueDate: tomorrow,
      assignedToPersonId: teamCoach.id,
    },
    create: {
      id: "cadreos-entry-followup-assigned",
      organizationId: organization.id,
      title: "Follow up: Attendance concern — recurring absences",
      content: "Confirm parent contact and document outcome.",
      type: EntryType.FOLLOW_UP,
      status: EntryStatus.OPEN,
      priority: EntryPriority.HIGH,
      visibility: EntryVisibility.STAFF_ONLY,
      dueDate: tomorrow,
      createdByPersonId: teamCoach.id,
      assignedToPersonId: teamCoach.id,
    },
  });

  // Completed follow-up — excluded from active views.
  await db.entry.upsert({
    where: { id: "cadreos-entry-followup-completed" },
    update: {
      title: "Follow up: Guardian contacted re absence",
      type: EntryType.FOLLOW_UP,
      status: EntryStatus.DONE,
      taskCompleted: true,
      completedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: "cadreos-entry-followup-completed",
      organizationId: organization.id,
      title: "Follow up: Guardian contacted re absence",
      type: EntryType.FOLLOW_UP,
      status: EntryStatus.DONE,
      priority: EntryPriority.MEDIUM,
      visibility: EntryVisibility.STAFF_ONLY,
      taskCompleted: true,
      completedAt: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      createdByPersonId: teamCoach.id,
      assignedToPersonId: teamCoach.id,
    },
  });

  // Recorded decision.
  await db.entry.upsert({
    where: { id: "cadreos-entry-decision" },
    update: {
      title: "Decision: Move Monday practice to Tuesday for this week",
      content: "Facility conflict on Monday. Notified team via usual channels.",
      type: EntryType.DECISION,
      status: EntryStatus.DONE,
      priority: EntryPriority.MEDIUM,
    },
    create: {
      id: "cadreos-entry-decision",
      organizationId: organization.id,
      title: "Decision: Move Monday practice to Tuesday for this week",
      content: "Facility conflict on Monday. Notified team via usual channels.",
      type: EntryType.DECISION,
      status: EntryStatus.DONE,
      priority: EntryPriority.MEDIUM,
      visibility: EntryVisibility.STAFF_ONLY,
      createdByPersonId: generalManager.id,
    },
  });

  // Note linked to athlete via EntryObjectLink.
  const linkedAthleteEntry = await db.entry.upsert({
    where: { id: "cadreos-entry-linked-athlete" },
    update: {
      title: "Conditioning observation — athlete progress note",
      content: "Showing improvement in sprint times over the last three sessions.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.LOW,
    },
    create: {
      id: "cadreos-entry-linked-athlete",
      organizationId: organization.id,
      title: "Conditioning observation — athlete progress note",
      content: "Showing improvement in sprint times over the last three sessions.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.LOW,
      visibility: EntryVisibility.STAFF_ONLY,
      createdByPersonId: teamCoach.id,
    },
  });

  await db.entryObjectLink.upsert({
    where: { id: "cadreos-eol-linked-athlete" },
    update: {
      targetType: "PERSON",
      targetId: athlete.id,
    },
    create: {
      id: "cadreos-eol-linked-athlete",
      organizationId: organization.id,
      entryId: linkedAthleteEntry.id,
      targetType: "PERSON",
      targetId: athlete.id,
      createdByPersonId: teamCoach.id,
    },
  });

  // Note linked to team via EntryObjectLink.
  const linkedTeamEntry = await db.entry.upsert({
    where: { id: "cadreos-entry-linked-team" },
    update: {
      title: "Team cohesion observation — end of season review",
      content: "Overall morale is high. Key relationships between athletes improving.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.LOW,
    },
    create: {
      id: "cadreos-entry-linked-team",
      organizationId: organization.id,
      title: "Team cohesion observation — end of season review",
      content: "Overall morale is high. Key relationships between athletes improving.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.LOW,
      visibility: EntryVisibility.STAFF_ONLY,
      createdByPersonId: teamCoach.id,
    },
  });

  await db.entryObjectLink.upsert({
    where: { id: "cadreos-eol-linked-team" },
    update: {
      targetType: "TEAM",
      targetId: team.id,
    },
    create: {
      id: "cadreos-eol-linked-team",
      organizationId: organization.id,
      entryId: linkedTeamEntry.id,
      targetType: "TEAM",
      targetId: team.id,
      createdByPersonId: teamCoach.id,
    },
  });

  // Guardian-visible entry linked to athlete — visibility ORGANIZATION_SCOPED.
  // Used to verify guardian read policy (currently guardian-visible entries are
  // deferred; this record supports future testing when that policy is enabled).
  const guardianVisibleEntry = await db.entry.upsert({
    where: { id: "cadreos-entry-guardian-visible" },
    update: {
      title: "Athlete progress update — shared with family",
      content: "Strong session today. Technique improvements noted.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.LOW,
      visibility: EntryVisibility.ORGANIZATION_SCOPED,
    },
    create: {
      id: "cadreos-entry-guardian-visible",
      organizationId: organization.id,
      title: "Athlete progress update — shared with family",
      content: "Strong session today. Technique improvements noted.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.LOW,
      visibility: EntryVisibility.ORGANIZATION_SCOPED,
      createdByPersonId: teamCoach.id,
    },
  });

  await db.entryObjectLink.upsert({
    where: { id: "cadreos-eol-guardian-visible" },
    update: {
      targetType: "PERSON",
      targetId: athlete.id,
    },
    create: {
      id: "cadreos-eol-guardian-visible",
      organizationId: organization.id,
      entryId: guardianVisibleEntry.id,
      targetType: "PERSON",
      targetId: athlete.id,
      createdByPersonId: teamCoach.id,
    },
  });

  // Staff-only note — guardian must NOT see this entry.
  await db.entry.upsert({
    where: { id: "cadreos-entry-staff-only" },
    update: {
      title: "Confidential: Athlete welfare concern escalation",
      content: "Internal staff note. Not for guardian visibility.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.URGENT,
      visibility: EntryVisibility.STAFF_ONLY,
    },
    create: {
      id: "cadreos-entry-staff-only",
      organizationId: organization.id,
      title: "Confidential: Athlete welfare concern escalation",
      content: "Internal staff note. Not for guardian visibility.",
      type: EntryType.NOTE,
      status: EntryStatus.OPEN,
      priority: EntryPriority.URGENT,
      visibility: EntryVisibility.STAFF_ONLY,
      createdByPersonId: generalManager.id,
    },
  });

  // Archived/completed entry — excluded from all active views.
  await db.entry.upsert({
    where: { id: "cadreos-entry-archived" },
    update: {
      title: "Pre-season equipment check task",
      type: EntryType.TASK,
      status: EntryStatus.ARCHIVED,
      taskCompleted: true,
      completedAt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: "cadreos-entry-archived",
      organizationId: organization.id,
      title: "Pre-season equipment check task",
      type: EntryType.TASK,
      status: EntryStatus.ARCHIVED,
      priority: EntryPriority.LOW,
      visibility: EntryVisibility.STAFF_ONLY,
      taskCompleted: true,
      completedAt: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      createdByPersonId: teamCoach.id,
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
