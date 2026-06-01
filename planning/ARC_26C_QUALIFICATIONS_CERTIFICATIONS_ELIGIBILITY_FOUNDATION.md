# ARC 26C — Qualifications, Certifications, and Eligibility Foundation

## Qualification Model

CadreOS MemberOps qualification foundation supports organization-level qualification definitions and member-level qualification assignments.

Qualification definition fields:

- `name`
- `description`
- `qualificationType`
- `active`
- `supportsTeamParticipation`
- `supportsProgramParticipation`
- `supportsEquipmentEligibility`

Member qualification assignment fields:

- `personId`
- `qualificationId`
- `earnedDate`
- `expirationDate`
- `status`
- `notes`

Qualification assignment statuses:

- `ACTIVE`
- `EXPIRED`
- `PENDING`
- `SUSPENDED`

Implementation notes:

- `QualificationDefinition` is the canonical organization-level qualification catalog.
- `PersonQualification` stores each member’s qualification state without changing lifecycle, household, roster, or role foundations.
- Expiration is surfaced directly in MemberOps dashboards and member detail views.
- Qualification assignment activity is audit-tracked through:
  - `qualification.assignment.granted`
  - `qualification.assignment.update`
  - `qualification.assignment.revoked`

## Certification Model

CadreOS certification foundation uses reusable certification definitions plus member certification records.

Certification definition fields:

- `name`
- `issuingOrganization`
- `active`

Member certification fields:

- `personId`
- `certificationId`
- `earnedDate`
- `expirationDate`
- `verificationStatus`
- `notes`

Certification verification statuses:

- `VERIFIED`
- `PENDING`
- `REJECTED`
- `EXPIRED`

Implementation notes:

- `CertificationDefinition` is the reusable organization catalog for certification assignment.
- `PersonCertification` stores the member’s current certification evidence and verification state.
- Certification activity is audit-tracked through:
  - `certification.assignment.added`
  - `certification.assignment.update`
  - `certification.assignment.expired`

## Eligibility Model

CadreOS eligibility foundation supports simple, explicit eligibility definitions without introducing a complex rules engine.

Eligibility definition fields:

- `name`
- `description`
- `targetType`
- `active`
- `programId`
- `teamId`
- `targetLabel`

Supported target types:

- `TEAM`
- `PROGRAM`
- `EQUIPMENT`
- `ACTIVITY`
- `RESPONSIBILITY`

Implementation notes:

- `EligibilityDefinition` stores the rule target and scope.
- `EligibilityRequiredQualification` links required qualifications.
- `EligibilityRequiredCertification` links required certifications.
- Member detail pages compute eligibility summaries from current qualification and certification assignments.
- Eligibility supports team participation, program participation, equipment eligibility, activity supervision, and responsibility readiness foundations without automatic enforcement.

## Member Detail Integration

Member detail pages now display:

- qualification assignments
- certification assignments
- eligibility summary
- expiration visibility for expiring-soon and expired items

Operational history includes person-linked qualification and certification audit activity in the existing MemberOps history panel.

## Manual Validation Checklist

- MEM-QUAL-001 Create qualification.
- MEM-QUAL-002 Assign qualification.
- MEM-QUAL-003 Qualification status persists.
- MEM-QUAL-004 Expiration date persists.
- MEM-QUAL-005 Create certification.
- MEM-QUAL-006 Assign certification.
- MEM-QUAL-007 Certification expiration persists.
- MEM-QUAL-008 Eligibility displays correctly.
- MEM-QUAL-009 Member detail page displays qualifications.
- MEM-QUAL-010 Team assignments remain functional.
