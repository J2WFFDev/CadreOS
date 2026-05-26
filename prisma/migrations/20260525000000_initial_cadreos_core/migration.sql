-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('ORGANIZATION_ADMIN', 'PROGRAM_DIRECTOR', 'COACH', 'ASSISTANT_COACH', 'PARENT_GUARDIAN', 'ATHLETE');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('STAFF_ONLY');

-- CreateEnum
CREATE TYPE "EntryRuntimeSourceModelType" AS ENUM ('OBSERVATION_NOTE', 'FOLLOW_UP_TASK');

-- CreateEnum
CREATE TYPE "EntryRuntimeKind" AS ENUM ('NOTE', 'TASK');

-- CreateEnum
CREATE TYPE "EntryRuntimeVisibilityClass" AS ENUM ('STAFF_ONLY', 'TEAM_STAFF', 'ORGANIZATION_SCOPED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PRACTICE', 'GAME', 'MATCH', 'MEETING', 'TRAVEL');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RSVPStatus" AS ENUM ('GOING', 'NOT_GOING', 'MAYBE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EXCUSED_ABSENT', 'UNEXCUSED_ABSENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InboxItemStatus" AS ENUM ('OPEN', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('ORGANIZATION', 'PROGRAM', 'TEAM');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('PARENT', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "FacilityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('FIELD', 'RANGE', 'BAY', 'ROOM', 'COURT', 'EQUIPMENT_AREA', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'REQUESTED', 'PRECHECK_PASSED', 'CONFLICT_FOUND', 'RECOMMENDED', 'APPROVED', 'DENIED', 'CANCELED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PrecheckStatus" AS ENUM ('NOT_RUN', 'PASSED', 'WARNING', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('RESOURCE_TIME_OVERLAP', 'FACILITY_BLACKOUT', 'EVENT_OVERLAP', 'MISSING_REQUIRED_STAFF', 'RESOURCE_UNAVAILABLE', 'CAPACITY_EXCEEDED', 'POLICY_WARNING');

-- CreateEnum
CREATE TYPE "ConflictSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "personId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "roleType" "RoleType" NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "programId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteGuardianRelationship" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athletePersonId" TEXT NOT NULL,
    "guardianPersonId" TEXT NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteGuardianRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "rosterRole" "RoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorPersonId" TEXT NOT NULL,
    "athletePersonId" TEXT,
    "teamId" TEXT,
    "eventId" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'STAFF_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryRuntimeRef" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceModelType" "EntryRuntimeSourceModelType" NOT NULL,
    "sourceModelId" TEXT NOT NULL,
    "entryKind" "EntryRuntimeKind" NOT NULL,
    "authorPersonId" TEXT NOT NULL,
    "visibilityClass" "EntryRuntimeVisibilityClass" NOT NULL,
    "athletePersonId" TEXT,
    "teamId" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryRuntimeRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "teamId" TEXT,
    "title" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "createdByPersonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSVP" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "RSVPStatus" NOT NULL,
    "reason" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "reasonCode" TEXT,
    "markedByPersonId" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "assigneePersonId" TEXT NOT NULL,
    "createdByPersonId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "sourceNoteId" TEXT,
    "sourceEventId" TEXT,
    "sourceInboxItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxRoutingItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subjectRefType" TEXT NOT NULL,
    "subjectRefId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "InboxItemStatus" NOT NULL DEFAULT 'OPEN',
    "ownerPersonId" TEXT,
    "createdByPersonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxRoutingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT,
    "teamId" TEXT,
    "actorPersonId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "status" "FacilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityResource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "description" TEXT,
    "capacity" INTEGER,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceBooking" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "programId" TEXT,
    "teamId" TEXT,
    "eventId" TEXT,
    "requestedByPersonId" TEXT NOT NULL,
    "approvedByPersonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "precheckStatus" "PrecheckStatus" NOT NULL DEFAULT 'NOT_RUN',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingConflict" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "conflictType" "ConflictType" NOT NULL,
    "severity" "ConflictSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "relatedBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BookingConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Program_organizationId_idx" ON "Program"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Program_organizationId_name_key" ON "Program"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Team_organizationId_programId_idx" ON "Team"("organizationId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_programId_name_key" ON "Team"("programId", "name");

-- CreateIndex
CREATE INDEX "Season_organizationId_programId_idx" ON "Season"("organizationId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_programId_name_key" ON "Season"("programId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_clerkUserId_key" ON "UserAccount"("clerkUserId");

-- CreateIndex
CREATE INDEX "UserAccount_organizationId_idx" ON "UserAccount"("organizationId");

-- CreateIndex
CREATE INDEX "Person_organizationId_idx" ON "Person"("organizationId");

-- CreateIndex
CREATE INDEX "Person_organizationId_lastName_firstName_idx" ON "Person"("organizationId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "RoleAssignment_organizationId_personId_idx" ON "RoleAssignment"("organizationId", "personId");

-- CreateIndex
CREATE INDEX "RoleAssignment_organizationId_roleType_scopeType_idx" ON "RoleAssignment"("organizationId", "roleType", "scopeType");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_personId_roleType_scopeType_programId_teamId_key" ON "RoleAssignment"("personId", "roleType", "scopeType", "programId", "teamId");

-- CreateIndex
CREATE INDEX "AthleteGuardianRelationship_organizationId_athletePersonId_idx" ON "AthleteGuardianRelationship"("organizationId", "athletePersonId");

-- CreateIndex
CREATE INDEX "AthleteGuardianRelationship_organizationId_guardianPersonId_idx" ON "AthleteGuardianRelationship"("organizationId", "guardianPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteGuardianRelationship_organizationId_athletePersonId__key" ON "AthleteGuardianRelationship"("organizationId", "athletePersonId", "guardianPersonId", "relationshipType");

-- CreateIndex
CREATE INDEX "RosterMembership_organizationId_teamId_seasonId_idx" ON "RosterMembership"("organizationId", "teamId", "seasonId");

-- CreateIndex
CREATE INDEX "RosterMembership_organizationId_personId_idx" ON "RosterMembership"("organizationId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterMembership_teamId_seasonId_personId_key" ON "RosterMembership"("teamId", "seasonId", "personId");

-- CreateIndex
CREATE INDEX "ObservationNote_organizationId_createdAt_idx" ON "ObservationNote"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ObservationNote_organizationId_athletePersonId_createdAt_idx" ON "ObservationNote"("organizationId", "athletePersonId", "createdAt");

-- CreateIndex
CREATE INDEX "ObservationNote_organizationId_teamId_createdAt_idx" ON "ObservationNote"("organizationId", "teamId", "createdAt");

-- CreateIndex
CREATE INDEX "EntryRuntimeRef_organizationId_entryKind_createdAt_idx" ON "EntryRuntimeRef"("organizationId", "entryKind", "createdAt");

-- CreateIndex
CREATE INDEX "EntryRuntimeRef_organizationId_authorPersonId_createdAt_idx" ON "EntryRuntimeRef"("organizationId", "authorPersonId", "createdAt");

-- CreateIndex
CREATE INDEX "EntryRuntimeRef_organizationId_athletePersonId_createdAt_idx" ON "EntryRuntimeRef"("organizationId", "athletePersonId", "createdAt");

-- CreateIndex
CREATE INDEX "EntryRuntimeRef_organizationId_teamId_createdAt_idx" ON "EntryRuntimeRef"("organizationId", "teamId", "createdAt");

-- CreateIndex
CREATE INDEX "EntryRuntimeRef_organizationId_eventId_createdAt_idx" ON "EntryRuntimeRef"("organizationId", "eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EntryRuntimeRef_organizationId_sourceModelType_sourceModelI_key" ON "EntryRuntimeRef"("organizationId", "sourceModelType", "sourceModelId");

-- CreateIndex
CREATE INDEX "Event_organizationId_startsAt_idx" ON "Event"("organizationId", "startsAt");

-- CreateIndex
CREATE INDEX "Event_organizationId_teamId_startsAt_idx" ON "Event"("organizationId", "teamId", "startsAt");

-- CreateIndex
CREATE INDEX "RSVP_organizationId_eventId_idx" ON "RSVP"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "RSVP_organizationId_personId_idx" ON "RSVP"("organizationId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "RSVP_eventId_personId_key" ON "RSVP"("eventId", "personId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_organizationId_eventId_idx" ON "AttendanceRecord"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_organizationId_personId_idx" ON "AttendanceRecord"("organizationId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_eventId_personId_key" ON "AttendanceRecord"("eventId", "personId");

-- CreateIndex
CREATE INDEX "FollowUpTask_organizationId_assigneePersonId_status_dueAt_idx" ON "FollowUpTask"("organizationId", "assigneePersonId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "InboxRoutingItem_organizationId_status_priority_idx" ON "InboxRoutingItem"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "InboxRoutingItem_organizationId_subjectRefType_subjectRefId_idx" ON "InboxRoutingItem"("organizationId", "subjectRefType", "subjectRefId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_entityType_entityId_createdAt_idx" ON "AuditEvent"("organizationId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_actorPersonId_createdAt_idx" ON "AuditEvent"("organizationId", "actorPersonId", "createdAt");

-- CreateIndex
CREATE INDEX "Facility_organizationId_idx" ON "Facility"("organizationId");

-- CreateIndex
CREATE INDEX "Facility_organizationId_status_idx" ON "Facility"("organizationId", "status");

-- CreateIndex
CREATE INDEX "FacilityResource_organizationId_idx" ON "FacilityResource"("organizationId");

-- CreateIndex
CREATE INDEX "FacilityResource_facilityId_idx" ON "FacilityResource"("facilityId");

-- CreateIndex
CREATE INDEX "FacilityResource_organizationId_facilityId_idx" ON "FacilityResource"("organizationId", "facilityId");

-- CreateIndex
CREATE INDEX "FacilityResource_organizationId_status_idx" ON "FacilityResource"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ResourceBooking_organizationId_idx" ON "ResourceBooking"("organizationId");

-- CreateIndex
CREATE INDEX "ResourceBooking_organizationId_facilityId_idx" ON "ResourceBooking"("organizationId", "facilityId");

-- CreateIndex
CREATE INDEX "ResourceBooking_organizationId_resourceId_idx" ON "ResourceBooking"("organizationId", "resourceId");

-- CreateIndex
CREATE INDEX "ResourceBooking_organizationId_status_idx" ON "ResourceBooking"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ResourceBooking_organizationId_approvalStatus_idx" ON "ResourceBooking"("organizationId", "approvalStatus");

-- CreateIndex
CREATE INDEX "ResourceBooking_organizationId_eventId_idx" ON "ResourceBooking"("organizationId", "eventId");

-- CreateIndex
CREATE INDEX "ResourceBooking_resourceId_startsAt_idx" ON "ResourceBooking"("resourceId", "startsAt");

-- CreateIndex
CREATE INDEX "ResourceBooking_resourceId_endsAt_idx" ON "ResourceBooking"("resourceId", "endsAt");

-- CreateIndex
CREATE INDEX "BookingConflict_organizationId_idx" ON "BookingConflict"("organizationId");

-- CreateIndex
CREATE INDEX "BookingConflict_bookingId_idx" ON "BookingConflict"("bookingId");

-- CreateIndex
CREATE INDEX "BookingConflict_organizationId_bookingId_idx" ON "BookingConflict"("organizationId", "bookingId");

-- CreateIndex
CREATE INDEX "BookingConflict_relatedBookingId_idx" ON "BookingConflict"("relatedBookingId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteGuardianRelationship" ADD CONSTRAINT "AthleteGuardianRelationship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteGuardianRelationship" ADD CONSTRAINT "AthleteGuardianRelationship_athletePersonId_fkey" FOREIGN KEY ("athletePersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteGuardianRelationship" ADD CONSTRAINT "AthleteGuardianRelationship_guardianPersonId_fkey" FOREIGN KEY ("guardianPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationNote" ADD CONSTRAINT "ObservationNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationNote" ADD CONSTRAINT "ObservationNote_authorPersonId_fkey" FOREIGN KEY ("authorPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationNote" ADD CONSTRAINT "ObservationNote_athletePersonId_fkey" FOREIGN KEY ("athletePersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationNote" ADD CONSTRAINT "ObservationNote_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationNote" ADD CONSTRAINT "ObservationNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRuntimeRef" ADD CONSTRAINT "EntryRuntimeRef_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRuntimeRef" ADD CONSTRAINT "EntryRuntimeRef_authorPersonId_fkey" FOREIGN KEY ("authorPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByPersonId_fkey" FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_markedByPersonId_fkey" FOREIGN KEY ("markedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_assigneePersonId_fkey" FOREIGN KEY ("assigneePersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_createdByPersonId_fkey" FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_sourceNoteId_fkey" FOREIGN KEY ("sourceNoteId") REFERENCES "ObservationNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_sourceInboxItemId_fkey" FOREIGN KEY ("sourceInboxItemId") REFERENCES "InboxRoutingItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxRoutingItem" ADD CONSTRAINT "InboxRoutingItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxRoutingItem" ADD CONSTRAINT "InboxRoutingItem_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxRoutingItem" ADD CONSTRAINT "InboxRoutingItem_createdByPersonId_fkey" FOREIGN KEY ("createdByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorPersonId_fkey" FOREIGN KEY ("actorPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityResource" ADD CONSTRAINT "FacilityResource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityResource" ADD CONSTRAINT "FacilityResource_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "FacilityResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_requestedByPersonId_fkey" FOREIGN KEY ("requestedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_approvedByPersonId_fkey" FOREIGN KEY ("approvedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingConflict" ADD CONSTRAINT "BookingConflict_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingConflict" ADD CONSTRAINT "BookingConflict_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ResourceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingConflict" ADD CONSTRAINT "BookingConflict_relatedBookingId_fkey" FOREIGN KEY ("relatedBookingId") REFERENCES "ResourceBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
