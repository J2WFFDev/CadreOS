-- Arc 26C: Member qualification, certification, and eligibility foundation

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'QualificationAssignmentStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "QualificationAssignmentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'PENDING', 'SUSPENDED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'CertificationVerificationStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "CertificationVerificationStatus" AS ENUM ('VERIFIED', 'PENDING', 'REJECTED', 'EXPIRED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'EligibilityTargetType'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "EligibilityTargetType" AS ENUM ('TEAM', 'PROGRAM', 'EQUIPMENT', 'ACTIVITY', 'RESPONSIBILITY');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "QualificationDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "qualificationType" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "supportsTeamParticipation" BOOLEAN NOT NULL DEFAULT false,
  "supportsProgramParticipation" BOOLEAN NOT NULL DEFAULT false,
  "supportsEquipmentEligibility" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QualificationDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QualificationDefinition_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PersonQualification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "qualificationId" TEXT NOT NULL,
  "earnedDate" TIMESTAMP(3),
  "expirationDate" TIMESTAMP(3),
  "status" "QualificationAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PersonQualification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonQualification_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PersonQualification_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PersonQualification_qualificationId_fkey"
    FOREIGN KEY ("qualificationId") REFERENCES "QualificationDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CertificationDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuingOrganization" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CertificationDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CertificationDefinition_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PersonCertification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "certificationId" TEXT NOT NULL,
  "earnedDate" TIMESTAMP(3),
  "expirationDate" TIMESTAMP(3),
  "verificationStatus" "CertificationVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PersonCertification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonCertification_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PersonCertification_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PersonCertification_certificationId_fkey"
    FOREIGN KEY ("certificationId") REFERENCES "CertificationDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "EligibilityDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "targetType" "EligibilityTargetType" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "teamId" TEXT,
  "programId" TEXT,
  "targetLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EligibilityDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EligibilityDefinition_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EligibilityDefinition_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "EligibilityDefinition_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "EligibilityRequiredQualification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eligibilityId" TEXT NOT NULL,
  "qualificationId" TEXT NOT NULL,

  CONSTRAINT "EligibilityRequiredQualification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EligibilityRequiredQualification_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EligibilityRequiredQualification_eligibilityId_fkey"
    FOREIGN KEY ("eligibilityId") REFERENCES "EligibilityDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EligibilityRequiredQualification_qualificationId_fkey"
    FOREIGN KEY ("qualificationId") REFERENCES "QualificationDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "EligibilityRequiredCertification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eligibilityId" TEXT NOT NULL,
  "certificationId" TEXT NOT NULL,

  CONSTRAINT "EligibilityRequiredCertification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EligibilityRequiredCertification_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EligibilityRequiredCertification_eligibilityId_fkey"
    FOREIGN KEY ("eligibilityId") REFERENCES "EligibilityDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EligibilityRequiredCertification_certificationId_fkey"
    FOREIGN KEY ("certificationId") REFERENCES "CertificationDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "QualificationDefinition_organizationId_name_key"
  ON "QualificationDefinition"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "QualificationDefinition_organizationId_active_idx"
  ON "QualificationDefinition"("organizationId", "active");
CREATE INDEX IF NOT EXISTS "QualificationDefinition_organizationId_qualificationType_idx"
  ON "QualificationDefinition"("organizationId", "qualificationType");

CREATE UNIQUE INDEX IF NOT EXISTS "PersonQualification_personId_qualificationId_key"
  ON "PersonQualification"("personId", "qualificationId");
CREATE INDEX IF NOT EXISTS "PersonQualification_organizationId_personId_status_idx"
  ON "PersonQualification"("organizationId", "personId", "status");
CREATE INDEX IF NOT EXISTS "PersonQualification_organizationId_expirationDate_idx"
  ON "PersonQualification"("organizationId", "expirationDate");

CREATE UNIQUE INDEX IF NOT EXISTS "CertificationDefinition_organizationId_name_key"
  ON "CertificationDefinition"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "CertificationDefinition_organizationId_active_idx"
  ON "CertificationDefinition"("organizationId", "active");

CREATE UNIQUE INDEX IF NOT EXISTS "PersonCertification_personId_certificationId_key"
  ON "PersonCertification"("personId", "certificationId");
CREATE INDEX IF NOT EXISTS "PersonCertification_organizationId_personId_verificationStatus_idx"
  ON "PersonCertification"("organizationId", "personId", "verificationStatus");
CREATE INDEX IF NOT EXISTS "PersonCertification_organizationId_expirationDate_idx"
  ON "PersonCertification"("organizationId", "expirationDate");

CREATE INDEX IF NOT EXISTS "EligibilityDefinition_organizationId_active_targetType_idx"
  ON "EligibilityDefinition"("organizationId", "active", "targetType");
CREATE INDEX IF NOT EXISTS "EligibilityDefinition_organizationId_teamId_idx"
  ON "EligibilityDefinition"("organizationId", "teamId");
CREATE INDEX IF NOT EXISTS "EligibilityDefinition_organizationId_programId_idx"
  ON "EligibilityDefinition"("organizationId", "programId");

CREATE UNIQUE INDEX IF NOT EXISTS "EligibilityRequiredQualification_eligibilityId_qualificationId_key"
  ON "EligibilityRequiredQualification"("eligibilityId", "qualificationId");
CREATE INDEX IF NOT EXISTS "EligibilityRequiredQualification_organizationId_eligibilityId_idx"
  ON "EligibilityRequiredQualification"("organizationId", "eligibilityId");

CREATE UNIQUE INDEX IF NOT EXISTS "EligibilityRequiredCertification_eligibilityId_certificationId_key"
  ON "EligibilityRequiredCertification"("eligibilityId", "certificationId");
CREATE INDEX IF NOT EXISTS "EligibilityRequiredCertification_organizationId_eligibilityId_idx"
  ON "EligibilityRequiredCertification"("organizationId", "eligibilityId");
