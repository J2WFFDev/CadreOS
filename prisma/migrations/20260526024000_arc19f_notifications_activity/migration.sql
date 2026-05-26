-- Arc 19F — Notifications & Activity Integration

CREATE TYPE "AwarenessEventType" AS ENUM (
  'ENTRY_ASSIGNED',
  'ASSIGNMENT_UPDATED',
  'FOLLOW_UP_CREATED',
  'READINESS_ISSUE_DETECTED',
  'WORKFLOW_STEP_ATTENTION',
  'WORKFLOW_RUN_UPDATED',
  'OPERATIONAL_STATUS_CHANGED',
  'LINKED_OPERATIONAL_UPDATE',
  'ATTENDANCE_REQUIRES_REVIEW'
);

CREATE TYPE "NotificationCategory" AS ENUM (
  'ASSIGNMENT',
  'FOLLOW_UP',
  'READINESS',
  'WORKFLOW',
  'STATUS',
  'LINKED_ISSUE',
  'ATTENDANCE'
);

CREATE TYPE "NotificationDeliveryTiming" AS ENUM (
  'IMMEDIATE',
  'DIGEST_ONLY',
  'OFF'
);

CREATE TYPE "NotificationDigestStatus" AS ENUM (
  'PENDING',
  'BUILT',
  'DISMISSED'
);

CREATE TABLE "AwarenessEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventType" "AwarenessEventType" NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "priority" "EntryPriority" NOT NULL DEFAULT 'MEDIUM',
  "aggregateKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "entryId" TEXT,
  "workflowRunId" TEXT,
  "eventId" TEXT,
  "teamId" TEXT,
  "actorPersonId" TEXT,
  "metadataJson" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AwarenessEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "aggregateKey" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "priority" "EntryPriority" NOT NULL DEFAULT 'MEDIUM',
  "latestAwarenessEventId" TEXT NOT NULL,
  "entryId" TEXT,
  "workflowRunId" TEXT,
  "teamId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "eventCount" INTEGER NOT NULL DEFAULT 1,
  "firstEventAt" TIMESTAMP(3) NOT NULL,
  "lastEventAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationReadState" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationReadState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "minimumPriority" "EntryPriority" NOT NULL DEFAULT 'LOW',
  "deliveryTiming" "NotificationDeliveryTiming" NOT NULL DEFAULT 'IMMEDIATE',
  "digestWindowHours" INTEGER NOT NULL DEFAULT 24,
  "assignmentEnabled" BOOLEAN NOT NULL DEFAULT true,
  "followUpEnabled" BOOLEAN NOT NULL DEFAULT true,
  "readinessEnabled" BOOLEAN NOT NULL DEFAULT true,
  "workflowEnabled" BOOLEAN NOT NULL DEFAULT true,
  "statusEnabled" BOOLEAN NOT NULL DEFAULT true,
  "linkedIssueEnabled" BOOLEAN NOT NULL DEFAULT true,
  "attendanceEnabled" BOOLEAN NOT NULL DEFAULT true,
  "dueEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDigest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "status" "NotificationDigestStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryTiming" "NotificationDeliveryTiming" NOT NULL DEFAULT 'DIGEST_ONLY',
  "windowStartsAt" TIMESTAMP(3) NOT NULL,
  "windowEndsAt" TIMESTAMP(3) NOT NULL,
  "notificationIdsJson" TEXT,
  "builtAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationDigest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_organizationId_aggregateKey_key" ON "Notification"("organizationId", "aggregateKey");
CREATE UNIQUE INDEX "NotificationReadState_notificationId_personId_key" ON "NotificationReadState"("notificationId", "personId");
CREATE UNIQUE INDEX "NotificationPreference_organizationId_personId_key" ON "NotificationPreference"("organizationId", "personId");
CREATE UNIQUE INDEX "NotificationDigest_organizationId_personId_deliveryTiming_windowStartsAt_windowEndsAt_key" ON "NotificationDigest"("organizationId", "personId", "deliveryTiming", "windowStartsAt", "windowEndsAt");

CREATE INDEX "AwarenessEvent_organizationId_category_occurredAt_idx" ON "AwarenessEvent"("organizationId", "category", "occurredAt");
CREATE INDEX "AwarenessEvent_organizationId_aggregateKey_occurredAt_idx" ON "AwarenessEvent"("organizationId", "aggregateKey", "occurredAt");
CREATE INDEX "AwarenessEvent_organizationId_actorPersonId_occurredAt_idx" ON "AwarenessEvent"("organizationId", "actorPersonId", "occurredAt");
CREATE INDEX "AwarenessEvent_organizationId_entryId_occurredAt_idx" ON "AwarenessEvent"("organizationId", "entryId", "occurredAt");
CREATE INDEX "AwarenessEvent_organizationId_workflowRunId_occurredAt_idx" ON "AwarenessEvent"("organizationId", "workflowRunId", "occurredAt");
CREATE INDEX "AwarenessEvent_organizationId_eventId_occurredAt_idx" ON "AwarenessEvent"("organizationId", "eventId", "occurredAt");
CREATE INDEX "Notification_organizationId_category_lastEventAt_idx" ON "Notification"("organizationId", "category", "lastEventAt");
CREATE INDEX "Notification_organizationId_entryId_idx" ON "Notification"("organizationId", "entryId");
CREATE INDEX "Notification_organizationId_workflowRunId_idx" ON "Notification"("organizationId", "workflowRunId");
CREATE INDEX "NotificationReadState_organizationId_personId_readAt_idx" ON "NotificationReadState"("organizationId", "personId", "readAt");
CREATE INDEX "NotificationReadState_organizationId_personId_archivedAt_deliveredAt_idx" ON "NotificationReadState"("organizationId", "personId", "archivedAt", "deliveredAt");
CREATE INDEX "NotificationPreference_organizationId_personId_deliveryTiming_idx" ON "NotificationPreference"("organizationId", "personId", "deliveryTiming");
CREATE INDEX "NotificationDigest_organizationId_personId_status_windowStartsAt_idx" ON "NotificationDigest"("organizationId", "personId", "status", "windowStartsAt");
CREATE INDEX "NotificationDigest_organizationId_status_windowEndsAt_idx" ON "NotificationDigest"("organizationId", "status", "windowEndsAt");

ALTER TABLE "AwarenessEvent"
  ADD CONSTRAINT "AwarenessEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AwarenessEvent"
  ADD CONSTRAINT "AwarenessEvent_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AwarenessEvent"
  ADD CONSTRAINT "AwarenessEvent_workflowRunId_fkey"
  FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AwarenessEvent"
  ADD CONSTRAINT "AwarenessEvent_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AwarenessEvent"
  ADD CONSTRAINT "AwarenessEvent_actorPersonId_fkey"
  FOREIGN KEY ("actorPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_latestAwarenessEventId_fkey"
  FOREIGN KEY ("latestAwarenessEventId") REFERENCES "AwarenessEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_workflowRunId_fkey"
  FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationReadState"
  ADD CONSTRAINT "NotificationReadState_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationReadState"
  ADD CONSTRAINT "NotificationReadState_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationReadState"
  ADD CONSTRAINT "NotificationReadState_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDigest"
  ADD CONSTRAINT "NotificationDigest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationDigest"
  ADD CONSTRAINT "NotificationDigest_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
